/**
 * Task 2.5 — Property 36: Registration creates a pending account with the selected role;
 * duplicates and invalid inputs are rejected.
 * Validates: Requirements 1.1, 1.2, 1.3, 1.8
 */

import { AppError } from '@b2b/shared-node';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ROLES } from '../src/domain/roles.js';
import { InMemoryUserRepository } from '../src/repositories/memory.js';
import { makeHarness } from './helpers.js';

const validEmailArb = fc
  .tuple(
    fc.stringMatching(/^[a-z0-9]{1,12}$/),
    fc.stringMatching(/^[a-z0-9]{1,10}$/),
    fc.constantFrom('com', 'net', 'org', 'io', 'bd'),
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

const validInputArb = fc.record({
  email: validEmailArb,
  password: fc.string({ minLength: 8, maxLength: 128 }),
  businessName: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length >= 1),
  role: fc.constantFrom(...ROLES),
});

const invalidInputArb = fc.oneof(
  // Bad email format (Req 1.8).
  fc.record({
    email: fc.constantFrom('not-an-email', 'missing@tld', '@no-local.com', 'spaces in@x.com', ''),
    password: fc.string({ minLength: 8, maxLength: 128 }),
    businessName: fc.constant('Acme Co'),
    role: fc.constantFrom(...ROLES),
  }),
  // Password too short / too long (Req 1.3).
  fc.record({
    email: validEmailArb,
    password: fc.oneof(fc.string({ minLength: 0, maxLength: 7 }), fc.string({ minLength: 129, maxLength: 160 })),
    businessName: fc.constant('Acme Co'),
    role: fc.constantFrom(...ROLES),
  }),
  // Invalid role (Req 2.5).
  fc.record({
    email: validEmailArb,
    password: fc.string({ minLength: 8, maxLength: 128 }),
    businessName: fc.constant('Acme Co'),
    role: fc.constantFrom('admin', 'BUYER', 'supplier', '', 'ROOT'),
  }),
);

describe('Property 36: registration creation vs rejection', () => {
  // Feature: b2b-wholesale-hub, Property 36: Registration creates a pending account with the
  // selected role if and only if the email is well-formed, not already registered, and the
  // password length is within 8-128; otherwise it is rejected and no account is created.
  it('valid input creates a PENDING_VERIFICATION account with the selected role', async () => {
    await fc.assert(
      fc.asyncProperty(validInputArb, async (input) => {
        const h = makeHarness();
        const user = await h.service.register(input);
        expect(user.status).toBe('PENDING_VERIFICATION');
        expect(user.role).toBe(input.role);
        expect(user.email).toBe(input.email.toLowerCase());
        const found = await h.repos.users.findByEmail(input.email);
        expect(found?.id).toBe(user.id);
      }),
      { numRuns: 100 },
    );
  });

  it('invalid input is rejected and creates no account', async () => {
    await fc.assert(
      fc.asyncProperty(invalidInputArb, async (input) => {
        const h = makeHarness();
        const usersRepo = h.repos.users as InMemoryUserRepository;
        await expect(h.service.register(input as never)).rejects.toBeInstanceOf(AppError);
        expect(usersRepo.size()).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  it('duplicate email is rejected and leaves exactly one account', async () => {
    await fc.assert(
      fc.asyncProperty(validInputArb, async (input) => {
        const h = makeHarness();
        const usersRepo = h.repos.users as InMemoryUserRepository;
        await h.service.register(input);
        await expect(h.service.register({ ...input, businessName: 'Other Co' })).rejects.toMatchObject({
          code: 'EMAIL_ALREADY_REGISTERED',
        });
        expect(usersRepo.size()).toBe(1);
      }),
      { numRuns: 100 },
    );
  });
});
