/**
 * Publisher reset — minimal modern CSS reset shipped with every published page.
 *
 * Why this exists
 * ───────────────
 * Without a reset the published HTML inherits UA defaults: `box-sizing: content-box`,
 * `<body>` `margin: 8px`, heading/paragraph margins, list `padding-left`, Times-style
 * default font, etc. The design canvas (rendered inside the editor DOM) inherits the
 * editor's `globals.css` reset (`* { margin:0; padding:0; box-sizing:border-box }`,
 * Inter font, etc.). The two render surfaces therefore disagree on basics like font,
 * spacing, and box model — exactly the drift users notice when comparing the canvas
 * to the iframe preview / published front end.
 *
 * The fix is a single canonical reset string that is:
 *
 *  1. injected unscoped into the `<style>` block by `publishPage()`
 *     (so the iframe preview AND the published front end share one baseline), and
 *  2. injected scoped to `[data-breakpoint-id]` in the canvas (via canvasClassCss)
 *     so the canvas viewport matches the published page exactly. Editor chrome
 *     keeps its own `globals.css` reset because the scoping selector only catches
 *     the breakpoint frames.
 *
 * Specificity / cascade
 * ─────────────────────
 * Every selector is wrapped in `:where(...)` so the reset has zero specificity.
 * That means any user class, framework utility, or module CSS rule trivially
 * overrides reset declarations — no `!important`, no specificity wars.
 *
 * Stability
 * ─────────
 * This is the canonical baseline. If new rules are added they must be added here
 * (so canvas + published stay in sync). Don't fork a parallel reset somewhere else.
 */

/**
 * Minimal modern reset, ordered roughly Andy-Bell-style + a few extras to match
 * the editor's existing canvas reset behaviour (zero padding on every element,
 * list bullets stripped). Form controls inherit typography so site-level fonts
 * propagate into `<button>` / `<input>` without per-module work.
 */
/**
 * Cascade-layer-wrapped publisher reset.
 *
 * WHY the layer (LazyBirds import burn 12/10): imports that carry a modern
 * framework build (Tailwind v4 et al.) ship their CSS inside `@layer`
 * blocks. Under CSS cascade layers, UNLAYERED styles beat ALL layered
 * styles regardless of specificity or source order — so the previously
 * unlayered `:where(*){margin:0;padding:0}` reset silently killed EVERY
 * utility rule on imported pages (all spacing collapsed to 0; the page
 * reads as "completely unstyled"). Wrapping the reset in a NAMED layer
 * (`lb-reset`, first in source order) restores the documented intent
 * ("the reset wins nothing"): unlayered author CSS and later-loaded
 * framework layers both override it, while the reset still provides the
 * UA-default-stripping baseline when nothing else matches.
 */
export const PUBLISHER_RESET_CSS = [
  '@layer lb-reset {',
  ':where(*, *::before, *::after) { box-sizing: border-box; }',
  '',
  ':where(*) { margin: 0; padding: 0; }',
  '',
  ':where(body) {' +
    ' line-height: 1.5;' +
    ' font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;' +
    ' -webkit-font-smoothing: antialiased;' +
    ' -moz-osx-font-smoothing: grayscale;' +
    ' }',
  '',
  ':where(img, picture, video, canvas, svg) { display: block; max-width: 100%; height: auto; }',
  '',
  ':where(input, button, textarea, select) { font: inherit; color: inherit; }',
  ':where(button) { background: none; border: 0; cursor: pointer; }',
  '',
  ':where(p, h1, h2, h3, h4, h5, h6) { overflow-wrap: break-word; }',
  '',
  ':where(ol, ul, menu) { list-style: none; }',
  '',
  ':where(a) { color: inherit; text-decoration: inherit; }',
  '',
  ':where(table) { border-collapse: collapse; }',
  '}',
].join('\n')

// `scopedPublisherResetCss` is gone. It used to wrap every reset rule in a
// `[data-breakpoint-id]` prefix so the canvas could share a document with
// the editor chrome without the reset bleeding into toolbars/panels. The
// canvas now renders each breakpoint frame inside its own iframe, so the
// reset can simply be the unscoped `PUBLISHER_RESET_CSS` — same bytes the
// publisher ships, same cascade. See `docs/features/canvas-iframe-per-frame.md`.

