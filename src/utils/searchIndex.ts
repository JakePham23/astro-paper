import { getPostUrl } from "./getPostPaths";
import { getSortedPosts } from "./getSortedPosts";
import { postFilter } from "./postFilter";
import {
  getPostFolderAndFile,
  getPostsByLocale,
  type Locale,
} from "./i18nPosts";
import { getTopicMeta } from "@/i18n/topics";

function cleanHeading(raw: string): string {
  return raw
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();
}

function extractHeadings(body: string | undefined): string[] {
  if (!body) return [];
  const seen = new Set<string>();
  const headings: string[] = [];
  const regex = /^#{2,3}\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    const cleaned = cleanHeading(match[1]);
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      headings.push(cleaned);
      if (headings.length >= 15) break;
    }
  }
  return headings;
}

export async function buildSearchIndexResponse(locale: Locale) {
  const posts = getSortedPosts(await getPostsByLocale(locale, postFilter));

  const items = posts.map(post => {
    const { folder } = getPostFolderAndFile(post.filePath, post.id);

    return {
      title: post.data.title,
      description: post.data.description,
      url: getPostUrl(post.id, post.filePath, locale),
      folder,
      folderLabel: getTopicMeta(folder, locale).shortLabel,
      tags: post.data.tags ?? [],
      headings: extractHeadings(post.body),
      featured: Boolean(post.data.featured),
    };
  });

  return new Response(JSON.stringify(items), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
