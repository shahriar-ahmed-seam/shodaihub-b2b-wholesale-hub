/**
 * Illustrated hero artwork — pure inline SVG (no external image). It depicts a warehouse/commerce
 * scene using the brand palette. BRAND ASSET SLOT: swap this component for a real hero image or
 * illustration. It fills its container (absolute/aspect parent) so replacing it needs no layout
 * changes — keep a 16:11-ish aspect for the same composition.
 */
export function HeroArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 330"
      className={className}
      role="img"
      aria-label="Illustration of a wholesale warehouse with stacked goods"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="hero-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E4EFEC" />
          <stop offset="1" stopColor="#F6F8F7" />
        </linearGradient>
        <linearGradient id="hero-roof" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0F5C4D" />
          <stop offset="1" stopColor="#0C4D40" />
        </linearGradient>
      </defs>

      <rect width="480" height="330" fill="url(#hero-sky)" rx="16" />

      {/* Warehouse shell */}
      <path d="M70 120 L240 60 L410 120 V250 H70 Z" fill="#FFFFFF" stroke="#DCE5E1" strokeWidth="2" />
      <path d="M70 120 L240 60 L410 120 H70 Z" fill="url(#hero-roof)" />
      <rect x="220" y="150" width="40" height="100" fill="#E4EFEC" stroke="#DCE5E1" strokeWidth="2" />

      {/* Stacked pallets / crates */}
      <g>
        <rect x="96" y="196" width="46" height="46" rx="4" fill="#F2A516" />
        <rect x="96" y="170" width="46" height="24" rx="4" fill="#D38E0B" />
        <rect x="150" y="206" width="46" height="36" rx="4" fill="#0F5C4D" />
        <rect x="288" y="190" width="48" height="52" rx="4" fill="#3E8676" />
        <rect x="344" y="200" width="44" height="42" rx="4" fill="#F2A516" />
        <rect x="344" y="180" width="44" height="18" rx="4" fill="#D38E0B" />
      </g>

      {/* Ground line */}
      <rect x="56" y="250" width="368" height="6" rx="3" fill="#DCE5E1" />

      {/* Floating price-tier tag */}
      <g transform="translate(300 86)">
        <rect width="118" height="56" rx="10" fill="#FFFFFF" stroke="#DCE5E1" strokeWidth="2" />
        <circle cx="18" cy="18" r="6" fill="#1B8A5A" />
        <rect x="32" y="13" width="70" height="8" rx="4" fill="#11201C" opacity="0.85" />
        <rect x="32" y="30" width="50" height="7" rx="3.5" fill="#52645E" opacity="0.6" />
        <rect x="18" y="40" width="84" height="2" fill="#DCE5E1" />
      </g>

      {/* Trust check badge */}
      <g transform="translate(70 70)">
        <circle cx="20" cy="20" r="20" fill="#0F5C4D" />
        <path d="M12 20l6 6 10-12" stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
