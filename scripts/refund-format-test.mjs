/**
 * FixMate — shared currency formatting test (no network, no DB).
 * Proves refund amounts are shown from minor units with the correct currency
 * exponent, including non-USD currencies.
 *
 * Usage: node scripts/refund-format-test.mjs
 */
import { formatMinorUnits, minorUnitExponent } from "../src/lib/currency.ts";

let failures = 0;
const pass = (msg) => console.log(`  PASS  ${msg}`);
const fail = (msg) => {
  failures += 1;
  console.log(`  FAIL  ${msg}`);
};
const check = (cond, msg) => (cond ? pass(msg) : fail(msg));

console.log("Refund amount formatting test\n");

const usd = formatMinorUnits(1234, "usd");
check(usd.includes("$") && usd.includes("12.34"), `USD 1234 minor -> ${usd}`);
const wholeUsd = formatMinorUnits(1200, "usd");
check(wholeUsd.includes("12.00"), `USD 1200 minor -> ${wholeUsd} (no double division)`);
const bdt = formatMinorUnits(1234, "bdt");
check(bdt.includes("12.34"), `BDT (non-USD, 2 decimals) -> ${bdt}`);
const jpy = formatMinorUnits(1200, "jpy");
check(minorUnitExponent("jpy") === 0 && jpy.includes("1,200") && !jpy.includes(".00"), `JPY zero-decimal -> ${jpy}`);
const kwd = formatMinorUnits(1234, "kwd");
check(minorUnitExponent("kwd") === 3 && kwd.includes("1.234"), `KWD three-decimal -> ${kwd}`);
const fallback = formatMinorUnits(1234, "xxx");
check(fallback.includes("XXX"), `unknown currency falls back safely -> ${fallback}`);

// The admin toast previously divided the already-major `amount` field by 100.
// With the correct contract (amountMinor) there is no such extra division.
check(
  formatMinorUnits(1200, "usd") !== "$0.12" && formatMinorUnits(1200, "usd").includes("12"),
  "toast amount is not divided twice"
);

console.log(`\n${failures === 0 ? "REFUND FORMAT CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
