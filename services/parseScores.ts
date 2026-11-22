// Reading typed test scores. No imports, so Node's test runner can load it directly.

export function parsePositive(s: string): number | undefined {
  const n = parseFloat(s.trim());
  return /^\d+(\.\d+)?$/.test(s.trim()) && n > 0 ? n : undefined;
}

// A Bronco takes minutes, so anything outside 3:00-15:00 is a typo: "5.05" (meant 5:05) would
// otherwise be saved as 5 seconds and become the player's best.
const BRONCO_MIN = 180;
const BRONCO_MAX = 900;

export function parseBronco(s: string): number | undefined {
  const v = s.trim();
  const m = v.match(/^(\d{1,2}):([0-5]\d(?:\.\d+)?)$/);
  const sec = m ? parseInt(m[1]) * 60 + parseFloat(m[2]) : parsePositive(v);
  return sec !== undefined && sec >= BRONCO_MIN && sec <= BRONCO_MAX ? sec : undefined;
}

// Phone number pads have no colon, so the Bronco box takes digits and puts the colon in:
// 524 → 5:24, 1003 → 10:03. Anything that isn't a digit (a dot, a typed colon) is dropped first.
export function formatBroncoTyping(s: string): string {
  const d = s.replace(/\D/g, '').slice(0, 4);
  return d.length >= 3 ? `${d.slice(0, -2)}:${d.slice(-2)}` : d;
}

// Other boxes: digits and one decimal point (a comma counts as the point).
export function numbersOnly(s: string): string {
  const t = s.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const i = t.indexOf('.');
  return i < 0 ? t : t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, '');
}
