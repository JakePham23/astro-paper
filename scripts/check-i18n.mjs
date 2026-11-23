import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT, "src/content/posts");
const PAGES_DIR = path.join(ROOT, "src/content/pages");

function walkMarkdown(dir, baseDir = dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMarkdown(full, baseDir));
    } else if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) {
      results.push(path.relative(baseDir, full).replace(/\\/g, "/"));
    }
  }
  return results.sort();
}

function checkFrontmatter(filePath, requiredKeys) {
  const raw = fs.readFileSync(filePath, "utf8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return ["missing frontmatter"];
  const fm = match[1];
  const missing = [];
  for (const key of requiredKeys) {
    const re = new RegExp(`^${key}\\s*:`, "m");
    if (!re.test(fm)) missing.push(key);
  }
  return missing;
}

const viPosts = walkMarkdown(path.join(POSTS_DIR, "vi"));
const enPosts = new Set(walkMarkdown(path.join(POSTS_DIR, "en")));
const viPages = walkMarkdown(path.join(PAGES_DIR, "vi"));
const enPages = new Set(walkMarkdown(path.join(PAGES_DIR, "en")));

const byTopic = new Map();

for (const rel of viPosts) {
  const parts = rel.split("/");
  const topic = parts.length > 1 ? parts[0] : "00-root";
  const bucket = byTopic.get(topic) ?? { total: 0, translated: 0, missing: [] };
  bucket.total += 1;
  if (enPosts.has(rel)) {
    bucket.translated += 1;
  } else {
    bucket.missing.push(rel);
  }
  byTopic.set(topic, bucket);
}

console.log("\n=== i18n Parity Report (vi -> en) ===\n");
console.log("Pages:");
for (const rel of viPages) {
  const ok = enPages.has(rel);
  console.log(`  [${ok ? "OK" : "MISSING"}] pages/${rel}`);
}

console.log("\nPosts by Topic:");
let totalPosts = 0;
let translatedPosts = 0;

for (const [topic, stats] of Array.from(byTopic.entries()).sort(([a], [b]) =>
  a.localeCompare(b)
)) {
  totalPosts += stats.total;
  translatedPosts += stats.translated;
  const pct = Math.round((stats.translated / stats.total) * 100);
  console.log(
    `  ${topic.padEnd(32)} ${String(stats.translated).padStart(2)}/${String(stats.total).padEnd(2)} (${String(pct).padStart(3)}%)`
  );
}

const totalFiles = totalPosts + viPages.length;
const translatedFiles =
  translatedPosts + viPages.filter(p => enPages.has(p)).length;
const totalPct = Math.round((translatedFiles / totalFiles) * 100);

console.log(
  `\nTotal: ${translatedFiles}/${totalFiles} files translated (${totalPct}%)\n`
);

const fmErrors = [];
for (const rel of enPosts) {
  const missing = checkFrontmatter(path.join(POSTS_DIR, "en", rel), [
    "title",
    "description",
    "pubDatetime",
  ]);
  if (missing.length > 0) {
    fmErrors.push(`posts/en/${rel}: missing ${missing.join(", ")}`);
  }
}
for (const rel of enPages) {
  const missing = checkFrontmatter(path.join(PAGES_DIR, "en", rel), ["title"]);
  if (missing.length > 0) {
    fmErrors.push(`pages/en/${rel}: missing ${missing.join(", ")}`);
  }
}

if (fmErrors.length > 0) {
  console.error("Frontmatter errors in EN files:");
  for (const err of fmErrors) console.error(`  - ${err}`);
  process.exit(1);
}
