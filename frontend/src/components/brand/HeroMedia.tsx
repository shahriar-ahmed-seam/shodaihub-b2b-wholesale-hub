import { HERO_IMAGES } from '@/lib/mock/images.generated';
import { HeroArt } from './HeroArt';

/**
 * Landing hero visual. Renders a real high-resolution Unsplash photograph (with photographer
 * attribution, per Unsplash guidelines) when the generated image catalogue is populated; otherwise
 * falls back to the brand SVG illustration so the page always renders without network/keys.
 */
export function HeroMedia() {
  const hero = HERO_IMAGES[0];

  if (!hero) {
    return (
      <div className="overflow-hidden rounded-lg shadow-lg">
        <HeroArt className="h-auto w-full" />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg shadow-lg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={hero.url}
        alt={hero.alt}
        className="aspect-[4/3] h-full w-full object-cover"
        loading="eager"
      />
    </div>
  );
}
