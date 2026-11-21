type MermaidAPI = (typeof import("mermaid"))["default"];

let mermaidPromise: Promise<MermaidAPI> | null = null;
let renderGeneration = 0;
let renderSeq = 0;

function loadMermaid(): Promise<MermaidAPI> {
  mermaidPromise ??= import("mermaid").then(m => m.default);
  return mermaidPromise;
}

function getMermaidConfig() {
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const readVar = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;

  const isDark = root.getAttribute("data-theme") === "dark";
  const bg = readVar("--background", isDark ? "#0b1929" : "#fbf7ee");
  const fg = readVar("--foreground", isDark ? "#edf4fa" : "#0b2239");
  const accent = readVar("--accent", isDark ? "#67c4e6" : "#0e6380");
  const muted = readVar("--muted", isDark ? "#142a42" : "#e9e4d6");
  const mutedFg = readVar("--muted-foreground", isDark ? "#9fb5ca" : "#475d73");
  const border = readVar("--border", isDark ? "#1e3a58" : "#ddd6c4");
  const fontFamily = getComputedStyle(document.body).fontFamily || "sans-serif";

  return {
    startOnLoad: false,
    securityLevel: "strict" as const,
    theme: "base" as const,
    darkMode: isDark,
    fontFamily,
    flowchart: {
      htmlLabels: true,
      useMaxWidth: true,
      curve: "basis" as const,
    },
    sequence: {
      useMaxWidth: true,
      wrap: true,
    },
    themeVariables: {
      darkMode: isDark,
      background: bg,
      fontFamily,
      fontSize: "14px",
      primaryColor: muted,
      primaryTextColor: fg,
      primaryBorderColor: accent,
      secondaryColor: bg,
      secondaryTextColor: fg,
      secondaryBorderColor: border,
      tertiaryColor: muted,
      tertiaryTextColor: fg,
      tertiaryBorderColor: border,
      lineColor: mutedFg,
      textColor: fg,
      mainBkg: muted,
      nodeBorder: accent,
      clusterBkg: bg,
      clusterBorder: border,
      titleColor: fg,
      edgeLabelBackground: bg,
      actorBkg: muted,
      actorBorder: accent,
      actorTextColor: fg,
      actorLineColor: mutedFg,
      signalColor: fg,
      signalTextColor: fg,
      labelBoxBkgColor: bg,
      labelBoxBorderColor: border,
      labelTextColor: fg,
      loopTextColor: fg,
      noteBkgColor: muted,
      noteBorderColor: border,
      noteTextColor: fg,
      activationBkgColor: muted,
      activationBorderColor: accent,
      git0: accent,
      git1: mutedFg,
      git2: fg,
    },
  };
}

function getTargets() {
  const preBlocks = Array.from(
    document.querySelectorAll<HTMLPreElement>('pre[data-language="mermaid"]')
  );
  const renderedFigures = Array.from(
    document.querySelectorAll<HTMLElement>(
      ".mermaid-diagram[data-mermaid-source]"
    )
  );
  return { preBlocks, renderedFigures };
}

function applyResponsiveSizing(container: HTMLElement) {
  const svg = container.querySelector<SVGSVGElement>("svg");
  if (!svg) return;

  const viewBox = svg.getAttribute("viewBox");
  if (!viewBox) return;

  const parts = viewBox.trim().split(/[\s,]+/);
  const vbWidth = Number(parts[2]);
  if (Number.isFinite(vbWidth) && vbWidth > 420) {
    svg.style.setProperty(
      "--mermaid-min-w",
      `${Math.min(Math.round(vbWidth), 560)}px`
    );
    svg.classList.add("mermaid-wide");
  }
}

/* ===== Fullscreen Zoom & Pan Lightbox ===== */

type LightboxState = {
  dialog: HTMLDialogElement;
  stage: HTMLElement;
  canvas: HTMLElement;
  resetBtn: HTMLButtonElement;
  scale: number;
  fitScale: number;
  tx: number;
  ty: number;
  pointers: Map<number, { x: number; y: number }>;
  lastPinchDist: number | null;
};

