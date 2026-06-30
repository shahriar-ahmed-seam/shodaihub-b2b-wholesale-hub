/**
 * Mock dataset for the B2B Wholesale Hub — a realistic Bangladeshi wholesale marketplace.
 *
 * This module is framework-neutral (no server-only imports) so it can be bundled into both the
 * server and the browser. All monetary values are in BDT (Bangladeshi Taka). The data here is
 * consumed by `engine.ts`, which maps API paths to these records.
 */

import type {
  AdminMetrics,
  Cart,
  CartSupplierGroup,
  KycSubmission,
  Order,
  OrderLine,
  OrderStatus,
  OrderSummary,
  PricingTier,
  Product,
  ProductReview,
  Role,
  SessionUser,
  StatusHistoryEntry,
  SubOrder,
} from '../api/types';
import { CATEGORY_IMAGES, HERO_IMAGES } from './images.generated';

export interface SupplierRecord {
  id: string;
  businessName: string;
  verificationStatus: 'VERIFIED' | 'UNDER_REVIEW' | 'REJECTED' | 'PENDING_VERIFICATION';
  rating: number;
  reviewCount: number;
}

/** The eight catalogue categories. */
export const CATEGORIES = [
  'Food & Grains',
  'Textiles & Apparel',
  'Beverages',
  'Home & Kitchen',
  'Eco & Packaging',
  'Electronics & Accessories',
  'Construction & Hardware',
  'Health & Beauty',
] as const;

export type Category = (typeof CATEGORIES)[number];

const CATEGORY_SLUGS: Record<Category, string> = {
  'Food & Grains': 'food-grains',
  'Textiles & Apparel': 'textiles',
  Beverages: 'beverages',
  'Home & Kitchen': 'home-kitchen',
  'Eco & Packaging': 'eco-packaging',
  'Electronics & Accessories': 'electronics',
  'Construction & Hardware': 'construction',
  'Health & Beauty': 'health-beauty',
};

