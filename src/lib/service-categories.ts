/**
 * Canonical FixMate service categories (Assignment 9).
 *
 * This is the single source of truth used by the homepage (Popular Categories,
 * Popular Services, footer), the Services listing/filters, and the technician
 * service forms. The legacy values are kept **only** for compatibility: they
 * are never shown as primary options, but existing records that still carry
 * them are not discarded or hidden.
 */

/** The seven exact assignment categories. Display names === stored values. */
export const SERVICE_CATEGORIES = [
  "Smartphone",
  "Laptop & PC",
  "AC",
  "Refrigerator",
  "TV",
  "Washing Machine",
  "Electrical",
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

/** Older category values that can still exist in the database. */
export const LEGACY_SERVICE_CATEGORIES = [
  "Mobile Repair",
  "Laptop Repair",
  "Refrigerator Repair",
  "AC Repair",
  "TV Repair",
  "Home Appliance Repair",
] as const;

export type LegacyServiceCategory = (typeof LEGACY_SERVICE_CATEGORIES)[number];

/** Every value the API may legitimately return or accept. */
export const ALL_SERVICE_CATEGORIES = [
  ...SERVICE_CATEGORIES,
  ...LEGACY_SERVICE_CATEGORIES,
] as const;

export type AnyServiceCategory = (typeof ALL_SERVICE_CATEGORIES)[number];

/**
 * Unambiguous legacy -> canonical mapping.
 *
 * "Home Appliance Repair" is intentionally NOT mapped: it spans several
 * canonical categories (AC, Refrigerator, TV, Washing Machine, Electrical)
 * and mapping it would be a guess. Those records keep their original value
 * and remain discoverable through "All categories" and a direct filter.
 */
export const LEGACY_CATEGORY_MAP: Partial<
  Record<LegacyServiceCategory, ServiceCategory>
> = {
  "Mobile Repair": "Smartphone",
  "Laptop Repair": "Laptop & PC",
  "Refrigerator Repair": "Refrigerator",
  "AC Repair": "AC",
  "TV Repair": "TV",
};

export function isCanonicalCategory(value: string): value is ServiceCategory {
  return (SERVICE_CATEGORIES as readonly string[]).includes(value);
}

export function isKnownCategory(value: string): value is AnyServiceCategory {
  return (ALL_SERVICE_CATEGORIES as readonly string[]).includes(value);
}

/** Canonical value for a legacy alias, or null when no safe mapping exists. */
export function canonicalizeCategory(value: string): ServiceCategory | null {
  if (isCanonicalCategory(value)) return value;
  return LEGACY_CATEGORY_MAP[value as LegacyServiceCategory] ?? null;
}

/** Safe display name: canonical where possible, otherwise the stored value. */
export function displayCategory(value: string): AnyServiceCategory {
  return canonicalizeCategory(value) ?? (value as AnyServiceCategory);
}

/**
 * Normalise an incoming URL/form value. Known legacy values that map cleanly
 * become canonical; the ambiguous "Home Appliance Repair" is left untouched;
 * unknown values are dropped (empty string).
 */
export function normalizeCategoryInput(value: string): AnyServiceCategory | "" {
  const canonical = canonicalizeCategory(value);
  if (canonical) return canonical;
  return isKnownCategory(value) ? value : "";
}

/** Filtered-services destination for a canonical category card/link. */
export function categoryHref(category: ServiceCategory): string {
  return `/services?category=${encodeURIComponent(category)}`;
}