let lbState: LightboxState | null = null;

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function applyTransform() {
  if (!lbState) return;
  const { canvas, resetBtn, scale, fitScale, tx, ty } = lbState;
  canvas.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  resetBtn.textContent = `${Math.round((scale / fitScale) * 100)}%`;
}

function resetZoom() {
  if (!lbState) return;
  lbState.scale = lbState.fitScale;
  lbState.tx = 0;
  lbState.ty = 0;
  applyTransform();
}

function zoomBy(factor: number, clientX?: number, clientY?: number) {
  if (!lbState) return;
  const { stage, fitScale } = lbState;
  const minScale = Math.max(fitScale * 0.4, 0.15);
  const maxScale = Math.max(fitScale * 5, 4);
  const prevScale = lbState.scale;
  const nextScale = clamp(prevScale * factor, minScale, maxScale);
  if (nextScale === prevScale) return;

  if (clientX !== undefined && clientY !== undefined) {
    const rect = stage.getBoundingClientRect();
    const cx = clientX - (rect.left + rect.width / 2);
    const cy = clientY - (rect.top + rect.height / 2);
    const ratio = nextScale / prevScale;
    lbState.tx = cx - (cx - lbState.tx) * ratio;
    lbState.ty = cy - (cy - lbState.ty) * ratio;
  }

  lbState.scale = nextScale;
  applyTransform();
}

function ensureLightbox(): LightboxState {
  if (lbState && document.body.contains(lbState.dialog)) {
    return lbState;
  }

  const dialog = document.createElement("dialog");
  dialog.id = "mermaid-lightbox";
  dialog.className = "mermaid-lightbox";
  dialog.setAttribute("aria-label", "Xem biểu đồ toàn màn hình");
  dialog.setAttribute("data-pagefind-ignore", "");

  dialog.innerHTML = `
    <div class="mermaid-lightbox-toolbar">
      <span class="mermaid-lightbox-hint text-muted-foreground text-xs">
        <span class="hidden sm:inline">Kéo để di chuyển · Cuộn để zoom · Nhấp đúp phóng to</span>
        <span class="sm:hidden">Kéo hoặc chạm 2 ngón để zoom</span>
      </span>
      <div class="mermaid-lightbox-controls">
        <button type="button" class="mermaid-lightbox-btn" data-zoom-out aria-label="Thu nhỏ" title="Thu nhỏ (-)">−</button>
        <button type="button" class="mermaid-lightbox-btn font-mono" data-zoom-reset aria-label="Đặt lại kích thước" title="Đặt lại (0)">100%</button>
        <button type="button" class="mermaid-lightbox-btn" data-zoom-in aria-label="Phóng to" title="Phóng to (+)">+</button>
        <button type="button" class="mermaid-lightbox-btn" data-zoom-fit aria-label="Vừa màn hình" title="Vừa màn hình (0)">Fit</button>
        <button type="button" class="mermaid-lightbox-btn" data-zoom-close aria-label="Đóng" title="Đóng (Esc)">✕</button>
      </div>
    </div>
    <div class="mermaid-lightbox-stage">
      <div class="mermaid-lightbox-canvas"></div>
    </div>
  `;

  document.body.appendChild(dialog);

  const stage = dialog.querySelector<HTMLElement>(".mermaid-lightbox-stage")!;
  const canvas = dialog.querySelector<HTMLElement>(".mermaid-lightbox-canvas")!;
  const resetBtn = dialog.querySelector<HTMLButtonElement>("[data-zoom-reset]")!;

  const state: LightboxState = {
    dialog,
    stage,
    canvas,
    resetBtn,
    scale: 1,
    fitScale: 1,
    tx: 0,
    ty: 0,
    pointers: new Map(),
    lastPinchDist: null,
  };
  lbState = state;

  dialog
    .querySelector("[data-zoom-out]")
    ?.addEventListener("click", () => zoomBy(1 / 1.25));
  dialog
    .querySelector("[data-zoom-in]")
    ?.addEventListener("click", () => zoomBy(1.25));
  resetBtn.addEventListener("click", resetZoom);
  dialog
    .querySelector("[data-zoom-fit]")
    ?.addEventListener("click", resetZoom);
  dialog
    .querySelector("[data-zoom-close]")
    ?.addEventListener("click", () => dialog.close());

  dialog.addEventListener("close", () => {
    state.pointers.clear();
    state.lastPinchDist = null;
    stage.removeAttribute("data-dragging");
  });

  stage.addEventListener(
    "wheel",
    e => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      zoomBy(factor, e.clientX, e.clientY);
    },
    { passive: false }
  );

  stage.addEventListener("dblclick", e => {
    const targetScale =
      Math.abs(state.scale - state.fitScale) < 0.05
        ? state.fitScale * 2
        : state.fitScale;
    zoomBy(targetScale / state.scale, e.clientX, e.clientY);
  });

  stage.addEventListener("pointerdown", e => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    stage.setPointerCapture(e.pointerId);
    state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (state.pointers.size === 1) {
      stage.setAttribute("data-dragging", "true");
    } else if (state.pointers.size === 2) {
      const pts = Array.from(state.pointers.values());
      state.lastPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    }
  });

  stage.addEventListener("pointermove", e => {
    const prev = state.pointers.get(e.pointerId);
    if (!prev) return;

    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (state.pointers.size === 1) {
      state.tx += dx;
      state.ty += dy;
      applyTransform();
    } else if (state.pointers.size === 2) {
      const pts = Array.from(state.pointers.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      if (state.lastPinchDist && state.lastPinchDist > 0) {
        zoomBy(dist / state.lastPinchDist, midX, midY);
      }
      state.lastPinchDist = dist;
    }
  });

  const endPointer = (e: PointerEvent) => {
    state.pointers.delete(e.pointerId);
    if (state.pointers.size < 2) {
      state.lastPinchDist = null;
    }
    if (state.pointers.size === 0) {
      stage.removeAttribute("data-dragging");
    }
  };
  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);

  dialog.addEventListener("keydown", e => {
    if (!dialog.open) return;
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomBy(1.25);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      zoomBy(1 / 1.25);
    } else if (e.key === "0") {
      e.preventDefault();
      resetZoom();
    }
  });

  return state;
}

