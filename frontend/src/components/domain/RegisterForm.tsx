'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import type { ErrorEnvelope, Role } from '@/lib/api/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Registration form with role selection (Req 1.1). Validates email format and password length
 * client-side (Req 1.3, 1.8 mirror), posts to the register route handler, and maps field-level
 * envelope errors back to inputs. New accounts are PENDING_VERIFICATION, so we route to login.
 */
export function RegisterForm() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const { notify } = useToast();
  const router = useRouter();
  const [role, setRole] = useState<Role>('RETAILER');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const businessName = String(form.get('businessName') ?? '');

    const nextErrors: Record<string, string> = {};
    if (!EMAIL_RE.test(email)) nextErrors.email = t('invalidEmail');
    if (password.length < 8 || password.length > 128) nextErrors.password = t('passwordPolicy');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, businessName, role }),
      });
      if (!res.ok) {
        const body = (await res.json()) as ErrorEnvelope;
        const fieldErrors: Record<string, string> = {};
        for (const detail of body.error?.details ?? []) {
          if (detail.field) fieldErrors[detail.field] = detail.issue;
        }
        if (Object.keys(fieldErrors).length) setErrors(fieldErrors);
        else notify({ title: tc('error'), description: body.error?.message, tone: 'danger' });
        return;
      }
      notify({ title: t('registerTitle'), description: t('registerSuccess'), tone: 'success' });
      router.push('/auth/login');
    } catch {
      notify({ title: tc('error'), tone: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  const roles: Array<{ value: Role; label: string; hint: string }> = [
    { value: 'SUPPLIER', label: t('roleSupplier'), hint: t('roleSupplierHint') },
    { value: 'RETAILER', label: t('roleRetailer'), hint: t('roleRetailerHint') },
  ];

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-brand-ink">{t('role')}</legend>
        <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
          {roles.map((option) => {
            const selected = role === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setRole(option.value)}
                className={cn(
                  'flex flex-col gap-1 rounded-md border-2 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40',
                  selected ? 'border-brand-primary bg-brand-primary-100' : 'border-line hover:border-brand-primary-300',
                )}
              >
                <span className="text-sm font-semibold text-brand-ink">{option.label}</span>
                <span className="text-xs text-brand-ink-muted">{option.hint}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <Input name="businessName" label={t('businessName')} required maxLength={200} />
      <Input
        name="email"
        type="email"
        label={t('email')}
        autoComplete="email"
        required
        error={errors.email}
      />
      <Input
        name="password"
        type="password"
        label={t('password')}
        hint={t('passwordPolicy')}
        autoComplete="new-password"
        required
        error={errors.password}
      />
      <Button type="submit" size="lg" disabled={submitting}>
        {t('createAccount')}
      </Button>
      <p className="text-sm text-brand-ink-muted">
        {t('haveAccount')}{' '}
        <Link href="/auth/login" className="link-underline font-medium">
          {t('signIn')}
        </Link>
      </p>
    </form>
  );
}
