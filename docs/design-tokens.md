# Design Tokens (`human` 8-Color Preset & Motion)

> Live DevTools extraction from `https://www.human-md.ai/` was not executed in this workspace (**KHÔNG TRÍCH XUẤT ĐƯỢC**). Only `#201e1f` (`theme-color`) is `[V]`; all other color and motion values below are `[P]` proposed tokens from `plan_blog_02/SPEC-001.md` and `plan_blog_02/tokens.proposed.css`, verified for WCAG AA (`>= 4.5:1`) against both `--bg` and `--bg-raise`.

## `human` Dark Palette (`[data-theme="dark"][data-palette="human"]`)

### Neutral Surfaces & Reading Ink

| Token | Value | Label | Contrast on `--bg` | Notes |
|---|---|---|---|---|
| `--background` / `--bg` | `#201e1f` | `[V]` | n/a | `theme-color` of `human-md.ai` |
| `--muted` / `--bg-raise` | `#2b2829` | `[P]` | n/a | Code blocks, blockquote, index panels |
| `--foreground` / `--ink` | `#f1ebe3` | `[P]` | `14.00:1` | Primary reading text (`12.33:1` on `--bg-raise`) |
| `--muted-foreground` / `--ink-dim` | `#b9b0a7` | `[P]` | `7.76:1` | Secondary text & meta |
| `--ink-faint` | `#8a8179` | `[P]` | `4.34:1` | Decorative cue & initial prefix only (never reading text) |
| `--border` / `--rule` | `#3a3637` | `[P]` | `1.39:1` | Decorative borders & rules |

### 8 Accent Colors (`>= 4.5:1` on both `--bg` and `--bg-raise`)

| Token | Value | Label | On `--bg` | On `--bg-raise` | Functional / Rotating Role |
|---|---|---|---|---|---|
| `--c-amber` | `#f2b84b` | `[P]` | `9.26:1` | `8.16:1` | `##` prefix, active mode, `--sec-1`, hero punct #1 |
| `--c-coral` | `#ff7f61` | `[P]` | `6.68:1` | `5.88:1` | Blinking `_` cursor, `--sec-2`, hero punct #2 |
| `--c-pink` | `#ff8fb8` | `[P]` | `7.79:1` | `6.86:1` | Tag #1, `--sec-3`, hero punct #3, hero gradient end |
| `--c-lilac` | `#b79cff` | `[P]` | `7.27:1` | `6.41:1` | Blockquote border & `> `, `--sec-4`, hero punct #4 |
| `--c-sky` | `#7fb8ff` | `[P]` | `8.05:1` | `7.09:1` | Body links, active TOC links, `--sec-5` |
| `--c-teal` | `#4fd1c5` | `[P]` | `8.89:1` | `7.83:1` | Inline `code`, `--sec-6` |
| `--c-sage` | `#9ccfa0` | `[P]` | `9.35:1` | `8.24:1` | List markers, tag #2, `--sec-7` |
| `--c-lime` | `#c6e66b` | `[P]` | `11.79:1` | `10.38:1` | Rare numeric accents (dates, counts), tag #3, `--sec-8` |

## `human` Light Palette (`[data-theme="light"][data-palette="human"]`)

| Token | Value | Label | Notes |
|---|---|---|---|
| `--background` / `--bg` | `#f8f4ee` | `[P]` | Warm paper background |
| `--muted` / `--bg-raise` | `#ece5db` | `[P]` | Raised paper surface |
| `--foreground` / `--ink` | `#201e1f` | `[P]` | Primary reading text (`15.13:1` on `--bg`, `13.26:1` on `--bg-raise`) |
| `--muted-foreground` / `--ink-dim` | `#59524c` | `[P]` | Secondary text & meta (`7.01:1`) |
| `--c-amber` | `#8a5200` | `[P]` | Darker amber (`>= 4.5:1` on both surfaces) |
| `--c-coral` | `#b5381e` | `[P]` | Darker coral (`>= 4.5:1` on both surfaces) |
| `--c-pink` | `#a82864` | `[P]` | Darker pink (`>= 4.5:1` on both surfaces) |
| `--c-lilac` | `#6741b8` | `[P]` | Darker lilac (`>= 4.5:1` on both surfaces) |
| `--c-sky` | `#155ca8` | `[P]` | Darker sky (`>= 4.5:1` on both surfaces) |
| `--c-teal` | `#0f6e68` | `[P]` | Darker teal (`>= 4.5:1` on both surfaces) |
| `--c-sage` | `#276637` | `[P]` | Darker sage (`>= 4.5:1` on both surfaces) |
| `--c-lime` | `#4d6900` | `[P]` | Darker lime (`>= 4.5:1` on both surfaces) |

## Coordination Rules

1. **Section rotation (`###` / `h3`)**: `.app-prose h3:nth-of-type(8n + 1..8)` cycles `--sec-1`..`--sec-8` for prefix `###`, left border, and heading anchor hover.
2. **Hero gradient & punctuation cycling**: Large `h1` titles use `--grad-hero` (`amber -> coral -> pink`); hero `em.punct` pops in `amber`, `coral`, `pink`, `lilac` (`4n + 1..4`) before settling to `--ink`.
3. **Fixed functional roles**: Links -> `--c-sky`; inline `code` -> `--c-teal`; blockquotes -> `--c-lilac`; list markers -> `--c-sage`; tags rotate `pink` / `sage` / `lime` (`3n + 1..3`); numeric counts/dates -> `--c-lime`.
4. **Selection & progress bar**: `.scroll-progress` uses `--grad-progress` (`amber -> coral -> pink`); `::selection` uses `color-mix` of `--c-amber` and `--c-pink`.

## Motion Tokens (`:root`)

| Token | Value | Label | Notes |
|---|---|---|---|
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | `[P]` | Primary easing curve |
| `--dur-line` | `600ms` | `[P]` | Hero line reveal (`0ms` under reduced motion) |
| `--stagger` | `90ms` | `[P]` | Stagger between hero lines (`0ms` under reduced motion) |
| `--dur-punct` | `280ms` | `[P]` | `em.punct` pop duration (`0ms` under reduced motion) |
| `--punct-delay` | `180ms` | `[P]` | Delay after line start (`0ms` under reduced motion) |
| `--shift` | `12px` | `[P]` | Vertical reveal offset (`0px` under reduced motion) |
| `--dur-prefix` | `360ms` | `[P]` | `.md-prefix` transition duration |
| `--dur-block` | `520ms` | `[P]` | `[data-reveal="block"]` reveal duration |
| `--dur-cursor` | `1050ms` | `[P]` | `.hero-cursor` blink period |
| `--dur-ui` | `200ms` | `[P]` | UI transitions |
| `--blur-hero` | `4px` | `[P]` | Hero initial blur (`0px` under reduced motion) |