function openMermaidLightbox(sourceContainer: HTMLElement) {
  const origSvg = sourceContainer.querySelector<SVGSVGElement>("svg");
  if (!origSvg) return;

  const state = ensureLightbox();
  const origId = origSvg.id;
  let markup = origSvg.outerHTML;
  if (origId) {
    markup = markup.split(origId).join(`${origId}-zoom`);
  }

  state.canvas.innerHTML = markup;
  const clonedSvg = state.canvas.querySelector<SVGSVGElement>("svg");
  if (!clonedSvg) return;

  clonedSvg.classList.remove("mermaid-wide");
  clonedSvg.style.removeProperty("max-width");
  clonedSvg.style.removeProperty("--mermaid-min-w");

  let naturalW = 0;
  let naturalH = 0;
  const viewBox = clonedSvg.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/);
    naturalW = Number(parts[2]);
    naturalH = Number(parts[3]);
  }
  if (!Number.isFinite(naturalW) || naturalW <= 0 || !Number.isFinite(naturalH) || naturalH <= 0) {
    const rect = origSvg.getBoundingClientRect();
    naturalW = Math.max(rect.width, 320);
    naturalH = Math.max(rect.height, 200);
  }

  clonedSvg.setAttribute("width", String(naturalW));
  clonedSvg.setAttribute("height", String(naturalH));
  clonedSvg.style.width = `${naturalW}px`;
  clonedSvg.style.height = `${naturalH}px`;

  if (!state.dialog.open) {
    state.dialog.showModal();
  }

  const stageRect = state.stage.getBoundingClientRect();
  const availW = Math.max(stageRect.width - 40, 200);
  const availH = Math.max(stageRect.height - 40, 200);
  const fitScale = Math.max(
    Math.min(availW / naturalW, availH / naturalH, 1.8),
    0.25
  );

  state.fitScale = fitScale;
  state.scale = fitScale;
  state.tx = 0;
  state.ty = 0;
  applyTransform();
}

