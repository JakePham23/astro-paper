/**
 * Rehype plugin that surfaces Markdown syntax prefixes (`## `, `### `, `> `) as
 * decorative `span.md-prefix[aria-hidden="true"]` elements and tags content
 * blocks with `data-reveal="block"` for scroll-driven/IO reveal animations.
 *
 * Must run AFTER `rehypeHeadingIds`, `rehypeInlineToc`, `rehypeCallouts`, and
 * `rehypeTableWrapper` so TOC heading extraction and callouts remain clean.
 */

function hasClass(node, className) {
  const cls = node?.properties?.className;
  if (Array.isArray(cls)) return cls.includes(className);
  if (typeof cls === "string") return cls.split(/\s+/).includes(className);
  return false;
}

function addClass(node, className) {
  node.properties ??= {};
  const cls = node.properties.className;
  if (Array.isArray(cls)) {
    if (!cls.includes(className)) cls.push(className);
  } else if (typeof cls === "string") {
    const parts = cls.split(/\s+/).filter(Boolean);
    if (!parts.includes(className)) parts.push(className);
    node.properties.className = parts;
  } else {
    node.properties.className = [className];
  }
}

function makePrefixSpan(text, extraClass) {
  const classes = ["md-prefix"];
  if (extraClass) classes.push(extraClass);
  return {
    type: "element",
    tagName: "span",
    properties: {
      className: classes,
      ariaHidden: "true",
      dataPagefindIgnore: "all",
    },
    children: [{ type: "text", value: text }],
  };
}

export const rehypeMarkdownPrefixes = () => tree => {
  const walk = (node, insideProtected) => {
    if (!node?.children) return;

    for (const child of node.children) {
      if (child.type !== "element") continue;

      const isProtected =
        insideProtected ||
        hasClass(child, "callout") ||
        hasClass(child, "toc-inline");

      if (isProtected) {
        walk(child, true);
        continue;
      }

      if (child.tagName === "h2" || child.tagName === "h3") {
        const prefix = child.tagName === "h2" ? "## " : "### ";
        child.properties ??= {};
        child.properties.dataReveal = "block";
        child.children ??= [];
        const alreadyHasPrefix =
          child.children[0]?.type === "element" &&
          hasClass(child.children[0], "md-prefix");
        if (!alreadyHasPrefix) {
          child.children.unshift(makePrefixSpan(prefix));
        }
        continue;
      }

      if (child.tagName === "blockquote") {
        addClass(child, "md-blockquote");
        child.properties ??= {};
        child.properties.dataReveal = "block";
        child.children ??= [];
        const alreadyHasPrefix =
          child.children[0]?.type === "element" &&
          hasClass(child.children[0], "md-prefix");
        if (!alreadyHasPrefix) {
          child.children.unshift(makePrefixSpan("> ", "md-prefix-quote"));
        }
        walk(child, true);
        continue;
      }

      if (hasClass(child, "table-wrapper") || child.tagName === "pre") {
        child.properties ??= {};
        child.properties.dataReveal = "block";
        continue;
      }

      walk(child, false);
    }
  };

  walk(tree, false);
};
