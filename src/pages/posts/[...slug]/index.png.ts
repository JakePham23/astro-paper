import type { APIRoute } from "astro";
import type { CollectionEntry } from "astro:content";
import { getPostSlug } from "@/utils/getPostPaths";
import { postFilter } from "@/utils/postFilter";
import { getPostsByLocale } from "@/utils/i18nPosts";
import { generatePostOgImage } from "@/utils/ogImage";
import config from "@/config";

export async function getStaticPaths() {
  if (!config.features.dynamicOgImage) {
    return [];
  }

  const posts = await getPostsByLocale(
    "vi",
    post => postFilter(post) && !post.data.ogImage
  );

  return posts.map(post => ({
    params: { slug: getPostSlug(post.id, post.filePath) },
    props: post,
  }));
}

export const GET: APIRoute = async ({ props, url }) =>
  generatePostOgImage(props as CollectionEntry<"posts">, url);
