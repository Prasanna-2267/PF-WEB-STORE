# Animation system

The production website uses three motion layers.

## Framer Motion

`HomePage.tsx` uses Framer Motion for:

- Intro appearance and exit
- Navigation entrance
- Hero and contact reveal transitions
- About story-card transitions
- Mobile navigation presence
- Confirmation and coming-soon modals

## CSS motion

`hero.css` and `footer.css` provide:

- Wordmark flashlight sweep
- Hero headline gloss
- Slow phone drift
- Slow floating-panel drift
- Status pulse
- NeuralWeb Labs flashlight wave

These animations use transforms, opacity, and background-position. They do not use a canvas or continuous 3D renderer.

The About introduction and story card use consecutive sticky chapters. The introduction holds first and releases before the card stack rises and pins, preventing the heading, navigation, stage layers, and active card from overlapping. Three story layers remain visibly stacked above and behind the active card. Each exposed layer is a direct stage control, while desktop wheel progression engages only when the active card is hovered. Hover also lifts the glass surface and starts a restrained image drift. Stage content recedes, softens, and is replaced inside the same physical frame. Scrolling outside the card remains ordinary page scrolling to Connect with us.

## Smooth scrolling

`LenisProvider` maintains the existing wheel/trackpad easing. It is an active behavior and must not be classified as an unused provider. Its animation-frame ID is cancelled during cleanup before Lenis is destroyed.

## Accessibility

`useReducedMotion` shortens the main Framer Motion sequences. `theme.css` also reduces CSS animation and transition duration when `prefers-reduced-motion: reduce` is active.

The full-screen opening layer has a CSS visibility fail-safe after 3.2 seconds. Normal state and Framer Motion timing still remove it first; the fail-safe exists only to prevent an opaque intro layer from masking the page if an animation lifecycle stalls.

Motion should remain calm, slow, and explanatory.
