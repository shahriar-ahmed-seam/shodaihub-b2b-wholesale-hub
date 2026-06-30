'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ErrorEnvelope, Role } from '@/lib/api/types';

const roleHome: Record<Role, string> = {
  SUPPLIER: '/supplier/dashboard',
  RETAILER: '/orders',
  ADMINISTRATOR: '/admin',
};

/** Demo accounts (mock mode). Any password is accepted; the role is inferred from the email. */
const DEMO_PASSWORD = 'demo1234';
const DEMO_ACCOUNTS: Array<{ label: string; email: string }> = [
  { label: 'Retailer', email: 'retailer@shodaihub.test' },
  { label: 'Supplier', email: 'supplier@shodaihub.test' },
  { label: 'Admin', email: 'admin@shodaihub.test' },
];

/**
 * Login form (Req 1.4). Posts to the Next login route handler which sets the httpOnly session
 * cookie; surfaces the standard error envelope message on failure (generic — never reveals which
 * credential was wrong, per Req 1.5).
 *
 * In standalone mock mode it also offers one-tap demo logins for each role so reviewers can jump
 * straight into the Retailer, Supplier, and Admin experiences.
 */
export function LoginForm() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const login = async (emailValue: string, passwordValue: string) => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailValue, password: passwordValue }),
      });
      if (!res.ok) {
        const errBody = (await res.json()) as ErrorEnvelope;
        setError(errBody.error?.message ?? tc('error'));
        return;
      }
      const okBody = (await res.json()) as { user: { role: Role } };
      router.push(roleHome[okBody.user.role] ?? '/');
      router.refresh();
    } catch {
      setError(tc('error'));
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void login(email, password);
  };

  const onDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    void login(demoEmail, DEMO_PASSWORD);
  };

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error ? (
          <div role="alert" className="rounded-md border border-danger/30 bg-[#FBE6E3] px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}
        <Input
          name="email"
          type="email"
          label={t('email')}
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          name="password"
          type="password"
          label={t('password')}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" size="lg" disabled={submitting}>
          {t('signIn')}
        </Button>
        <p className="text-sm text-brand-ink-muted">
          {t('noAccount')}{' '}
          <Link href="/auth/register" className="link-underline font-medium">
            {t('createAccount')}
          </Link>
        </p>
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-2xs font-semibold uppercase tracking-wide text-brand-ink-muted">
          Quick demo login
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {DEMO_ACCOUNTS.map((account) => (
          <Button
            key={account.email}
            type="button"
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => onDemo(account.email)}
          >
            {account.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