export function categorySlug(category: string): string {
  return CATEGORY_SLUGS[category as Category] ?? 'general';
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

export const SUPPLIERS: SupplierRecord[] = [
  { id: 'sup-padma', businessName: 'Padma Wholesale Ltd', verificationStatus: 'VERIFIED', rating: 4.7, reviewCount: 312 },
  { id: 'sup-sundarban', businessName: 'Sundarban Traders', verificationStatus: 'VERIFIED', rating: 4.5, reviewCount: 198 },
  { id: 'sup-jamuna', businessName: 'Jamuna Textiles', verificationStatus: 'VERIFIED', rating: 4.6, reviewCount: 256 },
  { id: 'sup-sylhet', businessName: 'Sylhet Tea Estates', verificationStatus: 'VERIFIED', rating: 4.8, reviewCount: 421 },
  { id: 'sup-meghna', businessName: 'Meghna Foods & Beverages', verificationStatus: 'VERIFIED', rating: 4.4, reviewCount: 176 },
  { id: 'sup-tangail', businessName: 'Tangail Handloom House', verificationStatus: 'UNDER_REVIEW', rating: 4.3, reviewCount: 89 },
  { id: 'sup-bengal', businessName: 'Bengal Ceramics & Home', verificationStatus: 'VERIFIED', rating: 4.5, reviewCount: 143 },
  { id: 'sup-deshi', businessName: 'Deshi Eco Packaging', verificationStatus: 'UNDER_REVIEW', rating: 4.2, reviewCount: 64 },
];

/** The supplier whose catalogue/profile/fulfilment is shown when logging in as a SUPPLIER. */
export const DEMO_SUPPLIER_ID = 'sup-padma';

const supplierName = (id: string): string =>
  SUPPLIERS.find((s) => s.id === id)?.businessName ?? 'Unknown Supplier';

// ---------------------------------------------------------------------------
// Helpers to expand compact product seeds into full Product records
// ---------------------------------------------------------------------------

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Three decreasing-price pricing tiers derived from the base price and MOQ. */
function tiersFor(basePrice: number, moq: number): PricingTier[] {
  return [
    { minQty: moq, maxQty: moq * 5 - 1, unitPrice: round2(basePrice) },
    { minQty: moq * 5, maxQty: moq * 20 - 1, unitPrice: round2(basePrice * 0.93) },
    { minQty: moq * 20, maxQty: 1_000_000, unitPrice: round2(basePrice * 0.85) },
  ];
}

interface Seed {
  id: string;
  name: string;
  description: string;
  category: Category;
  basePrice: number;
  moq: number;
  stock: number;
  supplierId: string;
  reviews: ProductReview[];
}

function review(id: string, rating: number, text: string, retailerName: string, daysAgo: number): ProductReview {
  return { id, rating, text, retailerName, createdAt: daysAgo === 0 ? undefined : isoDaysAgo(daysAgo) };
}

function isoDaysAgo(days: number): string {
  return new Date(Date.UTC(2024, 9, 1) - days * 86_400_000).toISOString();
}

function expand(seed: Seed): Product {
  const ratings = seed.reviews.map((r) => r.rating);
  const averageRating = ratings.length ? round2(ratings.reduce((a, b) => a + b, 0) / ratings.length) : undefined;
  return {
    id: seed.id,
    name: seed.name,
    description: seed.description,
    category: seed.category,
    basePrice: round2(seed.basePrice),
    moq: seed.moq,
    stock: seed.stock,
    sellableQty: Math.max(0, seed.stock - Math.floor(seed.stock * 0.08)),
    status: 'PUBLISHED',
    supplierId: seed.supplierId,
    supplierName: supplierName(seed.supplierId),
    imageUrl: `/api/placeholder/${categorySlug(seed.category)}/${seed.id}`,
    tiers: tiersFor(seed.basePrice, seed.moq),
    averageRating,
    reviewCount: seed.reviews.length,
    reviews: seed.reviews,
  };
}

// ---------------------------------------------------------------------------
// Product catalogue (~38 products across 8 categories)
// ---------------------------------------------------------------------------

const SEEDS: Seed[] = [
  // ---- Food & Grains ----
  {
    id: 'p-miniket',
    name: 'Miniket Rice 50kg Sack',
    description: 'Premium polished Miniket rice, finely milled for everyday meals. Sourced from northern Bangladesh paddy fields.',
    category: 'Food & Grains',
    basePrice: 3450,
    moq: 10,
    stock: 820,
    supplierId: 'sup-padma',
    reviews: [
      review('r-miniket-1', 5, 'Consistent grain quality across every sack. My customers love it.', 'Karim General Store', 12),
      review('r-miniket-2', 4, 'Good price for bulk. Delivery to Dhaka was on time.', 'New Market Retail', 30),
      review('r-miniket-3', 5, 'Best Miniket I have sourced this season.', 'Mirpur Bazaar', 45),
    ],
  },
  {
    id: 'p-najirshail',
    name: 'Nazirshail Rice 25kg Sack',
    description: 'Slender aromatic Nazirshail rice, a staple favourite for biryani and polao across the region.',
    category: 'Food & Grains',
    basePrice: 1980,
    moq: 10,
    stock: 540,
    supplierId: 'sup-padma',
    reviews: [
      review('r-najir-1', 5, 'Aroma is excellent, repeat order placed.', 'Chittagong Bazaar', 8),
      review('r-najir-2', 4, 'Reliable supplier, packaging is sturdy.', 'Khulna Traders', 22),
    ],
  },
  {
    id: 'p-chinigura',
    name: 'Chinigura Aromatic Rice 5kg',
    description: 'Tiny fragrant Chinigura grains, the classic choice for festive polao and payesh.',
    category: 'Food & Grains',
    basePrice: 720,
    moq: 20,
    stock: 1200,
    supplierId: 'sup-padma',
    reviews: [
      review('r-chini-1', 5, 'Festival season bestseller in my shop.', 'Bashundhara Shop', 15),
      review('r-chini-2', 5, 'Authentic aroma, well sealed packs.', 'Sylhet Retail Hub', 40),
      review('r-chini-3', 4, 'Slightly pricey but quality justifies it.', 'Comilla Stores', 55),
    ],
  },
  {
    id: 'p-mustard-oil',
    name: 'Pure Mustard Oil 5L Tin',
    description: 'Cold-pressed kachi ghani mustard oil with a strong pungent aroma. Ideal for traditional Bengali cooking.',
    category: 'Food & Grains',
    basePrice: 1450,
    moq: 12,
    stock: 360,
    supplierId: 'sup-sundarban',
    reviews: [
      review('r-mustard-1', 5, 'Genuine ghani oil, customers can tell the difference.', 'Rahim General Store', 10),
      review('r-mustard-2', 4, 'Good margins on bulk tins.', 'Dhaka Mart', 28),
    ],
  },
  {
    id: 'p-lentil',
    name: 'Masoor Dal (Red Lentil) 25kg',
    description: 'Cleaned and graded red lentils with uniform colour and quick cook time.',
    category: 'Food & Grains',
    basePrice: 2750,
    moq: 8,
    stock: 410,
    supplierId: 'sup-sundarban',
    reviews: [
      review('r-lentil-1', 4, 'Low dust content, good quality lentils.', 'Jessore Wholesale', 18),
      review('r-lentil-2', 5, 'Fast restock turnaround.', 'Bogura Traders', 34),
    ],
  },
  {
    id: 'p-chickpea',
    name: 'Chola (Chickpea) 25kg Sack',
    description: 'Bold-size desi chickpeas, perfect for Ramadan demand and snack production.',
    category: 'Food & Grains',
    basePrice: 2300,
    moq: 8,
    stock: 280,
    supplierId: 'sup-padma',
    reviews: [
      review('r-chickpea-1', 5, 'Sold out during Ramadan, ordering more.', 'Old Dhaka Provisions', 20),
      review('r-chickpea-2', 4, 'Consistent size grading.', 'Tongi Bazaar', 50),
    ],
  },
  {
    id: 'p-atta',
    name: 'Whole Wheat Atta 50kg',
    description: 'Stone-ground whole wheat flour with high fibre, milled fresh weekly.',
    category: 'Food & Grains',
    basePrice: 2100,
    moq: 10,
    stock: 0,
    supplierId: 'sup-sundarban',
    reviews: [
      review('r-atta-1', 4, 'Good for ruti and paratha, soft dough.', 'Gazipur Retail', 24),
      review('r-atta-2', 5, 'Bakeries in my area buy this regularly.', 'Savar Stores', 38),
    ],
  },

  // ---- Textiles & Apparel ----
  {
    id: 'p-tangail-saree',
    name: 'Tangail Cotton Saree (Dozen)',
    description: 'Handloom Tangail cotton sarees with traditional jamdani-inspired borders. Sold per dozen, assorted colours.',
    category: 'Textiles & Apparel',
    basePrice: 9600,
    moq: 2,
    stock: 140,
    supplierId: 'sup-tangail',
    reviews: [
      review('r-tangail-1', 5, 'Beautiful weave, sells fast in my boutique.', 'Banani Boutique', 9),
      review('r-tangail-2', 5, 'Authentic handloom, great variety.', 'Rajshahi Cloth House', 26),
      review('r-tangail-3', 4, 'Colours as shown, good stitching.', 'Narayanganj Fabrics', 47),
    ],
  },
  {
    id: 'p-jamdani',
    name: 'Jamdani Saree Premium (Piece)',
    description: 'Exquisite handwoven Jamdani saree with fine muslin texture and intricate motifs. A heritage product.',
    category: 'Textiles & Apparel',
    basePrice: 5800,
    moq: 3,
    stock: 90,
    supplierId: 'sup-tangail',
    reviews: [
      review('r-jamdani-1', 5, 'Premium quality, customers willing to pay more.', 'Gulshan Saree Palace', 14),
      review('r-jamdani-2', 4, 'Delicate weave, packaging could be better.', 'Uttara Fashion', 33),
    ],
  },
  {
    id: 'p-rmg-knit',
    name: 'RMG Cotton Knit T-Shirt (Pack of 50)',
    description: 'Export-surplus 180 GSM combed cotton knit t-shirts, assorted sizes. Factory-fresh RMG stock.',
    category: 'Textiles & Apparel',
    basePrice: 7500,
    moq: 4,
    stock: 320,
    supplierId: 'sup-jamuna',
    reviews: [
      review('r-rmg-1', 5, 'Great GSM for the price, export quality.', 'Newmarket Garments', 7),
      review('r-rmg-2', 4, 'Size ratio was reasonable.', 'Chawkbazar Retail', 19),
      review('r-rmg-3', 5, 'Repeat buyer, never disappointed.', 'Feni Clothing', 41),
    ],
  },
  {
    id: 'p-panjabi',
    name: "Men's Cotton Panjabi (Dozen)",
    description: 'Tailored cotton panjabi with subtle embroidery, ideal for Eid season demand. Assorted sizes per dozen.',
    category: 'Textiles & Apparel',
    basePrice: 8400,
    moq: 2,
    stock: 210,
    supplierId: 'sup-jamuna',
    reviews: [
      review('r-panjabi-1', 5, 'Eid stock cleared in a week.', 'Mouchak Market Shop', 11),
      review('r-panjabi-2', 4, 'Good fabric, neat stitching.', 'Sylhet Mens Wear', 29),
    ],
  },
  {
    id: 'p-lungi',
    name: 'Premium Check Lungi (Dozen)',
    description: 'Mercerised cotton check lungi, colourfast and durable. Classic gift-grade quality.',
    category: 'Textiles & Apparel',
    basePrice: 4200,
    moq: 5,
    stock: 480,
    supplierId: 'sup-jamuna',
    reviews: [
      review('r-lungi-1', 4, 'Colours hold up after washing.', 'Barishal Bazaar', 16),
      review('r-lungi-2', 5, 'Soft fabric, steady seller.', 'Mymensingh Traders', 36),
    ],
  },
  {
    id: 'p-gamcha',
    name: 'Traditional Cotton Gamcha (Bundle of 30)',
    description: 'Lightweight, quick-dry handloom gamcha in vibrant traditional checks. Everyday essential.',
    category: 'Textiles & Apparel',
    basePrice: 2400,
    moq: 6,
    stock: 600,
    supplierId: 'sup-tangail',
    reviews: [
      review('r-gamcha-1', 5, 'Absorbent and durable, fast mover.', 'Tangail Local Store', 21),
      review('r-gamcha-2', 4, 'Good bundle pricing.', 'Pabna Retail', 44),
    ],
  },

  // ---- Beverages ----
  {
    id: 'p-sylhet-tea',
    name: 'Sylhet Black Tea Leaves 1kg (Case of 20)',
    description: 'Bold, malty CTC black tea from Sylhet estates. Strong liquor, perfect for roadside tea stalls.',
    category: 'Beverages',
    basePrice: 6800,
    moq: 5,
    stock: 260,
    supplierId: 'sup-sylhet',
    reviews: [
      review('r-tea-1', 5, 'Strong brew, tea stalls reorder weekly.', 'Zindabazar Provisions', 6),
      review('r-tea-2', 5, 'Best CTC value in the market.', 'Moulvibazar Stores', 23),
      review('r-tea-3', 4, 'Consistent quality across cases.', 'Habiganj Retail', 48),
    ],
  },
  {
    id: 'p-green-tea',
    name: 'Green Tea Loose Leaf 500g (Case of 24)',
    description: 'Hand-picked green tea with a fresh, grassy aroma. Growing demand among urban retailers.',
    category: 'Beverages',
    basePrice: 9600,
    moq: 3,
    stock: 150,
    supplierId: 'sup-sylhet',
    reviews: [
      review('r-green-1', 4, 'Premium segment moves well in cities.', 'Dhanmondi Mart', 13),
      review('r-green-2', 5, 'Lovely aroma, good repeat sales.', 'Banani Grocers', 31),
    ],
  },
  {
    id: 'p-mango-juice',
    name: 'Mango Fruit Drink 250ml (Carton of 24)',
    description: 'Sweet mango fruit drink in tetra packs. High summer demand, long shelf life.',
    category: 'Beverages',
    basePrice: 720,
    moq: 20,
    stock: 1400,
    supplierId: 'sup-meghna',
    reviews: [
      review('r-mango-1', 4, 'Kids favourite, summer bestseller.', 'Keraniganj Shop', 17),
      review('r-mango-2', 5, 'Good shelf life, no leakage in transit.', 'Munshiganj Retail', 35),
    ],
  },
  {
    id: 'p-mineral-water',
    name: 'Mineral Water 500ml (Carton of 24)',
    description: 'Triple-filtered drinking water in recyclable bottles. Steady year-round volume.',
    category: 'Beverages',
    basePrice: 320,
    moq: 30,
    stock: 2200,
    supplierId: 'sup-meghna',
    reviews: [
      review('r-water-1', 4, 'Reliable volume product, thin margins but steady.', 'Airport Road Store', 25),
      review('r-water-2', 5, 'Clean seals, never had a complaint.', 'Tejgaon Provisions', 52),
    ],
  },
  {
    id: 'p-soft-drink',
    name: 'Lemon Soft Drink 1L (Pack of 12)',
    description: 'Fizzy lemon-lime soft drink in PET bottles. Popular impulse purchase.',
    category: 'Beverages',
    basePrice: 960,
    moq: 15,
    stock: 880,
    supplierId: 'sup-meghna',
    reviews: [
      review('r-soft-1', 4, 'Good fizz, customers like the taste.', 'Wari Corner Shop', 27),
      review('r-soft-2', 5, 'Fast mover near schools.', 'Lalbagh Retail', 49),
    ],
  },

  // ---- Home & Kitchen ----
  {
    id: 'p-ceramic-plate',
    name: 'Ceramic Dinner Plate Set (Box of 12)',
    description: 'Glazed ceramic dinner plates with a clean white finish. Chip-resistant, restaurant-grade.',
    category: 'Home & Kitchen',
    basePrice: 3600,
    moq: 4,
    stock: 240,
    supplierId: 'sup-bengal',
    reviews: [
      review('r-plate-1', 5, 'Restaurants buy these in volume.', 'Gulistan Crockery', 12),
      review('r-plate-2', 4, 'Sturdy, minimal breakage in shipping.', 'Mohammadpur Home', 39),
    ],
  },
  {
    id: 'p-melamine',
    name: 'Melamine Bowl Set (Box of 24)',
    description: 'Durable melamine bowls in assorted sizes. Unbreakable and lightweight for daily use.',
    category: 'Home & Kitchen',
    basePrice: 2880,
    moq: 6,
    stock: 360,
    supplierId: 'sup-bengal',
    reviews: [
      review('r-melamine-1', 4, 'Good value, popular with households.', 'Mirpur Home Store', 20),
      review('r-melamine-2', 5, 'Colours stay vibrant.', 'Kushtia Traders', 43),
    ],
  },
  {
    id: 'p-steel-pot',
    name: 'Stainless Steel Cooking Pot 5L (Pack of 6)',
    description: 'Heavy-gauge stainless steel pots with riveted handles. Long-lasting commercial quality.',
    category: 'Home & Kitchen',
    basePrice: 7200,
    moq: 3,
    stock: 170,
    supplierId: 'sup-bengal',
    reviews: [
      review('r-pot-1', 5, 'Thick steel, no warping on high heat.', 'Karwan Bazar Utensils', 15),
      review('r-pot-2', 4, 'Good for catering customers.', 'Feni Kitchenware', 37),
    ],
  },
  {
    id: 'p-clay-pot',
    name: 'Traditional Clay Cooking Pot (Set of 10)',
    description: 'Hand-thrown terracotta cooking pots for authentic slow-cooked flavour. Eco-friendly.',
    category: 'Home & Kitchen',
    basePrice: 1500,
    moq: 8,
    stock: 220,
    supplierId: 'sup-bengal',
    reviews: [
      review('r-clay-1', 4, 'Niche but loyal customer base.', 'Old Town Pottery', 30),
      review('r-clay-2', 5, 'Authentic, sells well for biryani houses.', 'Puran Dhaka Store', 58),
    ],
  },
  {
    id: 'p-pressure-cooker',
    name: 'Aluminium Pressure Cooker 5L (Pack of 4)',
    description: 'ISI-style aluminium pressure cookers with safety valve. Trusted kitchen workhorse.',
    category: 'Home & Kitchen',
    basePrice: 5200,
    moq: 4,
    stock: 130,
    supplierId: 'sup-bengal',
    reviews: [
      review('r-cooker-1', 5, 'Safety valve works well, no complaints.', 'Narsingdi Hardware', 18),
      review('r-cooker-2', 4, 'Good weight and finish.', 'Bhola Retail', 46),
    ],
  },

  // ---- Eco & Packaging ----
  {
    id: 'p-jute-bag',
    name: 'Jute Shopping Bag (Bundle of 100)',
    description: 'Reusable laminated jute shopping bags with sturdy handles. Sustainable Bangladeshi golden fibre.',
    category: 'Eco & Packaging',
    basePrice: 4500,
    moq: 5,
    stock: 500,
    supplierId: 'sup-deshi',
    reviews: [
      review('r-jutebag-1', 5, 'Eco demand rising, great branding option.', 'Green Retail Co', 10),
      review('r-jutebag-2', 4, 'Strong handles, good print surface.', 'Dhaka Eco Mart', 32),
    ],
  },
  {
    id: 'p-jute-sack',
    name: 'Jute Sack 50kg (Bundle of 50)',
    description: 'Heavy-duty woven jute sacks for grain and produce storage. Breathable and biodegradable.',
    category: 'Eco & Packaging',
    basePrice: 3750,
    moq: 4,
    stock: 380,
    supplierId: 'sup-deshi',
    reviews: [
      review('r-jutesack-1', 4, 'Standard for grain storage, reliable.', 'Naogaon Agro', 22),
      review('r-jutesack-2', 5, 'Tight weave, no spillage.', 'Dinajpur Traders', 41),
    ],
  },
  {
    id: 'p-paper-bag',
    name: 'Kraft Paper Bag (Pack of 500)',
    description: 'Food-grade kraft paper bags for takeaway and grocery. Plastic-free packaging solution.',
    category: 'Eco & Packaging',
    basePrice: 2200,
    moq: 10,
    stock: 900,
    supplierId: 'sup-deshi',
    reviews: [
      review('r-paperbag-1', 5, 'Restaurants switching to these fast.', 'Foodpack Supplies', 9),
      review('r-paperbag-2', 4, 'Good thickness, holds weight.', 'Cumilla Packaging', 27),
    ],
  },
  {
    id: 'p-bamboo-straw',
    name: 'Bamboo Drinking Straw (Box of 200)',
    description: 'Reusable natural bamboo straws, an eco alternative for cafes and juice bars.',
    category: 'Eco & Packaging',
    basePrice: 1800,
    moq: 10,
    stock: 640,
    supplierId: 'sup-deshi',
    reviews: [
      review('r-straw-1', 4, 'Cafes love the eco angle.', 'Cafe Supply BD', 14),
      review('r-straw-2', 5, 'Smooth finish, no splinters.', 'Sustainable Shop', 38),
    ],
  },
  {
    id: 'p-cardboard-box',
    name: 'Corrugated Cardboard Box (Bundle of 100)',
    description: '3-ply corrugated shipping boxes, flat-packed. Essential for e-commerce fulfilment.',
    category: 'Eco & Packaging',
    basePrice: 3300,
    moq: 8,
    stock: 720,
    supplierId: 'sup-padma',
    reviews: [
      review('r-box-1', 5, 'Strong boxes, perfect for courier shipments.', 'Ecom Logistics Store', 11),
      review('r-box-2', 4, 'Consistent sizing, easy to assemble.', 'Pickaboo Reseller', 33),
    ],
  },

  // ---- Electronics & Accessories ----
  {
    id: 'p-led-bulb',
    name: 'LED Bulb 9W (Pack of 10)',
    description: 'Energy-saving 9W LED bulbs, B22 base, cool daylight. 2-year service life.',
    category: 'Electronics & Accessories',
    basePrice: 1100,
    moq: 12,
    stock: 1500,
    supplierId: 'sup-sundarban',
    reviews: [
      review('r-led-1', 5, 'Bright and efficient, low return rate.', 'Nawabpur Electronics', 8),
      review('r-led-2', 4, 'Good value pack for retailers.', 'Stadium Market Store', 24),
      review('r-led-3', 5, 'Steady seller, reliable supplier.', 'Bijoy Sarani Retail', 50),
    ],
  },
  {
    id: 'p-extension',
    name: 'Power Extension Strip 4-Socket (Pack of 6)',
    description: 'Surge-protected 4-socket extension boards with 2m cable. Copper wiring, BSTI compliant.',
    category: 'Electronics & Accessories',
    basePrice: 2400,
    moq: 6,
    stock: 420,
    supplierId: 'sup-sundarban',
    reviews: [
      review('r-ext-1', 4, 'Solid build, good copper wiring.', 'Patuatuli Electronics', 19),
      review('r-ext-2', 5, 'No safety issues, customers trust it.', 'Gulshan Hardware', 42),
    ],
  },
  {
    id: 'p-usb-cable',
    name: 'USB-C Charging Cable 1m (Pack of 50)',
    description: 'Fast-charge USB-C cables with braided jacket. High-turnover accessory line.',
    category: 'Electronics & Accessories',
    basePrice: 3500,
    moq: 4,
    stock: 760,
    supplierId: 'sup-sundarban',
    reviews: [
      review('r-usb-1', 4, 'Durable braiding, good margins.', 'Mobile Accessory Hub', 13),
      review('r-usb-2', 5, 'Fast charging confirmed, low defects.', 'Elephant Road Store', 36),
    ],
  },
  {
    id: 'p-ceiling-fan',
    name: 'Energy-Saving Ceiling Fan 56" (Pack of 4)',
    description: 'High-speed 56-inch ceiling fans with copper motor. Low power draw, quiet operation.',
    category: 'Electronics & Accessories',
    basePrice: 12800,
    moq: 2,
    stock: 95,
    supplierId: 'sup-sundarban',
    reviews: [
      review('r-fan-1', 5, 'Copper motor lasts, strong air delivery.', 'Comfort Electronics', 16),
      review('r-fan-2', 4, 'Quiet and efficient, good summer sales.', 'Rangpur Appliances', 44),
    ],
  },

  // ---- Construction & Hardware ----
  {
    id: 'p-cement',
    name: 'Portland Cement 50kg (Pallet of 40)',
    description: 'CEM-II Portland composite cement, high early strength. BDS-certified for structural work.',
    category: 'Construction & Hardware',
    basePrice: 21500,
    moq: 2,
    stock: 160,
    supplierId: 'sup-padma',
    reviews: [
      review('r-cement-1', 5, 'Strong set, contractors prefer this brand.', 'Savar Construction Supply', 9),
      review('r-cement-2', 4, 'Reliable delivery for site orders.', 'Ashulia Hardware', 28),
    ],
  },
  {
    id: 'p-mssrod',
    name: 'MS Deformed Steel Rod 12mm (Bundle, 1 Tonne)',
    description: '500W grade deformed MS rods for RCC construction. Consistent diameter and yield strength.',
    category: 'Construction & Hardware',
    basePrice: 92000,
    moq: 1,
    stock: 70,
    supplierId: 'sup-padma',
    reviews: [
      review('r-rod-1', 5, 'Grade as specified, mill test report provided.', 'Keraniganj Builders', 21),
      review('r-rod-2', 4, 'Good price for tonnage orders.', 'Gazipur Construction', 47),
    ],
  },
  {
    id: 'p-paint',
    name: 'Weather Coat Exterior Paint 20L (Drum)',
    description: 'Acrylic exterior emulsion with UV and rain resistance. Smooth matte finish, wide colour base.',
    category: 'Construction & Hardware',
    basePrice: 8800,
    moq: 4,
    stock: 210,
    supplierId: 'sup-bengal',
    reviews: [
      review('r-paint-1', 4, 'Good coverage, holds colour outdoors.', 'Paint World Dhaka', 17),
      review('r-paint-2', 5, 'Contractors reorder for building projects.', 'Chattogram Paints', 40),
    ],
  },

  // ---- Health & Beauty ----
  {
    id: 'p-coconut-oil',
    name: 'Coconut Hair Oil 200ml (Carton of 12)',
    description: 'Pure coconut hair oil enriched with amla. Trusted daily-use grooming staple.',
    category: 'Health & Beauty',
    basePrice: 1560,
    moq: 12,
    stock: 980,
    supplierId: 'sup-meghna',
    reviews: [
      review('r-coconut-1', 5, 'Everyday seller, strong brand pull.', 'Beauty Corner Store', 12),
      review('r-coconut-2', 4, 'Good packaging, no leakage.', 'New Market Cosmetics', 34),
    ],
  },
  {
    id: 'p-soap',
    name: 'Herbal Beauty Soap (Box of 72)',
    description: 'Neem and turmeric herbal beauty soap bars. Skin-friendly, popular gift-pack item.',
    category: 'Health & Beauty',
    basePrice: 2880,
    moq: 6,
    stock: 1100,
    supplierId: 'sup-meghna',
    reviews: [
      review('r-soap-1', 4, 'Pleasant fragrance, steady demand.', 'Wari Cosmetics', 23),
      review('r-soap-2', 5, 'Herbal angle helps it sell.', 'Tongi General Store', 45),
    ],
  },
  {
    id: 'p-toothpaste',
    name: 'Herbal Toothpaste 100g (Carton of 24)',
    description: 'Fluoride herbal toothpaste with clove and neem. Family-size tubes, fast retail turnover.',
    category: 'Health & Beauty',
    basePrice: 1440,
    moq: 12,
    stock: 1320,
    supplierId: 'sup-meghna',
    reviews: [
      review('r-tooth-1', 5, 'High repeat purchase item.', 'Daily Needs Store', 15),
      review('r-tooth-2', 4, 'Good shelf rotation, fair price.', 'Family Mart BD', 37),
    ],
  },
];

export const PRODUCTS: Product[] = assignImages(SEEDS.map(expand));

/**
 * Replace placeholder thumbnails with real Unsplash photography when the generated catalogue is
 * populated (after `npm run fetch:images`). Each category's pool is distributed round-robin across
 * that category's products. When a pool is empty, the SVG placeholder set by `expand()` is kept.
 */
function assignImages(products: Product[]): Product[] {
  const seen: Record<string, number> = {};
  for (const p of products) {
    const slug = categorySlug(p.category);
    const pool = CATEGORY_IMAGES[slug] ?? [];
    if (pool.length === 0) continue;
    const i = seen[slug] ?? 0;
    seen[slug] = i + 1;
    const img = pool[i % pool.length]!;
    p.imageUrl = img.url;
    p.imageCredit = { name: img.authorName, url: img.authorUrl };
  }
  return products;
}

/** The lead hero photograph (≈4K) when available, else null (landing falls back to SVG art). */
export const HERO_IMAGE = HERO_IMAGES[0] ?? null;

export function productById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

// ---------------------------------------------------------------------------
// Order / sub-order construction helpers
// ---------------------------------------------------------------------------

const HOUR = 3_600_000;
const DAY = 86_400_000;
/** Fixed reference timestamp so the timelines are deterministic across renders. */
const TIMELINE_BASE = Date.UTC(2024, 9, 5, 10, 0, 0);

const iso = (ms: number): string => new Date(ms).toISOString();

const STATUS_FLOW: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED'];

function statusRank(status: OrderStatus): number {
  if (status === 'CANCELLED') return 99;
  return STATUS_FLOW.indexOf(status);
}

function historyFor(status: OrderStatus, placedAtMs: number): { history: StatusHistoryEntry[]; lastUpdatedAt: string } {
  let history: StatusHistoryEntry[];
  if (status === 'CANCELLED') {
    history = [
      { status: 'PENDING', at: iso(placedAtMs) },
      { status: 'CONFIRMED', at: iso(placedAtMs + 2 * HOUR) },
      { status: 'CANCELLED', at: iso(placedAtMs + 6 * HOUR) },
    ];
  } else {
    const idx = STATUS_FLOW.indexOf(status);
    history = STATUS_FLOW.slice(0, idx + 1).map((s, i) => ({ status: s, at: iso(placedAtMs + i * 9 * HOUR) }));
  }
  return { history, lastUpdatedAt: history[history.length - 1]!.at };
}

function buildLines(items: Array<[string, number]>): OrderLine[] {
  return items.map(([productId, quantity]) => {
    const product = productById(productId);
    const unitPrice = product ? product.basePrice : 0;
    return {
      productId,
      productName: product?.name ?? productId,
      quantity,
      unitPrice,
      subtotal: round2(unitPrice * quantity),
      imageUrl: product?.imageUrl,
    };
  });
}

interface SubConfig {
  id: string;
  supplierId: string;
  status: OrderStatus;
  items: Array<[string, number]>;
  trackingRef?: string;
}

function buildSubOrder(cfg: SubConfig, placedAtMs: number): SubOrder {
  const lines = buildLines(cfg.items);
  const total = round2(lines.reduce((sum, l) => sum + l.subtotal, 0));
  const { history, lastUpdatedAt } = historyFor(cfg.status, placedAtMs);
  const shipped = cfg.status === 'SHIPPED' || cfg.status === 'DELIVERED';
  return {
    id: cfg.id,
    supplierId: cfg.supplierId,
    supplierName: supplierName(cfg.supplierId),
    status: cfg.status,
    total,
    lines,
    trackingRef: shipped ? cfg.trackingRef ?? `BD-${cfg.id.slice(-6).toUpperCase()}` : undefined,
    statusHistory: history,
    lastUpdatedAt,
  };
}

interface OrderConfig {
  id: string;
  daysAgo: number;
  subs: SubConfig[];
}

const ORDER_CONFIGS: OrderConfig[] = [
  {
    id: '9f12ab34-0001',
    daysAgo: 1,
    subs: [
      { id: 'so-0001-a', supplierId: 'sup-padma', status: 'PENDING', items: [['p-miniket', 20], ['p-chinigura', 30]] },
    ],
  },
  {
    id: '7c83de91-0002',
    daysAgo: 2,
    subs: [
      { id: 'so-0002-a', supplierId: 'sup-meghna', status: 'CONFIRMED', items: [['p-mango-juice', 40], ['p-mineral-water', 50]] },
      { id: 'so-0002-b', supplierId: 'sup-sylhet', status: 'CONFIRMED', items: [['p-sylhet-tea', 8]] },
    ],
  },
  {
    id: 'a45f9b22-0003',
    daysAgo: 3,
    subs: [
      { id: 'so-0003-a', supplierId: 'sup-jamuna', status: 'PACKED', items: [['p-rmg-knit', 6], ['p-panjabi', 4]] },
    ],
  },
  {
    id: 'b67c1d83-0004',
    daysAgo: 4,
    subs: [
      { id: 'so-0004-a', supplierId: 'sup-bengal', status: 'SHIPPED', items: [['p-ceramic-plate', 10], ['p-steel-pot', 4]], trackingRef: 'SUNDARBAN-CR-4471' },
    ],
  },
  {
    id: 'c89e2f04-0005',
    daysAgo: 6,
    subs: [
      { id: 'so-0005-a', supplierId: 'sup-sylhet', status: 'DELIVERED', items: [['p-sylhet-tea', 10], ['p-green-tea', 5]] },
      { id: 'so-0005-b', supplierId: 'sup-meghna', status: 'DELIVERED', items: [['p-soft-drink', 20]] },
    ],
  },
  {
    id: 'd01a3b65-0006',
    daysAgo: 7,
    subs: [
      { id: 'so-0006-a', supplierId: 'sup-padma', status: 'SHIPPED', items: [['p-cement', 4]], trackingRef: 'PADMA-EXP-9920' },
    ],
  },
  {
    id: 'e23b4c96-0007',
    daysAgo: 9,
    subs: [
      { id: 'so-0007-a', supplierId: 'sup-deshi', status: 'CANCELLED', items: [['p-jute-bag', 6], ['p-paper-bag', 10]] },
    ],
  },
  {
    id: 'f45c5d17-0008',
    daysAgo: 11,
    subs: [
      { id: 'so-0008-a', supplierId: 'sup-sundarban', status: 'DELIVERED', items: [['p-led-bulb', 20], ['p-usb-cable', 6]] },
      { id: 'so-0008-b', supplierId: 'sup-bengal', status: 'PACKED', items: [['p-melamine', 8]] },
    ],
  },
  {
    id: '1a2b3c48-0009',
    daysAgo: 14,
    subs: [
      { id: 'so-0009-a', supplierId: 'sup-tangail', status: 'DELIVERED', items: [['p-tangail-saree', 4], ['p-gamcha', 8]] },
    ],
  },
  {
    id: '2b3c4d59-0010',
    daysAgo: 18,
    subs: [
      { id: 'so-0010-a', supplierId: 'sup-meghna', status: 'DELIVERED', items: [['p-coconut-oil', 15], ['p-toothpaste', 20], ['p-soap', 10]] },
    ],
  },
];

function buildOrder(cfg: OrderConfig): Order {
  const placedAtMs = TIMELINE_BASE - cfg.daysAgo * DAY;
  const subOrders = cfg.subs.map((s) => buildSubOrder(s, placedAtMs));
  return {
    id: cfg.id,
    total: round2(subOrders.reduce((sum, s) => sum + s.total, 0)),
    placedAt: iso(placedAtMs),
    subOrders,
  };
}

export const RETAILER_ORDERS: Order[] = ORDER_CONFIGS.map(buildOrder);

export function orderById(id: string): Order | undefined {
  return RETAILER_ORDERS.find((o) => o.id === id);
}

export function orderSummaries(): OrderSummary[] {
  return RETAILER_ORDERS.map((o) => {
    const latestStatus = o.subOrders
      .map((s) => s.status)
      .reduce((acc, s) => (statusRank(s) < statusRank(acc) ? s : acc), o.subOrders[0]!.status);
    return {
      id: o.id,
      total: o.total,
      placedAt: o.placedAt,
      subOrderCount: o.subOrders.length,
      latestStatus,
    };
  });
}

// ---------------------------------------------------------------------------
// Supplier fulfilment board sub-orders (for the logged-in demo supplier)
// ---------------------------------------------------------------------------

const SUPPLIER_SUB_CONFIGS: SubConfig[] = [
  { id: 'fso-2001', supplierId: DEMO_SUPPLIER_ID, status: 'CONFIRMED', items: [['p-miniket', 30], ['p-najirshail', 20]] },
  { id: 'fso-2002', supplierId: DEMO_SUPPLIER_ID, status: 'CONFIRMED', items: [['p-chinigura', 40]] },
  { id: 'fso-2003', supplierId: DEMO_SUPPLIER_ID, status: 'PACKED', items: [['p-chickpea', 16], ['p-cardboard-box', 8]] },
  { id: 'fso-2004', supplierId: DEMO_SUPPLIER_ID, status: 'PACKED', items: [['p-cement', 2]] },
  { id: 'fso-2005', supplierId: DEMO_SUPPLIER_ID, status: 'SHIPPED', items: [['p-mssrod', 1]], trackingRef: 'PADMA-EXP-7731' },
  { id: 'fso-2006', supplierId: DEMO_SUPPLIER_ID, status: 'SHIPPED', items: [['p-miniket', 50]], trackingRef: 'PADMA-EXP-7732' },
  { id: 'fso-2007', supplierId: DEMO_SUPPLIER_ID, status: 'DELIVERED', items: [['p-chinigura', 60]] },
  { id: 'fso-2008', supplierId: DEMO_SUPPLIER_ID, status: 'DELIVERED', items: [['p-najirshail', 30], ['p-cardboard-box', 10]] },
];

export const SUPPLIER_SUBORDERS: SubOrder[] = SUPPLIER_SUB_CONFIGS.map((cfg, i) =>
  buildSubOrder(cfg, TIMELINE_BASE - (i + 1) * DAY),
);

// ---------------------------------------------------------------------------
// Cart (multi-vendor). Reservation expiry is computed fresh on each access.
// ---------------------------------------------------------------------------

interface CartItemSeed {
  id: string;
  productId: string;
  quantity: number;
  renewalCount: number;
}

interface CartGroupSeed {
  supplierId: string;
  items: CartItemSeed[];
}

const CART_GROUP_SEEDS: CartGroupSeed[] = [
  {
    supplierId: 'sup-padma',
    items: [
      { id: 'ci-1', productId: 'p-miniket', quantity: 15, renewalCount: 0 },
      { id: 'ci-2', productId: 'p-chinigura', quantity: 25, renewalCount: 1 },
    ],
  },
  {
    supplierId: 'sup-sylhet',
    items: [{ id: 'ci-3', productId: 'p-sylhet-tea', quantity: 6, renewalCount: 0 }],
  },
  {
    supplierId: 'sup-meghna',
    items: [
      { id: 'ci-4', productId: 'p-mango-juice', quantity: 30, renewalCount: 2 },
      { id: 'ci-5', productId: 'p-mineral-water', quantity: 40, renewalCount: 0 },
    ],
  },
];

/** Build the cart with a fresh ~13-minute reservation window from "now". */
export function buildCart(): Cart {
  const expiresAt = new Date(Date.now() + 13 * 60 * 1000).toISOString();
  const groups: CartSupplierGroup[] = CART_GROUP_SEEDS.map((g) => {
    const items = g.items.map((seed) => {
      const product = productById(seed.productId);
      const unitPrice = product ? product.basePrice : 0;
      return {
        id: seed.id,
        productId: seed.productId,
        productName: product?.name ?? seed.productId,
        quantity: seed.quantity,
        unitPrice,
        subtotal: round2(unitPrice * seed.quantity),
        reservationId: `res-${seed.id}`,
        reservationExpiresAt: expiresAt,
        renewalCount: seed.renewalCount,
        imageUrl: product?.imageUrl,
      };
    });
    return {
      supplierId: g.supplierId,
      supplierName: supplierName(g.supplierId),
      items,
      subtotal: round2(items.reduce((sum, it) => sum + it.subtotal, 0)),
    };
  });
  return {
    groups,
    combinedTotal: round2(groups.reduce((sum, g) => sum + g.subtotal, 0)),
  };
}

// ---------------------------------------------------------------------------
// Admin: KYC queue + metrics
// ---------------------------------------------------------------------------

export const KYC_SUBMISSIONS: KycSubmission[] = [
  { id: 'kyc-1', supplierId: 'sup-tangail', businessName: 'Tangail Handloom House', tradeLicense: 'TRAD/DHK/2023/118934', bankAccount: 'DBBL-1042-882910', status: 'UNDER_REVIEW', submittedAt: iso(TIMELINE_BASE - 2 * DAY) },
  { id: 'kyc-2', supplierId: 'sup-deshi', businessName: 'Deshi Eco Packaging', tradeLicense: 'TRAD/DHK/2024/220471', bankAccount: 'BRAC-2210-553120', status: 'UNDER_REVIEW', submittedAt: iso(TIMELINE_BASE - 1 * DAY) },
  { id: 'kyc-3', supplierId: 'sup-newvendor-1', businessName: 'Rupsha Spice Mills', tradeLicense: 'TRAD/KHL/2024/771203', bankAccount: 'CITY-7781-009823', status: 'UNDER_REVIEW', submittedAt: iso(TIMELINE_BASE - 4 * DAY) },
  { id: 'kyc-4', supplierId: 'sup-padma', businessName: 'Padma Wholesale Ltd', tradeLicense: 'TRAD/DHK/2021/004412', bankAccount: 'EBL-3320-118277', status: 'VERIFIED', submittedAt: iso(TIMELINE_BASE - 40 * DAY) },
  { id: 'kyc-5', supplierId: 'sup-newvendor-2', businessName: 'Teesta Agro Exports', tradeLicense: 'TRAD/RNG/2024/556621', bankAccount: 'IFIC-9920-447781', status: 'REJECTED', submittedAt: iso(TIMELINE_BASE - 9 * DAY) },
  { id: 'kyc-6', supplierId: 'sup-sylhet', businessName: 'Sylhet Tea Estates', tradeLicense: 'TRAD/SYL/2020/889112', bankAccount: 'SCB-1190-330092', status: 'VERIFIED', submittedAt: iso(TIMELINE_BASE - 60 * DAY) },
];

export const ADMIN_METRICS: AdminMetrics = {
  suppliers: 48,
  retailers: 1264,
  products: 1893,
  orders: 5712,
};

// ---------------------------------------------------------------------------
// Session users (demo accounts) + role helpers
// ---------------------------------------------------------------------------

export const DEMO_ACCOUNTS: Record<Role, { email: string; businessName: string; id: string }> = {
  RETAILER: { email: 'retailer@shodaihub.test', businessName: 'Karim General Store', id: 'usr-retailer-1' },
  SUPPLIER: { email: 'supplier@shodaihub.test', businessName: 'Padma Wholesale Ltd', id: 'usr-supplier-1' },
  ADMINISTRATOR: { email: 'admin@shodaihub.test', businessName: 'ShodaiHub Operations', id: 'usr-admin-1' },
};

/** Infer the role from an email address (demo heuristic). */
export function roleForEmail(email: string): Role {
  const lower = email.toLowerCase();
  if (lower.includes('supplier')) return 'SUPPLIER';
  if (lower.includes('admin')) return 'ADMINISTRATOR';
  return 'RETAILER';
}

function businessNameForEmail(email: string, role: Role): string {
  const known = Object.values(DEMO_ACCOUNTS).find((a) => a.email === email.toLowerCase());
  if (known) return known.businessName;
  const local = email.split('@')[0] ?? 'demo';
  const titled = local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
  if (role === 'SUPPLIER') return titled ? `${titled} Trading` : 'Demo Supplier';
  if (role === 'ADMINISTRATOR') return 'ShodaiHub Operations';
  return titled ? `${titled} Store` : 'Demo Retailer';
}

export function buildSessionUser(email: string, role?: Role, businessName?: string): SessionUser {
  const resolvedRole = role ?? roleForEmail(email);
  const known = Object.values(DEMO_ACCOUNTS).find((a) => a.email === email.toLowerCase());
  return {
    id: known?.id ?? `usr-${Math.abs(hashCode(email)).toString(36)}`,
    email,
    businessName: businessName ?? businessNameForEmail(email, resolvedRole),
    role: resolvedRole,
    status: 'ACTIVE',
    preferredLanguage: 'en',
  };
}

function hashCode(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export interface SupplierProfileRecord {
  supplierId: string;
  businessName: string;
  verificationStatus: string;
}

export function supplierProfileFor(supplierId: string = DEMO_SUPPLIER_ID): SupplierProfileRecord {
  const sup = SUPPLIERS.find((s) => s.id === supplierId) ?? SUPPLIERS[0]!;
  return { supplierId: sup.id, businessName: sup.businessName, verificationStatus: sup.verificationStatus };
}
