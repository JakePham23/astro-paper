import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TOKENS_PATH = path.join(ROOT, "src/styles/tokens.css");
const CHECKED_CSS = ["src/styles/motion.css", "src/styles/markdown-ui.css"];

let failed = false;

function pass(msg) {
  process.stdout.write(`PASS: ${msg}\n`);
}

function fail(msg) {
  process.stderr.write(`FAIL: ${msg}\n`);
  failed = true;
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

// 1. Check no hard-coded colors or durations in motion.css & markdown-ui.css
for (const rel of CHECKED_CSS) {
  const full = path.join(ROOT, rel);
  const raw = fs.readFileSync(full, "utf8");
  const clean = stripComments(raw);

  const hexMatches = clean.match(/#[0-9a-fA-F]{3,8}\b/g);
  const funcColorMatches = clean.match(/\b(?:rgb|rgba|hsl|hsla)\s*\(/g);
  const durationMatches = clean.match(/\b\d+(?:\.\d+)?(?:ms|s)\b/g);

  if (hexMatches || funcColorMatches) {
    fail(
      `${rel} contains hard-coded colors: ${[...(hexMatches ?? []), ...(funcColorMatches ?? [])].join(", ")}`
    );
  } else {
    pass(`${rel} has 0 hard-coded colors`);
  }

  if (durationMatches) {
    fail(`${rel} contains hard-coded durations: ${durationMatches.join(", ")}`);
  } else {
    pass(`${rel} has 0 hard-coded durations`);
  }
}

// 2. Check prefers-reduced-motion: reduce in tokens.css & motion.css
for (const rel of ["src/styles/tokens.css", "src/styles/motion.css"]) {
  const raw = fs.readFileSync(path.join(ROOT, rel), "utf8");
  if (/prefers-reduced-motion:\s*reduce/.test(raw)) {
    pass(`${rel} handles prefers-reduced-motion: reduce`);
  } else {
    fail(`${rel} is missing @media (prefers-reduced-motion: reduce)`);
  }
}

// 3. Verify WCAG AA >= 4.5:1 for all 4 vivid presets (cobalt, human, salon, ochre)
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map(c => c + c)
          .join("")
      : h;
  return [
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
  ];
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(c =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function extractPaletteBlock(tokensCss, theme, palette) {
  const re = new RegExp(
    `\\[data-theme="${theme}"\\]\\[data-palette="${palette}"\\]\\s*\\{([\\s\\S]*?)\\}`
  );
  const match = re.exec(tokensCss);
  if (!match) return {};
  const vars = {};
  for (const line of match[1].split("\n")) {
    const m = /(--[a-z-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\b/.exec(line);
    if (m) vars[m[1]] = m[2];
  }
  return vars;
}

const ACCENT_KEYS = [
  "--c-amber",
  "--c-coral",
  "--c-pink",
  "--c-lilac",
  "--c-sky",
  "--c-teal",
  "--c-sage",
  "--c-lime",
];

const VIVID_PALETTES = ["cobalt", "human", "salon", "ochre"];
const tokensRaw = fs.readFileSync(TOKENS_PATH, "utf8");

for (const palette of VIVID_PALETTES) {
  for (const theme of ["light", "dark"]) {
    const vars = extractPaletteBlock(tokensRaw, theme, palette);
    const bg = vars["--background"];
    const bgRaise = vars["--muted"];
    const pairs = [
      ["foreground vs --bg", vars["--foreground"], bg],
      ["foreground vs --bg-raise", vars["--foreground"], bgRaise],
      ["muted-foreground vs --bg", vars["--muted-foreground"], bg],
      ["muted-foreground vs --bg-raise", vars["--muted-foreground"], bgRaise],
      ["accent-foreground vs --accent", vars["--accent-foreground"], vars["--accent"]],
      ["band-fg vs --band-bg", vars["--band-fg"], vars["--band-bg"]],
      ["band-muted vs --band-bg", vars["--band-muted"], vars["--band-bg"]],
      ["band-pill-fg vs --band-pill-bg", vars["--band-pill-fg"], vars["--band-pill-bg"]],
    ];

    for (const key of ACCENT_KEYS) {
      pairs.push([`${key} vs --bg`, vars[key], bg]);
      pairs.push([`${key} vs --bg-raise`, vars[key], bgRaise]);
    }

    for (const [label, fg, surface] of pairs) {
      if (!fg || !surface) {
        fail(`${palette} ${theme}: missing token for ${label}`);
        continue;
      }
      const ratio = contrastRatio(fg, surface);
      if (ratio >= 4.5) {
        pass(`${palette} ${theme} ${label}: ${ratio.toFixed(2)}:1 (>= 4.5:1)`);
      } else {
        fail(`${palette} ${theme} ${label}: ${ratio.toFixed(2)}:1 (< 4.5:1)`);
      }
    }
  }
}

if (failed) {
  process.exit(1);
}
