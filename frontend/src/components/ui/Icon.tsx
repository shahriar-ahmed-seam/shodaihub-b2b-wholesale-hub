import type { SVGProps } from 'react';
import { cn } from '@/lib/cn';

/**
 * A set of crisp, uniform inline-SVG icons (24×24, stroke=currentColor, strokeWidth 1.5, no fills
 * unless noted). Inline SVG keeps everything offline-safe — no icon font or network request. Each
 * icon is decorative by default (aria-hidden); pass `aria-hidden={false}` + a title/label when an
 * icon carries meaning on its own.
 */
export type IconProps = SVGProps<SVGSVGElement>;

function Svg({ className, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('shrink-0', className)}
      {...props}
    >
      {children}
    </svg>
  );
}

export const PackageIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
    <path d="m4 7.5 8 4.5 8-4.5" />
    <path d="M12 12v9" />
    <path d="m8 5.25 8 4.5" />
  </Svg>
);
// Alias — Box is the same physical metaphor as Package.
export const BoxIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="4" y="6" width="16" height="13" rx="1.5" />
    <path d="M4 10h16" />
    <path d="M9.5 6V3.5h5V6" />
  </Svg>
);

export const TruckIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3 6.5h11v8H3z" />
    <path d="M14 9.5h4l3 3v2h-7z" />
    <circle cx="7" cy="17" r="1.8" />
    <circle cx="17.5" cy="17" r="1.8" />
    <path d="M8.8 17h6.9M3 14.5h.5M21 14.5h-1.7" />
  </Svg>
);

export const StoreIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 9.5 5.2 5h13.6L20 9.5" />
    <path d="M4 9.5a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" />
    <path d="M5 11.5V19h14v-7.5" />
    <path d="M10 19v-4h4v4" />
  </Svg>
);
export const ShopIcon = StoreIcon;

export const WalletIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H17v3" />
    <rect x="4" y="7.5" width="16" height="11" rx="2" />
    <path d="M16 12.5h4v3h-4a1.5 1.5 0 0 1 0-3Z" />
  </Svg>
);

export const UsersIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3 3 0 0 1 0 5.6" />
    <path d="M17 14.2A5.5 5.5 0 0 1 20.5 19" />
  </Svg>
);

export const UserCheckIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="m15.5 13.5 1.8 1.8 3.2-3.4" />
  </Svg>
);

export const ClipboardListIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="5" y="5" width="14" height="16" rx="2" />
    <path d="M9 5V3.8A.8.8 0 0 1 9.8 3h4.4a.8.8 0 0 1 .8.8V5" />
    <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" />
  </Svg>
);

export const ChartBarIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 20h16" />
    <rect x="5.5" y="11" width="3.5" height="6" rx="0.5" />
    <rect x="10.5" y="7" width="3.5" height="10" rx="0.5" />
    <rect x="15.5" y="13" width="3.5" height="4" rx="0.5" />
  </Svg>
);

export const TagIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 12.5V5.5A1.5 1.5 0 0 1 5.5 4h7L20 11.5a1.5 1.5 0 0 1 0 2.1l-6.4 6.4a1.5 1.5 0 0 1-2.1 0L4 12.5Z" />
    <circle cx="8.5" cy="8.5" r="1.2" />
  </Svg>
);
export const PriceIcon = TagIcon;

export const ShoppingCartIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3 4h2l1.6 9.4a1.5 1.5 0 0 0 1.5 1.25h7.9a1.5 1.5 0 0 0 1.47-1.18L19 7H6" />
    <circle cx="9" cy="19" r="1.4" />
    <circle cx="17" cy="19" r="1.4" />
  </Svg>
);

export const LeafIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M19 5C9 5 5 9.5 5 16c0 1 .2 2 .2 2S12 19 16 14c2.7-3.4 3-9 3-9Z" />
    <path d="M5.5 18.5C8 14 12 11 16.5 9" />
  </Svg>
);

export const BoltIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z" />
  </Svg>
);

export const WrenchIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M15.5 3.5a4.5 4.5 0 0 0-4 6.8L4 17.8 6.2 20l7.5-7.5a4.5 4.5 0 0 0 5.6-5.9l-2.6 2.6-2.3-.5-.5-2.3 2.1-2.4a4.5 4.5 0 0 0-.5-.5Z" />
  </Svg>
);

export const ShirtIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M9 4 6 5.5 4 9l2.5 1.5V20h11v-9.5L20 9l-2-3.5L15 4a3 3 0 0 1-6 0Z" />
  </Svg>
);

export const CupIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 8h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8Z" />
    <path d="M16 9.5h2.2a2 2 0 0 1 0 4H16" />
    <path d="M7.5 5c.6-.7.6-1.3 0-2M11 5c.6-.7.6-1.3 0-2" />
  </Svg>
);
export const TeaIcon = CupIcon;

export const GrainIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 3v18" />
    <path d="M12 6c-1.6-1.6-3.5-1.7-4.5-1.5C7.3 6 8 7.8 9.6 9.4 11 10.8 12 11 12 11s.1-1.2-1.3-2.6" />
    <path d="M12 6c1.6-1.6 3.5-1.7 4.5-1.5C16.7 6 16 7.8 14.4 9.4 13 10.8 12 11 12 11" />
    <path d="M12 11c-1.6-1.6-3.5-1.7-4.5-1.5C7.3 11 8 12.8 9.6 14.4 11 15.8 12 16 12 16" />
    <path d="M12 11c1.6-1.6 3.5-1.7 4.5-1.5C16.7 11 16 12.8 14.4 14.4 13 15.8 12 16 12 16" />
  </Svg>
);
export const WheatIcon = GrainIcon;

export const HomeIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 11 12 4l8 7" />
    <path d="M6 9.5V20h12V9.5" />
    <path d="M10 20v-5h4v5" />
  </Svg>
);

export const SparkleIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 3c.6 3.8 1.7 5 5.5 5.5C13.7 9 12.6 10.2 12 14c-.6-3.8-1.7-5-5.5-5.5C10.3 8 11.4 6.8 12 3Z" />
    <path d="M18 14c.3 1.7.8 2.2 2.5 2.5-1.7.3-2.2.8-2.5 2.5-.3-1.7-.8-2.2-2.5-2.5 1.7-.3 2.2-.8 2.5-2.5Z" />
  </Svg>
);

export const SearchIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="m15 15 5 5" />
  </Svg>
);

export const ClockIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const CheckIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Svg>
);

/** Map form for dynamic lookups (e.g. category/status drivers). */
export const Icon = {
  package: PackageIcon,
  box: BoxIcon,
  truck: TruckIcon,
  store: StoreIcon,
  shop: ShopIcon,
  wallet: WalletIcon,
  users: UsersIcon,
  userCheck: UserCheckIcon,
  clipboardList: ClipboardListIcon,
  chartBar: ChartBarIcon,
  tag: TagIcon,
  price: PriceIcon,
  shoppingCart: ShoppingCartIcon,
  leaf: LeafIcon,
  bolt: BoltIcon,
  wrench: WrenchIcon,
  shirt: ShirtIcon,
  cup: CupIcon,
  tea: TeaIcon,
  grain: GrainIcon,
  wheat: WheatIcon,
  home: HomeIcon,
  sparkle: SparkleIcon,
  search: SearchIcon,
  clock: ClockIcon,
  check: CheckIcon,
} as const;

export type IconName = keyof typeof Icon;
