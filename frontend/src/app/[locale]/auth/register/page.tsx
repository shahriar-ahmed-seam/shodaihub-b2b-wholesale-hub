import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { RegisterForm } from '@/components/domain/RegisterForm';
import { Logo } from '@/components/brand/Logo';

export default function RegisterPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  return <RegisterContent />;
}

function RegisterContent() {
  const t = useTranslations('auth');
  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-lg rounded-lg border border-line bg-surface p-8 shadow-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo />
          <h1 className="font-display text-2xl font-bold text-brand-ink">{t('registerTitle')}</h1>
          <p className="text-sm text-brand-ink-muted">{t('registerSubtitle')}</p>
        </div>
        <RegisterForm />
      </div>
    </div>
  );
}
