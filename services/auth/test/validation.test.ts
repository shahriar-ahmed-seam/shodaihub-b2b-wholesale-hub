/**
 * Unit tests for the pure registration validation (Req 1.1, 1.2, 1.3, 1.8, 2.5).
 */

import { describe, expect, it } from 'vitest';
import { isValidEmailFormat, validateRegistration } from '../src/domain/validation.js';

describe('email format validation', () => {
  it.each(['a@b.com', 'user.name@example.co.uk', 'x1@y2.bd'])('accepts %s', (email) => {
    expect(isValidEmailFormat(email)).toBe(true);
  });

  it.each(['', 'plainaddress', '@no-local.com', 'no-at.com', 'a@b', 'spaces in@x.com', 'a@b.c'])(
    'rejects %s',
    (email) => {
      expect(isValidEmailFormat(email)).toBe(false);
    },
  );
});

describe('validateRegistration', () => {
  const base = {
    email: 'good@ex.com',
    password: 'password1234',
    businessName: 'Acme Wholesale',
    role: 'SUPPLIER',
  };

  it('accepts a well-formed request and normalizes the email', () => {
    const result = validateRegistration({ ...base, email: 'GOOD@EX.COM' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.email).toBe('good@ex.com');
      expect(result.value.preferredLanguage).toBe('en');
    }
  });

  it('reports each offending field', () => {
    const result = validateRegistration({ email: 'bad', password: 'x', businessName: '', role: 'X' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const fields = result.errors.map((e) => e.field).sort();
      expect(fields).toEqual(['businessName', 'email', 'password', 'role']);
    }
  });

  it('enforces password length bounds (8..128)', () => {
    expect(validateRegistration({ ...base, password: '1234567' }).ok).toBe(false);
    expect(validateRegistration({ ...base, password: '12345678' }).ok).toBe(true);
    expect(validateRegistration({ ...base, password: 'a'.repeat(128) }).ok).toBe(true);
    expect(validateRegistration({ ...base, password: 'a'.repeat(129) }).ok).toBe(false);
  });

  it('rejects an unsupported preferred language but accepts bn', () => {
    expect(validateRegistration({ ...base, preferredLanguage: 'fr' }).ok).toBe(false);
    expect(validateRegistration({ ...base, preferredLanguage: 'bn' }).ok).toBe(true);
  });
});
