# Design Tokens (Vivid Editorial Presets & Motion)

> Live DevTools & computed-style extraction from `https://www.human-md.ai/` is verified (`[V]`). All derived blog tokens (`[P]`) are checked by `scripts/check-tokens.mjs` to meet WCAG AA (`>= 4.5:1`) against both `--bg` (`--background`) and `--bg-raise` (`--muted`), as well as inside `.color-band` header blocks.

## Live Reference Tokens from `human-md.ai` (`[V]`)

| Reference Token / Surface | Hex Value | Role on `human-md.ai` |
|---|---|---|
| `--ink` | `#201e1f` | Warm espresso-charcoal anchor (light-room text, Quiet Reading Mode background) |
| `--paper` | `#f4efe8` | Warm unbleached cream paper (notepad surface, dark-room text, pills) |
| `--accent` | `#fc4109` | Electric vermilion (bouncing dot, `##` / `>` Markdown sigils, `::selection`) |
| `--pink` | `#ffabc8` | Carnation rose (`index =` pill, notepad highlighter `.ls-hl`, Ch. 9 room) |
| `--purple` / `--lilac` / `--c4` | `#e7bfff` / `#cb9cf8` / `#c9a5f8` | Wisteria lilac & soft lavender (Ch. 4 & Ch. 6 rooms) |
| `--blue` | `#5d9dc5` | Cerulean sky (Ch. 1 room, notepad horizontal ruled lines) |
| `--ocker` / `.index` / `--c10` | `#a67325` / `#c7963c` / `#f8d867` | Raw ochre, index backdrop mustard, buttercup yellow (Ch. 10) |
| `--green` / `--bottle` / `--mint` | `#1c3d24` / `#26512f` / `#69b488` | Hunter pine, bottle green floor, celadon mint (Ch. 6 & Ch. 8) |
| `--tomato` / `.index-card__n` | `#e83729` / `#d8402c` | Lacquer tomato & brick vermilion (Ch. 8 floor, index card numerals) |
| Hero Wall / Hero Floor | `#0b41c2` / `#d1c2af` | Gallery cobalt wall over warm sandstone plaster floor |
| Index Card Vellum / Code Modal | `#f3ead8` / `#0b0b0b` | Vintage vellum card face & obsidian `.md` modal |

## Blog Palette Lineup (4 Vivid Editorial Presets)

1. **`cobalt` (Default — `Cobalt Gallery & Vermilion` / Dark: `Midnight Cobalt`)**
   - **Light**: `#0b41c2` cobalt header band (`#f4efe8` text, `#fc4109` horizon border, `#ffabc8` active pill) + `#f4efe8` warm paper body.
   - **Dark**: `#0e1638` Midnight Cobalt reading surface + `#152b7a` header band + `#f4efe8` cream ink.
2. **`human` (`Human MD Warm Editorial`)**
   - **Light**: `#f4efe8` warm paper + `#201e1f` espresso ink + gradient display title (`--grad-hero`).
   - **Dark**: `#201e1f` espresso-charcoal + `#f4efe8` cream ink + 8 verified pastel-bright accents.
3. **`salon` (`Carnation Salon & Bottle Green` / Dark: `Velvet Hunter & Rose`)**
   - **Light**: `#ffabc8` carnation rose header band (`#1c3d24` bottle-green pill & horizon) + `#faf3f2` blush-vellum paper.
   - **Dark**: `#132419` deep pine felt + `#21422c` header band + `#ffabc8` carnation & `#dab8ff` lilac accents.
4. **`ochre` (`Ochre Tarot & Studio Mint` / Dark: `Espresso Cellar & Ochre`)**
   - **Light**: `#f4cf58` buttercup-ochre header band (`#d8402c` brick horizon, `#201e1f` ink pill) + `#f5eee0` vintage vellum body.
   - **Dark**: `#1d1813` espresso cellar + `#382a14` roasted ochre band + `#f3ead8` vellum ink.

## Coordination Rules (Vivid Presets)

1. **Separated Fill vs. AA Text Tokens**: Painterly fills (`--fill-amber`..`--fill-lime`) power borders, bars, underlines, soft `color-mix` washes, and header bands; `--c-amber`..`--c-lime` are calibrated to `>= 4.5:1` on both `--bg` and `--bg-raise`.
2. **Cohesive Section Inheritance (`data-sec="1..8"`)**: `rehypeMarkdownPrefixes.js` assigns `data-sec` to each `h2` and propagates it to child `h3`, `.table-wrapper`, `blockquote`, `ul`, and `ol` blocks so each section shares one hue.
3. **Scannable Technical Tables (`th[data-tone]`)**: `rehypeTableWrapper.js` classifies comparison headers into `pos` (sage), `neg` (coral), and `warn` (amber), paired with `--bg-zebra` alternating rows.
4. **Deterministic Multi-Hue Tags (`data-hue="1..8"`)**: `getTagHue()` hashes tag names into 8 consistent hues across `Card`, `Tag`, `TopicsPage`, and `HomePage` index rows.
5. **Series Progress Bar**: `PostSidebar.astro` renders `.series-progress` using `--grad-progress` (`coral -> amber -> pink`).
