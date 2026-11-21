import { getCollection } from "astro:content";
import { BLOG_PATH } from "@/content.config";
import { getPostUrl } from "@/utils/getPostPaths";
import { getSortedPosts } from "@/utils/getSortedPosts";
import { postFilter } from "@/utils/postFilter";
import config from "@/config";

const FOLDER_LABELS: Record<string, string> = {
  "00-root": "00 · Tổng quan",
  "01-claude-cli-multi-agent": "01 · Claude CLI & Multi-Agent",
  "02-quy-trinh-phan-mem": "02 · Quy trình phần mềm",
  "03-ap-dung-voi-agent": "03 · Áp dụng với Agent",
  "04-mau": "04 · Mẫu tài liệu",
  "05-backend-senior": "05 · Backend Senior",
  "06-database-chuyen-sau": "06 · Database chuyên sâu",
  "07-he-thong-server": "07 · Hệ thống & Server",
  "08-aws-cloud": "08 · AWS Cloud",
  "09-rag-agent-code-intelligence": "09 · RAG, Agent & Code Intel",
  "10-review-sach": "10 · Review Sách",
};

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

export async function GET() {
  const posts = getSortedPosts(await getCollection("posts", postFilter));

  const items = posts.map(post => {
    const rel = (post.filePath ?? "")
      .replace(BLOG_PATH, "")
      .replace(/^\/+/, "");
    const parts = rel.split("/").filter(Boolean);
    const folder = parts.length > 1 ? parts[0] : "00-root";

    return {
      title: post.data.title,
      description: post.data.description,
      url: getPostUrl(post.id, post.filePath, config.site.lang),
      folder,
      folderLabel: FOLDER_LABELS[folder] ?? folder,
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
