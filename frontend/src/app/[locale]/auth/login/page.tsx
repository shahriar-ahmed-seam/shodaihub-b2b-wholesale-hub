import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { LoginForm } from '@/components/domain/LoginForm';
import { Logo } from '@/components/brand/Logo';

export default function LoginPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  return <LoginContent />;
}

function LoginContent() {
  const t = useTranslations('auth');
  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-8 shadow-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo />
          <h1 className="font-display text-2xl font-bold text-brand-ink">{t('loginTitle')}</h1>
          <p className="text-sm text-brand-ink-muted">{t('loginSubtitle')}</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
