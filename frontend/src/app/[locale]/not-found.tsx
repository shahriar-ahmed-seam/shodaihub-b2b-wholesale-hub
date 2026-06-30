import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  const t = useTranslations('nav');
  return (
    <div className="container-page flex flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="font-display text-6xl font-bold text-brand-primary">404</p>
      <p className="text-brand-ink-muted">This page could not be found.</p>
      <Button asChild>
        <Link href="/">{t('home')}</Link>
      </Button>
    </div>
  );
}
