import { cn } from '@/lib/cn';

/**
 * Placeholder brand wordmark — an inline SVG so there is no external image dependency and the
 * logo inherits the token palette. BRAND ASSET SLOT: replace this component's SVG with the real
 * horizontal logo (and `LogoMark` with the favicon mark) without touching any layout. Keep the
 * intrinsic 168×32 viewBox so surrounding spacing stays identical.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 188 32"
      className={cn('h-7 w-auto', className)}
      role="img"
      aria-label="ShodaiHub"
    >
      {/* Mark: stacked crates suggesting bulk/wholesale. */}
      <rect x="1" y="14" width="13" height="13" rx="3" fill="#0F5C4D" />
      <rect x="6.5" y="5" width="13" height="13" rx="3" fill="#F2A516" />
      <path d="M13 11.5h0" stroke="#11201C" strokeWidth="0" />
      {/* Wordmark */}
      <text
        x="30"
        y="22"
        fontFamily="Sora, system-ui, sans-serif"
        fontSize="18"
        fontWeight="700"
        fill="#11201C"
      >
        Shodai
        <tspan fill="#0F5C4D">Hub</tspan>
      </text>
    </svg>
  );
}

/** Square logo mark for favicons / compact placements. BRAND ASSET SLOT (see above). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('h-8 w-8', className)} role="img" aria-label="ShodaiHub">
      <rect x="2" y="14" width="14" height="14" rx="3" fill="#0F5C4D" />
      <rect x="9" y="4" width="14" height="14" rx="3" fill="#F2A516" />
    </svg>
  );
}
