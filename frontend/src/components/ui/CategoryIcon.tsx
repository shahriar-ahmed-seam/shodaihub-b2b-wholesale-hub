import {
  BoltIcon,
  GrainIcon,
  HomeIcon,
  type IconProps,
  PackageIcon,
  ShirtIcon,
  WheatIcon,
  WrenchIcon,
} from './Icon';

/**
 * Maps the six landing-tile category keys used in `app/[locale]/page.tsx` to a representative
 * icon. Falls back to a neutral package glyph for any unknown key.
 */
const CATEGORY_ICONS: Record<string, (props: IconProps) => JSX.Element> = {
  grocery: WheatIcon,
  textiles: ShirtIcon,
  electronics: BoltIcon,
  household: HomeIcon,
  agriculture: GrainIcon,
  construction: WrenchIcon,
};

export function CategoryIcon({
  categoryKey,
  className,
}: {
  categoryKey: string;
  className?: string;
}) {
  const Glyph = CATEGORY_ICONS[categoryKey] ?? PackageIcon;
  return <Glyph className={className} aria-hidden="true" />;
}
