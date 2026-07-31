# Design system

## Direction

The current interface is calm, editorial, product-led, and light-first. It uses soft blue ambient depth, large whitespace, dark ink typography, subtle glass surfaces, and restrained motion.

## Core tokens

Landing-page variables are declared on `.pf-site` in `theme.css`.

| Token | Light | Dark |
| --- | --- | --- |
| Ink | `#0b0b0f` | `#f2f6ff` |
| Muted | `#69717e` | `#aab5c7` |
| Line | `#dce7f5` | `#2f3d52` |
| Paper | `#f5f9ff` | `#111722` |
| Surface | `#fbfdff` | `#182131` |
| Accent | `#5b8cff` | `#8eafff` |
| Soft surface | `#edf5ff` | `#162238` |

Auth screens define matching scoped values on `.pf-auth`.

## Typography

- Inter is the primary interface family.
- Georgia supplies the editorial italic accent.
- Headlines use tight tracking and low line height.
- Small labels use uppercase text with controlled tracking.

## Surfaces

- The navigation uses restrained backdrop blur.
- The hero phone and learning panel use layered blue gradients and physical shadows.
- Contact controls remain mostly unboxed, with border-bottom fields.
- The footer is a quiet near-black contrast section.

## Responsive rules

The hero becomes a stacked composition at 1050 px. Navigation and contact switch to mobile layouts at 800 px. The smallest hero and footer refinements apply at 600 px.

## Rule

Every visual element must reveal the product, reinforce trust, or improve understanding.
