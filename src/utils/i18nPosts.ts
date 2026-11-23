import { getCollection, type CollectionEntry } from "astro:content";
import { BLOG_PATH } from "@/content.config";
import { getPostUrl } from "./getPostPaths";
import { postFilter } from "./postFilter";

export const SUPPORTED_LOCALES = ["vi", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "vi";

export function normalizeLocale(locale?: string): Locale {
  return locale === "en" ? "en" : "vi";
}

function getRelSegments(filePath: string | undefined, id: string): string[] {
  if (filePath) {
    const normalized = filePath.replace(/\\/g, "/");
    const idx = normalized.indexOf(`${BLOG_PATH}/`);
    const rel =
      idx >= 0
        ? normalized.slice(idx + BLOG_PATH.length + 1)
        : normalized.replace(BLOG_PATH, "").replace(/^\/+/, "");
    return rel.split("/").filter(Boolean);
  }
  return id.split("/").filter(Boolean);
}

/**
 * Determines the locale of a post from its path (`vi/...` or `en/...`).
 */
export function getPostLocale(post: CollectionEntry<"posts">): Locale {
  const segments = getRelSegments(post.filePath, post.id);
  return segments[0] === "en" ? "en" : "vi";
}

/**
 * Returns the path relative to the locale root (stripping `BLOG_PATH` and leading `vi/` or `en/`).
 * e.g. `05-backend-senior/01-authentication.md` or `README.md`
 */
export function getPostRelativePath(
  filePath: string | undefined,
  id: string
): string {
  const segments = getRelSegments(filePath, id);
  if (segments[0] === "vi" || segments[0] === "en") {
    segments.shift();
  }
  return segments.join("/");
}

/**
 * Returns `{ folder, fileName }` for grouping posts by topic folder.
 */
export function getPostFolderAndFile(
  filePath: string | undefined,
  id: string
): { folder: string; fileName: string } {
  const rel = getPostRelativePath(filePath, id);
  const parts = rel.split("/").filter(Boolean);
  return {
    folder: parts.length > 1 ? parts[0] : "00-root",
    fileName: parts[parts.length - 1] ?? id,
  };
}

/**
 * Fetches posts belonging to a specific locale, optionally applying an extra filter.
 */
export async function getPostsByLocale(
  locale: string,
  extraFilter?: (post: CollectionEntry<"posts">) => boolean
): Promise<CollectionEntry<"posts">[]> {
  const target = normalizeLocale(locale);
  const allPosts = await getCollection("posts");
  return allPosts.filter(post => {
    if (getPostLocale(post) !== target) return false;
    return extraFilter ? extraFilter(post) : true;
  });
}

/**
 * Finds the URL of the corresponding post in `targetLocale`, if a translated counterpart exists.
 */
export async function getAlternatePostUrl(
  post: CollectionEntry<"posts">,
  targetLocale: Locale
): Promise<string | null> {
  const relKey = getPostRelativePath(post.filePath, post.id).replace(
    /\.(md|mdx)$/i,
    ""
  );
  const targetPosts = await getPostsByLocale(targetLocale, postFilter);
  const match = targetPosts.find(
    candidate =>
      getPostRelativePath(candidate.filePath, candidate.id).replace(
        /\.(md|mdx)$/i,
        ""
      ) === relKey
  );
  return match
    ? getPostUrl(match.id, match.filePath, targetLocale)
    : null;
}
