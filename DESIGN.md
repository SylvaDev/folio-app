# Folio Design Standards

Compiled from three sources — **emil-design-eng** (motion craft), **impeccable** (design laws + register), and **design-taste-frontend** (anti-slop). These are the standing standards for the rest of the build.

When the three philosophies conflict, the precedence is:

1. What we've already locked in for Folio (brand colors, fonts, navigation patterns)
2. impeccable's shared design laws (color strategy, no banned patterns)
3. emil-design-eng for motion specifics
4. design-taste-frontend for production rigor and anti-slop

---

## Register

Folio is dual-register depending on surface:

| Surface | Register | Reasoning |
|---|---|---|
| `/`, `/login`, `/signup`, `/u/[username]` (logged-out) | **brand** | Marketing & conversion surface. Design IS the product here. |
| `/library`, `/tbr`, `/analytics`, `/series`, `/settings`, etc. | **product** | App UI. Design SERVES the product. |
| `/u/[username]` (logged-in) | **product** | Inside the app shell. |

This matters because brand surfaces can be more expressive (asymmetric, rich motion, larger type). Product surfaces stay calm, performant, and predictable.

---

## Identity (locked in, do not change)

- **Colors**: forest `#1B3A2D`, forest-light `#2D6A4F`, mint `#52B788`, cream `#F5EDD8`, cream-dark `#EDE2C8`, terra `#E07A5F`, terra-dark `#C9603E`, gold `#D4A853`
- **Body**: DM Sans
- **Display / serifs**: Playfair Display

> **About the serif**: design-taste-frontend bans serifs for "dashboards." We override this for Folio because the product's identity is editorial/literary — a reading life app. Serif is used only for headings, page titles, KPI numbers, and brand display. **Never on body, data tables, monospace data, or input text.**

- **Page background**: `#F9F7F3` (warm off-white, never pure white)
- **Iconography**: Lucide React only. Stroke width `2` for size ≥16px, `1.5` for smaller decorative use.

---

## Color rules

### Strategy
Folio uses a **Restrained** strategy (impeccable terminology):

- Forest dominates (forest text, forest accents)
- Cream + cream-dark for backgrounds and soft surfaces
- Mint is the *only* "success/positive" accent — never use a generic green
- Terracotta is the *only* "primary CTA" accent — never use a generic orange
- Gold is rare — reserved for ratings, awards, "favorited" states

### Bans
- **Never** `#000` or `#fff` literal. Always tinted neutrals (`bg-cream/30`, `text-forest/70`, `bg-gray-900` if absolutely necessary).
- **Never** purple/violet "AI glow" accents.
- **Never** gradient text (`background-clip: text`).
- **Never** side-stripe borders (`border-left` > 1px as accent).
- **Never** more than one accent color in a single component.

---

## Typography

| Use | Class | Notes |
|---|---|---|
| Page title | `.page-title` (font-serif text-3xl font-bold text-forest) | Sparingly — one per page max |
| Section heading | `.section-title` (font-serif text-2xl font-bold text-forest) | |
| Body | `text-sm` (DM Sans, default) | Body cap at 65-75ch via `max-w-prose` |
| Microcopy | `text-xs text-gray-400` | Hint/label microcopy |
| Numeric data | Serif KPI numbers (`font-serif text-2xl font-bold`) OR monospace for IDs/code | Never mix |
| Labels | `.label` (xs forest tracking-wide) | Above inputs only |
| Username handle | `font-mono` | Identifier signal |

**Rules**:
- Hierarchy by scale **and** weight contrast (≥1.25 ratio between steps)
- Cap body line length at 65ch via `max-w-prose` for prose blocks
- No "Inter" — already not in use, keep it that way

---

## Layout

- Always use `max-w-{N}xl mx-auto` for centered constrained layouts. Standard: `max-w-4xl` for content, `max-w-6xl` for app surfaces, `max-w-3xl` for forms.
- **Never** `h-screen` for full-height. Always `min-h-[100dvh]` (iOS Safari fix).
- Prefer CSS Grid for structures. Avoid flex percentage math (`w-[calc(33%-1rem)]`).
- Cards are the **last** resort, not the default. Use spacing, `border-t`, or `divide-y` first.
- Empty states must have a contextual CTA, not just text.

