
export function extractRequestedStandard(
  question: string
): string | null {
  const normalized = question
    .toUpperCase()
    .replace(/[\u2013\u2014-]/g, " ");

  const isMatch = normalized.match(/\bIS\s*(\d{3,5})\b/);

  if (isMatch) {
    return `IS ${isMatch[1]}`;
  }

  const ircMatch = normalized.match(/\bIRC\s*(\d{1,3})\b/);

  if (ircMatch) {
    return `IRC ${ircMatch[1]}`;
  }

  if (/\bMORTH\b/.test(normalized)) {
    return "MoRTH";
  }

  return null;
}
