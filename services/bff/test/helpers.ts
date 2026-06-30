/**
 * Shared test scaffolding for the BFF.
 *
 * Provides:
 *  - an ephemeral RS256 keypair + a `signToken` helper so tests can mint tokens the gateway
 *    verifies, without any live Auth Service;
 *  - a `FakeUpstream` — a tiny in-process HTTP server standing in for an upstream microservice; it
 *    records every received request and returns a configurable response, so proxy/gateway behaviour
 *    can be exercised with NO real Auth/Inventory/Search/Payment services running;
 *  - a `startApp` helper that builds the BFF over ephemeral keys + fake upstreams and listens on an
 *    ephemeral port, returning a base URL for real `fetch` calls.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { type AddressInfo } from 'node:net';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { buildApp } from '../src/app.js';
import { loadConfig, type BffConfig } from '../src/config.js';
import type { UpstreamService } from '../src/domain/permissions.js';
import type { Role } from '../src/domain/roles.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

export const TEST_PUBLIC_KEY = publicKey;
export const TEST_PRIVATE_KEY = privateKey;

export interface SignOptions {
  expiresInSeconds?: number;
  /** When set, signs with a foreign key to simulate a forged token. */
  wrongKey?: boolean;
}

const otherPair = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

/** Mint an RS256 access token the BFF will verify (or a forged/expired one for negative tests). */
export function signToken(userId: string, role: Role, opts: SignOptions = {}): string {
  const key = opts.wrongKey ? otherPair.privateKey : privateKey;
  const expiresIn = opts.expiresInSeconds ?? 3600;
  if (expiresIn <= 0) {
    const nowSec = Math.floor(Date.now() / 1000);
    return jwt.sign({ role, iat: nowSec + expiresIn - 60, exp: nowSec + expiresIn }, key, {
      algorithm: 'RS256',
      subject: userId,
    });
  }
  return jwt.sign({ role }, key, { algorithm: 'RS256', subject: userId, expiresIn });
}

export interface RecordedRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

export interface FakeResponseSpec {
  status: number;
  body: unknown;
  /** When set (>0), the server delays this many ms before responding (to exercise timeouts). */
  delayMs?: number;
  contentType?: string;
}

/** A minimal in-process HTTP server standing in for an upstream microservice. */
export class FakeUpstream {
  readonly requests: RecordedRequest[] = [];
  private response: FakeResponseSpec = { status: 200, body: { ok: true } };
  private server: Server;
  private boundPort = 0;

  constructor(private readonly name: string) {
    this.server = createServer((req, res) => this.handle(req, res));
  }

  setResponse(spec: FakeResponseSpec): void {
    this.response = spec;
  }

  get url(): string {
    return `http://127.0.0.1:${this.boundPort}`;
  }

  get lastRequest(): RecordedRequest | undefined {
    return this.requests[this.requests.length - 1];
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.server.listen(0, '127.0.0.1', () => {
        this.boundPort = (this.server.address() as AddressInfo).port;
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  private handle(req: IncomingMessage, res: ServerResponse): void {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      this.requests.push({
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      });
      const send = (): void => {
        const payload =
          typeof this.response.body === 'string'
            ? this.response.body
            : JSON.stringify({ ...(this.response.body as object), upstream: this.name });
        res.statusCode = this.response.status;
        res.setHeader('content-type', this.response.contentType ?? 'application/json');
        res.end(payload);
      };
      if (this.response.delayMs && this.response.delayMs > 0) {
        setTimeout(send, this.response.delayMs);
      } else {
        send();
      }
    });
  }
}

export interface TestApp {
  baseUrl: string;
  upstreams: Record<UpstreamService, FakeUpstream>;
  config: BffConfig;
  stop: () => Promise<void>;
}

export interface StartAppOptions {
  configOverrides?: Partial<BffConfig>;
  /** Start fake upstreams (default true). When false, service URLs point at an unused port (→ 502). */
  startUpstreams?: boolean;
}

/** Build + start the BFF over ephemeral keys and fake upstreams; returns a base URL for fetch. */
export async function startApp(options: StartAppOptions = {}): Promise<TestApp> {
  const startUpstreams = options.startUpstreams ?? true;
  const services: UpstreamService[] = ['auth', 'inventory', 'search', 'payment'];
  const upstreams = {} as Record<UpstreamService, FakeUpstream>;
  const serviceUrls = {} as Record<UpstreamService, string>;

  for (const svc of services) {
    const up = new FakeUpstream(svc);
    upstreams[svc] = up;
    if (startUpstreams) {
      await up.start();
      serviceUrls[svc] = up.url;
    } else {
      // Point at a closed port to force connection failures (→ 502).
      serviceUrls[svc] = 'http://127.0.0.1:1';
    }
  }

  const baseConfig = loadConfig({});
  const config: BffConfig = {
    ...baseConfig,
    serviceUrls: startUpstreams ? serviceUrls : baseConfig.serviceUrls,
    ...options.configOverrides,
  };
  if (!startUpstreams) {
    config.serviceUrls = serviceUrls;
  }

  const app = buildApp({ config, publicKey: TEST_PUBLIC_KEY });

  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = (server.address() as AddressInfo).port;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    upstreams,
    config,
    stop: async () => {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
      if (startUpstreams) {
        await Promise.all(services.map((svc) => upstreams[svc].stop()));
      }
    },
  };
}
