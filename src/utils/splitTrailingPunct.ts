/**
 * Splits trailing punctuation (`., !, ?, :, …`) from a hero line so templates
 * can render `<em class="punct">` with safe Astro escaping.
 */
export function splitTrailingPunct(text: string): {
  body: string;
  punct: string;
} {
  const trimmed = text.trimEnd();
  const match = /^(.*?)([.!?:…]+)$/.exec(trimmed);
  if (!match) {
    return { body: trimmed, punct: "" };
  }
  return {
    body: match[1],
    punct: match[2],
  };
}
