const THEME_KEY = "theme";
const PALETTE_KEY = "palette";
const LIGHT = "light";
const DARK = "dark";
const DEFAULT_PALETTE = "coastal";

function getPreferredTheme(): string {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? DARK
    : LIGHT;
}

function getPreferredPalette(): string {
  return localStorage.getItem(PALETTE_KEY) ?? DEFAULT_PALETTE;
}

// Reuse the value already set by the inline FOUC-prevention script if available.
const initialWin = window as unknown as {
  __theme?: { value: string; palette?: string };
};
let themeValue: string = initialWin.__theme?.value ?? getPreferredTheme();
let paletteValue: string =
  initialWin.__theme?.palette ?? getPreferredPalette();

function persist(): void {
  localStorage.setItem(THEME_KEY, themeValue);
  localStorage.setItem(PALETTE_KEY, paletteValue);
  reflect();
}

function reflect(): void {
  const root = document.firstElementChild;
  root?.setAttribute("data-theme", themeValue);
  root?.setAttribute("data-palette", paletteValue);
  root?.classList.toggle("dark", themeValue === DARK);
  document.querySelector("#theme-btn")?.setAttribute("aria-label", themeValue);

  document
    .querySelectorAll<HTMLButtonElement>("[data-palette-btn]")
    .forEach(btn => {
      const isActive = btn.dataset.paletteBtn === paletteValue;
      btn.setAttribute("aria-pressed", String(isActive));
      btn.classList.toggle("ring-2", isActive);
      btn.classList.toggle("ring-foreground", isActive);
      btn.classList.toggle("ring-offset-2", isActive);
    });

  // Fill <meta name="theme-color"> with the computed background colour so
  // Android's browser chrome matches the page background.
  const bg = window.getComputedStyle(document.body).backgroundColor;
  document
    .querySelector("meta[name='theme-color']")
    ?.setAttribute("content", bg);
}

function setup(): void {
  reflect();
  document.querySelector("#theme-btn")?.addEventListener("click", () => {
    themeValue = themeValue === LIGHT ? DARK : LIGHT;
    persist();
  });

  document
    .querySelectorAll<HTMLButtonElement>("[data-palette-btn]")
    .forEach(btn => {
      btn.addEventListener("click", () => {
        const next = btn.dataset.paletteBtn;
        if (!next) return;
        paletteValue = next;
        persist();
      });
    });
}

setup();

// Re-run after View Transitions navigation.
document.addEventListener("astro:after-swap", setup);

// Carry the theme-color value across View Transitions to prevent the
// Android navigation bar from flashing during page transitions.
document.addEventListener("astro:before-swap", event => {
  const color = document
    .querySelector("meta[name='theme-color']")
    ?.getAttribute("content");
  if (color) {
    (event as { newDocument: Document }).newDocument
      .querySelector("meta[name='theme-color']")
      ?.setAttribute("content", color);
  }
});

// Sync with OS-level dark/light preference changes.
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", ({ matches }) => {
    themeValue = matches ? DARK : LIGHT;
    persist();
  });
