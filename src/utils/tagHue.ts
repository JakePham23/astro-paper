/**
 * Computes a deterministic hue bucket (1..8) from a tag or label string
 * so tag pills keep consistent colors across builds and pages.
 */
export function getTagHue(input: string): number {
  const normalized = input.trim().toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 8) + 1;
}
