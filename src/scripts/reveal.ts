let cleanup: (() => void) | undefined;

function supportsCss(prop: string, value: string): boolean {
  return (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports(prop, value)
  );
}

function initReveal(): void {
  cleanup?.();
  cleanup = undefined;

  document.documentElement.classList.add("js");

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const cleanups: Array<() => void> = [];

  // 1. Hero line reveals
  const heroLines = Array.from(
    document.querySelectorAll<HTMLElement>('[data-reveal="line"]')
  );
  if (heroLines.length > 0) {
    if (reducedMotion) {
      for (const line of heroLines) line.classList.add("is-visible");
    } else {
      const raf = requestAnimationFrame(() => {
        for (const line of heroLines) line.classList.add("is-visible");
      });
      cleanups.push(() => cancelAnimationFrame(raf));
    }
  }

  // 2. Markdown prefixes & block reveal fallback
  const supportsViewTimeline = supportsCss("animation-timeline", "view()");
  const prefixes = Array.from(
    document.querySelectorAll<HTMLElement>(".md-prefix")
  );
  const blocks = supportsViewTimeline
    ? []
    : Array.from(
        document.querySelectorAll<HTMLElement>('[data-reveal="block"]')
      );
  const observed = [...prefixes, ...blocks];

  if (observed.length > 0) {
    if (reducedMotion || typeof IntersectionObserver === "undefined") {
      for (const el of observed) el.classList.add("is-visible");
    } else {
      const observer = new IntersectionObserver(
        entries => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        },
        { threshold: 0.05, rootMargin: "0px 0px -4% 0px" }
      );
      for (const el of observed) observer.observe(el);
      cleanups.push(() => observer.disconnect());
    }
  }

  // 3. Scroll cue fade-out & scroll-progress fallback
  const scrollCues = Array.from(
    document.querySelectorAll<HTMLElement>("[data-scroll-cue]")
  );
  const progressBar = document.querySelector<HTMLElement>(
    "[data-scroll-progress]"
  );
  const needsProgressFallback =
    progressBar !== null && !supportsCss("animation-timeline", "scroll()");

  if (scrollCues.length > 0 || needsProgressFallback) {
    let scrollFrame = 0;

    const updateScrollState = () => {
      scrollFrame = 0;
      const y = window.scrollY || document.documentElement.scrollTop || 0;

      for (const cue of scrollCues) {
        cue.classList.toggle("is-scrolled", y > 24);
      }

      if (needsProgressFallback && progressBar) {
        const doc = document.documentElement;
        const max = doc.scrollHeight - doc.clientHeight;
        const ratio = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
        progressBar.style.setProperty("--scroll-progress", String(ratio));
      }
    };

    const onScroll = () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollState);
    };

    updateScrollState();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    cleanups.push(() => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
    });
  }

  // 4. Watch / Index mode switcher
  const modeGroups = Array.from(
    document.querySelectorAll<HTMLElement>("[data-modes]")
  );

  for (const group of modeGroups) {
    const root = group.closest<HTMLElement>("[data-mode-root]");
    const buttons = Array.from(
      group.querySelectorAll<HTMLButtonElement>("button[data-mode]")
    );
    if (!root || buttons.length === 0) continue;

    const setMode = (nextMode: string) => {
      root.setAttribute("data-view-mode", nextMode);
      for (const btn of buttons) {
        btn.setAttribute("aria-pressed", String(btn.dataset.mode === nextMode));
      }
    };

    for (const btn of buttons) {
      const onClick = () => {
        const mode = btn.dataset.mode;
        if (mode) setMode(mode);
      };

      const onKeyDown = (e: KeyboardEvent) => {
        const idx = buttons.indexOf(btn);
        let nextIdx = -1;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          nextIdx = (idx + 1) % buttons.length;
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          nextIdx = (idx - 1 + buttons.length) % buttons.length;
        } else if (e.key === "Home") {
          nextIdx = 0;
        } else if (e.key === "End") {
          nextIdx = buttons.length - 1;
        }
        if (nextIdx >= 0) {
          e.preventDefault();
          const target = buttons[nextIdx];
          target.focus();
          if (target.dataset.mode) setMode(target.dataset.mode);
        }
      };

      btn.addEventListener("click", onClick);
      btn.addEventListener("keydown", onKeyDown);
      cleanups.push(() => {
        btn.removeEventListener("click", onClick);
        btn.removeEventListener("keydown", onKeyDown);
      });
    }

    const indexPanel = root.querySelector<HTMLElement>("[data-index-panel]");
    if (indexPanel) {
      const onPanelClick = (e: Event) => {
        const anchor = (e.target as HTMLElement | null)?.closest(
          "a[href^='#']"
        );
        if (anchor) {
          setMode("watch");
        }
      };
      indexPanel.addEventListener("click", onPanelClick);
      cleanups.push(() =>
        indexPanel.removeEventListener("click", onPanelClick)
      );
    }
  }

  cleanup = () => {
    for (const fn of cleanups) fn();
  };
}

document.addEventListener("astro:page-load", initReveal);
document.addEventListener("astro:before-swap", () => cleanup?.());
