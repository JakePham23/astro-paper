import rss from "@astrojs/rss";
import { getSortedPosts } from "./getSortedPosts";
import { getPostUrl } from "./getPostPaths";
import { getPostsByLocale, type Locale } from "./i18nPosts";
import config from "@/config";

export async function buildRssResponse(locale: Locale) {
  const posts = await getPostsByLocale(locale);
  const sortedPosts = getSortedPosts(posts);

  return rss({
    title:
      locale === "en" ? `${config.site.title} (English)` : config.site.title,
    description: config.site.description,
    site: config.site.url,
    items: sortedPosts.map(({ data, id, filePath }) => ({
      link: getPostUrl(id, filePath, locale),
      title: data.title,
      description: data.description,
      pubDate: new Date(data.modDatetime ?? data.pubDatetime),
    })),
  });
}