---

## Motion

### Custom easings (defined in globals.css)
- `--ease-out`: `cubic-bezier(0.23, 1, 0.32, 1)` — for entrances and UI feedback
- `--ease-in-out`: `cubic-bezier(0.77, 0, 0.175, 1)` — for on-screen movement
- `--ease-drawer`: `cubic-bezier(0.32, 0.72, 0, 1)` — for drawers and sheets

### Durations
| Element | Duration |
|---|---|
| Button press | 150-200ms |
| Hover/color change | 150ms |
| Dropdown / popover | 180-220ms |
| Modal / dialog | 220-300ms |
| Page transition (Next.js) | 300-400ms |
| Stagger between items | 30-60ms per item, cap stagger at 8 items |

### Bans
- **Never** `transition-all`. Specify properties: `transition-transform`, `transition-colors`, `transition-[width,opacity]`.
- **Never** animate from `scale(0)`. Use `scale(0.95)` + opacity.
- **Never** `ease-in` on UI elements (sluggish). Use `ease-out` or custom curve.
- **Never** animate `top`, `left`, `width`, `height`, `padding`, `margin`. Only `transform` and `opacity` (and `clip-path` for reveals).
- **Never** animate keyboard-initiated actions (search bar open, command palette).
- **Never** spring bounce > 0.3.
- **Never** lock motion behind a hover state without `@media (hover: hover) and (pointer: fine)`.

### Required
- Every pressable element: `transition-transform duration-200 ease-out active:scale-[0.97]`
- Every focusable element: `outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-2`
- `prefers-reduced-motion` fallbacks on all keyframe animations

---

## Components

### Buttons
Use the shared classes. Do not roll your own button.
- `.btn-primary` — terracotta CTA, one per surface max
- `.btn-secondary` — forest, for secondary actions
- `.btn-ghost` — minimal, for tertiary actions

### Cards
- `.card` — the base. Adds hover state automatically.
- **Never** nest cards. Two levels of card depth is always wrong.
- **Never** repeat identical card grids. Vary something: size, content density, accent.

### Inputs
- `.input` — base. Always with `.label` above.
- Error text below, in red-500 / red-50 background pill.

---

## Copy

- **No em dashes** (`—`) in prose. Use commas, colons, periods, or parentheses.
  - Acceptable exception: as a "missing value" glyph in data cells (`—` standing in for null).
- **No emoji** in UI strings, toasts, alt text. Replace with Lucide icons.
- **No filler verbs**: "elevate", "unleash", "seamless", "next-gen", "supercharge".
- **No AI-flavored names**: "John Doe", "Sarah Chen", "Acme", "Nexus".
- Every word earns its place. No restated headings, no intros that repeat the title.
- Concrete verbs over abstract ones: "track" > "manage", "finish" > "complete".

---

## Performance

- Only animate `transform` and `opacity`.
- Apply `will-change: transform` sparingly; remove after animation completes.
- Use `transition` (interruptible) over `@keyframes` (restart-from-zero) for state-driven UI.
- No `window.addEventListener('scroll')` — use `IntersectionObserver`.
- No noise / grain filters on scrolling containers.

---

## Accessibility

- Visible focus rings on every interactive element (`focus-visible:ring-2 ring-mint ring-offset-2`).
- Hover effects gated behind `@media (hover: hover) and (pointer: fine)` (already handled by Tailwind defaults but worth knowing).
- `prefers-reduced-motion` fallback on every keyframe animation.
- Color contrast: text on white must be `text-gray-600` or darker. text on cream/30 must be `text-forest/70` or darker.
- No emoji in alt text. No emoji as iconography.

---

## Anti-slop checklist (apply before shipping any new surface)

Run through these mentally:

- [ ] No transition-all
- [ ] No h-screen
- [ ] No #000 / #fff literals
- [ ] No emojis in UI
- [ ] No em dashes in prose
- [ ] No nested cards
- [ ] No "John Doe" / "Acme" placeholder content
- [ ] All buttons have active:scale + focus-visible ring
- [ ] All hover effects use specific transition properties + ease-out
- [ ] Empty states have a contextual CTA
- [ ] Could someone look at this and say "AI made that"? If yes, push back on the obvious choice.
