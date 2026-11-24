/**
 * Rehype plugin that wraps each table in a focusable, horizontally scrollable
 * `div.table-wrapper`, so wide tables scroll inside the post on small screens
 * instead of widening the page. `tabindex="0"` lets keyboard users scroll it.
 * Also annotates semantic `th` headers (`data-tone="pos" | "neg" | "warn"`)
 * for comparison tables (Ưu/Nên, Nhược/Không nên, Hậu quả/Rủi ro).
 *
 * Tables inside `<ResponsiveTable>` (MDX) are skipped: it has its own wrapper.
 */

function extractText(node) {
  if (!node) return "";
  if (node.type === "text") return node.value ?? "";
  if (!Array.isArray(node.children)) return "";
  return node.children.map(extractText).join(" ");
}

function classifyHeaderTone(text) {
  const normalized = text.trim();
  if (!normalized) return null;
  if (
    /\b(không nên|nhược|sai|lỗi|tránh|anti-?pattern|cons?|avoid|don't)\b/i.test(
      normalized
    )
  ) {
    return "neg";
  }
  if (
    /\b(ưu|nên|đúng|khuyến nghị|tốt|pros?|recommended|best practice)\b/i.test(
      normalized
    )
  ) {
    return "pos";
  }
  if (
    /\b(hậu quả|rủi ro|lưu ý|cảnh báo|đánh đổi|ghi chú|risk|warn|trade-?off|caveat)\b/i.test(
      normalized
    )
  ) {
    return "warn";
  }
  return null;
}

function annotateTableHeaders(node) {
  if (!node || typeof node !== "object") return;
  if (node.type === "element" && node.tagName === "th") {
    const tone = classifyHeaderTone(extractText(node));
    if (tone) {
      node.properties ??= {};
      node.properties.dataTone = tone;
    }
    return;
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      annotateTableHeaders(child);
    }
  }
}

export const rehypeTableWrapper = () => tree => {
  const wrap = node => {
    if (!node.children) return;
    if (node.type === "mdxJsxFlowElement" && node.name === "ResponsiveTable")
      return;

    node.children = node.children.map(child => {
      if (child.type === "element" && child.tagName === "table") {
        annotateTableHeaders(child);
        return {
          type: "element",
          tagName: "div",
          properties: { className: ["table-wrapper"], tabIndex: 0 },
          children: [child],
        };
      }
      wrap(child);
      return child;
    });
  };

  wrap(tree);
};
