const FALLBACK_COLOR = "#64748b";

function normalizeHex(value: string): string {
  const color = value.trim().toLowerCase();
  const short = /^#([0-9a-f]{3})$/.exec(color);
  if (short) {
    return `#${[...short[1]].map((digit) => digit + digit).join("")}`;
  }
  return /^#[0-9a-f]{6}$/.test(color) ? color : FALLBACK_COLOR;
}

function channel(hex: string, start: number): number {
  return Number.parseInt(hex.slice(start, start + 2), 16);
}

function mixWithWhite(color: string, amount: number): string {
  const channels = [1, 3, 5].map((start) =>
    Math.round(channel(color, start) * (1 - amount) + 255 * amount)
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${channels.join("")}`;
}

/** Keep Fouaille's exact swatch while making dark borders visible on Marco. */
export function productColors(value: string): {
  swatch: string;
  border: string;
  surface: string;
} {
  const swatch = normalizeHex(value);
  const brightness =
    (channel(swatch, 1) * 299 +
      channel(swatch, 3) * 587 +
      channel(swatch, 5) * 114) /
    1000;
  const border = brightness < 105 ? mixWithWhite(swatch, 0.48) : swatch;

  return {
    swatch,
    border,
    surface: `${swatch}20`,
  };
}