function closeMermaidLightbox() {
  if (lbState?.dialog.open) {
    lbState.dialog.close();
  }
}

function buildZoomButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mermaid-zoom-btn";
  btn.setAttribute("aria-label", "Phóng to biểu đồ");
  btn.title = "Phóng to toàn màn hình";
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="15 3 21 3 21 9"></polyline>
      <polyline points="9 21 3 21 3 15"></polyline>
      <line x1="21" y1="3" x2="14" y2="10"></line>
      <line x1="3" y1="21" x2="10" y2="14"></line>
    </svg>
    <span class="hidden sm:inline">Phóng to</span>
  `;
  return btn;
}

export async function renderMermaidDiagrams(): Promise<void> {
  const { preBlocks, renderedFigures } = getTargets();
  if (preBlocks.length === 0 && renderedFigures.length === 0) return;

  const gen = ++renderGeneration;
  const mermaid = await loadMermaid();
  if (gen !== renderGeneration) return;

  mermaid.initialize(getMermaidConfig());

  type TargetEntry =
    | { kind: "pre"; el: HTMLPreElement; source: string }
    | { kind: "figure"; el: HTMLElement; source: string };

  const entries: TargetEntry[] = [
    ...preBlocks.map(el => ({
      kind: "pre" as const,
      el,
      source: (el.querySelector("code")?.textContent ?? el.textContent ?? "").trim(),
    })),
    ...renderedFigures.map(el => ({
      kind: "figure" as const,
      el,
      source: (el.dataset.mermaidSource ?? "").trim(),
    })),
  ];

  for (const entry of entries) {
    if (gen !== renderGeneration) return;
    if (!entry.source) continue;

    const id = `mermaid-svg-${++renderSeq}`;
    try {
      const { svg, bindFunctions } = await mermaid.render(id, entry.source);
      if (gen !== renderGeneration) return;

      const inner = document.createElement("div");
      inner.className = "mermaid-diagram-inner";
      inner.setAttribute("role", "button");
      inner.setAttribute("tabindex", "0");
      inner.setAttribute("aria-label", "Nhấn để phóng to biểu đồ");
      inner.innerHTML = svg;
      bindFunctions?.(inner);
      applyResponsiveSizing(inner);

      const zoomBtn = buildZoomButton();
      zoomBtn.addEventListener("click", () => openMermaidLightbox(inner));

      inner.addEventListener("click", e => {
        if ((e.target as Element).closest("a")) return;
        openMermaidLightbox(inner);
      });
      inner.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openMermaidLightbox(inner);
        }
      });

      const scrollWrap = document.createElement("div");
      scrollWrap.className = "mermaid-diagram-scroll";
      scrollWrap.appendChild(inner);

      if (entry.kind === "pre") {
        const figure = document.createElement("figure");
        figure.className = "mermaid-diagram";
        figure.setAttribute("data-pagefind-ignore", "");
        figure.dataset.mermaidSource = entry.source;
        figure.append(zoomBtn, scrollWrap);
        entry.el.replaceWith(figure);
      } else {
        entry.el.replaceChildren(zoomBtn, scrollWrap);
      }
    } catch (err) {
      document.getElementById(`d${id}`)?.remove();
      document.getElementById(id)?.remove();
      console.warn("[mermaid] Failed to render diagram:", err);
    }
  }
}

const win = window as unknown as {
  __mermaidInitialized?: boolean;
};

if (!win.__mermaidInitialized) {
  win.__mermaidInitialized = true;

  document.addEventListener("astro:before-swap", closeMermaidLightbox);

  document.addEventListener("astro:page-load", () => {
    void renderMermaidDiagrams();
  });

  let themeFrame = 0;
  const observer = new MutationObserver(() => {
    const { preBlocks, renderedFigures } = getTargets();
    if (preBlocks.length === 0 && renderedFigures.length === 0) return;
    if (themeFrame) cancelAnimationFrame(themeFrame);
    themeFrame = requestAnimationFrame(() => {
      themeFrame = 0;
      void renderMermaidDiagrams();
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-palette"],
  });
}
