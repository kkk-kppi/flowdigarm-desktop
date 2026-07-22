# Visible Text Overflow Design

## Goal

Keep node geometry fixed while allowing all node text to remain visible beyond the node text area, matching Visio-style overflow behavior.

## Behavior

- Node width, height, position, ports, connected edges, and undo history do not change when text exceeds the text area.
- Horizontal text still wraps to the configured text-area width.
- Height never removes lines or compresses line spacing.
- Top alignment grows downward, bottom alignment grows upward, and middle alignment grows equally around the text-area center.
- Vertical text follows the same visible-overflow rule.
- Rotated nodes rotate overflowing text and the editor around the existing node center.
- Editing, live X6 rendering, and SVG export use the same alignment and nominal `fontSize * lineHeight` advance.

## Architecture

`text-layout.ts` remains the shared source for text-area geometry, width-measured horizontal line breaking, and nominal line advance. X6 and SVG export consume the same prewrapped lines, so X6 `textWrap` cannot truncate or loop on narrow glyphs. SVG export stops reducing line advance to fit the node. The overlay keeps a fixed anchor rectangle but permits its mirror-sized editable content to overflow that rectangle.

No document-schema field is added. This replaces the previous global clipping behavior rather than introducing a per-node option.

## Error And Boundary Behavior

- Text may extend outside the page and is clipped only by the page/export viewport boundary.
- Empty text produces no visible label.
- Excessive text remains subject to the existing 10,000-character command limit.
- Text background continues to follow the text editor/export behavior already supported; this change does not add X6 live text-background markup.

## Verification

- Unit tests prove X6 width wrapping has no finite height limit and preserves nominal line height.
- SVG tests prove five lines retain nominal line spacing outside a short node for top/middle/bottom alignment.
- Component tests prove the overlay mirror can exceed the anchor height without being clipped.
- Chromium E2E proves all five lines remain present after commit and extend above/below a middle-aligned short node.
- Full Vitest, production build, and focused Playwright suites must pass.
