import { productById } from '@/lib/mock/data';

/**
 * Deterministic branded SVG placeholder tiles (offline + Vercel safe).
 *
 * Mock products reference `/api/placeholder/<categorySlug>/<productId>`. This handler renders a
 * tasteful gradient tile in the brand palette (deep teal #0F5C4D / amber #F2A516), seeded from the
 * product id so each tile is stable but visually distinct, with the product initials and category
 * label rendered. No external image hosts required.
 */

const SLUG_LABELS: Record<string, string> = {
  'food-grains': 'Food & Grains',
  textiles: 'Textiles & Apparel',
  beverages: 'Beverages',
  'home-kitchen': 'Home & Kitchen',
  'eco-packaging': 'Eco & Packaging',
  electronics: 'Electronics',
  construction: 'Construction',
  'health-beauty': 'Health & Beauty',
  general: 'Wholesale',
};

/** Brand-anchored gradient pairs; the seed picks one deterministically. */
const GRADIENTS: Array<[string, string]> = [
  ['#0F5C4D', '#16876F'],
  ['#0F5C4D', '#0B3F35'],
  ['#117D67', '#F2A516'],
  ['#1A6F5C', '#3FA98F'],
  ['#0E4A3E', '#C8841B'],
  ['#15725F', '#1FA083'],
  ['#0F5C4D', '#D98A12'],
  ['#0B4135', '#16876F'],
];

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function initials(name: string): string {
  const words = name
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !/^\d+kg$|^\d+l$|^\d+$/i.test(w));
  const letters = words.slice(0, 2).map((w) => w[0]!.toUpperCase());
  return (letters.join('') || name.slice(0, 2).toUpperCase()).slice(0, 2);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function GET(_request: Request, { params }: { params: { seg: string[] } }): Response {
  const seg = params.seg ?? [];
  const slug = seg[0] ?? 'general';
  const productId = seg[1] ?? slug;

  const product = productById(productId);
  const label = product?.category ?? SLUG_LABELS[slug] ?? 'Wholesale';
  const text = initials(product?.name ?? slug.replace(/-/g, ' '));

  const seed = hash(productId);
  const [from, to] = GRADIENTS[seed % GRADIENTS.length]!;
  const angle = seed % 90;
  const blobX = 120 + (seed % 320);
  const blobY = 100 + ((seed >> 3) % 220);
  const blobR = 140 + ((seed >> 5) % 120);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${angle} 0.5 0.5)">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="600" fill="url(#g)"/>
  <circle cx="${blobX}" cy="${blobY}" r="${blobR}" fill="#F2A516" fill-opacity="0.14"/>
  <circle cx="${800 - blobX}" cy="${600 - blobY}" r="${blobR * 0.7}" fill="#FFFFFF" fill-opacity="0.06"/>
  <rect width="800" height="600" fill="url(#glow)"/>
  <g fill="#FFFFFF">
    <text x="400" y="300" text-anchor="middle" dominant-baseline="central" font-family="'Segoe UI', system-ui, sans-serif" font-size="200" font-weight="700" fill-opacity="0.92">${escapeXml(text)}</text>
    <rect x="300" y="392" width="200" height="3" rx="1.5" fill="#F2A516" fill-opacity="0.9"/>
    <text x="400" y="440" text-anchor="middle" font-family="'Segoe UI', system-ui, sans-serif" font-size="30" font-weight="600" letter-spacing="3" fill-opacity="0.82">${escapeXml(label.toUpperCase())}</text>
  </g>
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
