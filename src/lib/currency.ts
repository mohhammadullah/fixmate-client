/**
 * FixMate client currency formatting.
 *
 * Backend monetary fields are stored in minor units in `payment.amount` and
 * `refund.amountMinor`. The exponent depends on the ISO 4217 currency; using
 * a hardcoded /100 misreports zero- and three-decimal currencies. No React or
 * network dependencies here so formatting is unit-testable.
 */

const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf",
  "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

const THREE_DECIMAL_CURRENCIES = new Set(["bhd", "jod", "kwd", "omr", "tnd"]);

export const minorUnitExponent = (currency: string): number => {
  const code = currency.trim().toLowerCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3;
  return 2;
};

/** Format a minor-unit amount using the currency's real exponent. */
export function formatMinorUnits(amountMinor: number, currency: string): string {
  const exponent = minorUnitExponent(currency);
  const major = amountMinor / 10 ** exponent;
  const code = currency.trim().toUpperCase();
  // Unknown codes still format with a generic "¤" symbol; use an explicit
  // fallback instead so the report is unambiguous.
  const supported =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("currency")
      : null;
  if (supported && !supported.includes(code)) {
    return `${major.toFixed(exponent)} ${code}`;
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
    }).format(major);
  } catch {
    return `${major.toFixed(exponent)} ${code}`;
  }
}
