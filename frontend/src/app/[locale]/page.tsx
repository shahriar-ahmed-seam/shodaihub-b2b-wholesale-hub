import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';
import { HomeSearch } from '@/components/domain/HomeSearch';
import { HeroMedia } from '@/components/brand/HeroMedia';
import { CategoryIcon } from '@/components/ui/CategoryIcon';

const CATEGORY_KEYS = [
  'grocery',
  'textiles',
  'electronics',
  'household',
  'agriculture',
  'construction',
] as const;

const categoryAccent: Record<(typeof CATEGORY_KEYS)[number], string> = {
  grocery: 'from-[#E4EFEC] to-[#CFE3DD]',
  textiles: 'from-[#FCEFCF] to-[#F7DEA0]',
  electronics: 'from-[#E2ECF7] to-[#C9DCF1]',
  household: 'from-[#F0EAF7] to-[#DfD2F0]',
  agriculture: 'from-[#E3F3EB] to-[#C7E8D5]',
  construction: 'from-[#F6F0E6] to-[#ECDFC8]',
};

export default function LandingPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  return <LandingContent />;
}

function LandingContent() {
  const t = useTranslations('home');
  const tb = useTranslations('brand');
  const tcat = useTranslations('categories');

  return (
    <>
      {/* Hero */}
      <section className="bg-grid border-b border-line">
        <div className="container-page grid gap-10 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
          <div className="flex flex-col gap-6">
            <span className="inline-flex w-fit items-center gap-2 rounded-pill bg-brand-primary-100 px-3 py-1 text-xs font-semibold text-brand-primary">
              <span className="h-1.5 w-1.5 rounded-pill bg-success" />
              {t('heroBadge')}
            </span>
            <h1 className="font-display text-3xl font-bold leading-tight text-brand-ink sm:text-4xl lg:text-5xl">
              {tb('tagline')}
            </h1>
            <p className="max-w-xl text-lg text-brand-ink-muted">{tb('subtagline')}</p>
            <HomeSearch />
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" variant="accent">
                <Link href="/search">{t('browseAll')}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/auth/register">{t('searchCta')}</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <HeroMedia />
          </div>
        </div>
      </section>

      {/* Featured categories */}
      <section className="container-page py-16">
        <div className="mb-8 max-w-2xl">
          <h2 className="font-display text-2xl font-bold text-brand-ink">{t('featuredTitle')}</h2>
          <p className="mt-2 text-brand-ink-muted">{t('featuredSubtitle')}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORY_KEYS.map((key) => (
            <Link
              key={key}
              href={`/search?category=${encodeURIComponent(tcat(key))}`}
              className={`group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-lg bg-gradient-to-br ${categoryAccent[key]} p-4 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40`}
            >
              <CategoryIcon
                categoryKey={key}
                className="absolute -right-3 -top-3 h-20 w-20 text-brand-primary/20 transition-transform duration-300 group-hover:scale-110"
              />
              <span className="relative text-sm font-semibold text-brand-ink">{tcat(key)}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Value props */}
      <section className="border-t border-line bg-surface">
        <div className="container-page py-16">
          <h2 className="mb-8 font-display text-2xl font-bold text-brand-ink">{t('valueTitle')}</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {(['1', '2', '3'] as const).map((n) => (
              <div key={n} className="flex flex-col gap-2 rounded-lg border border-line p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-primary text-white">
                  {n}
                </span>
                <h3 className="font-display text-lg font-semibold text-brand-ink">
                  {t(`value${n}Title`)}
                </h3>
                <p className="text-sm text-brand-ink-muted">{t(`value${n}Body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
