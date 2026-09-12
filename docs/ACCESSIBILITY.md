# Accessibility

The project aims to make catalog discovery usable with keyboards, assistive technology, zoom, reduced motion, and varied screen sizes. The repository does not currently claim formal WCAG conformance, and this document is not a substitute for an independent audit.

## Contributor requirements

For user-interface changes:

- use semantic HTML before custom roles;
- provide accessible names for icon-only controls;
- keep all actions reachable and operable by keyboard;
- preserve a visible focus indicator and logical focus order;
- move focus into dialogs and restore it when they close;
- associate form labels, errors, and help text programmatically;
- announce meaningful asynchronous states without excessive interruption;
- do not use color, motion, hover, or shape as the only signal;
- maintain readable contrast in light and dark themes;
- support browser zoom and reflow without hiding essential actions;
- respect `prefers-reduced-motion` for nonessential animation;
- provide useful text alternatives for meaningful images and empty alternatives for decoration;
- keep table headers and relationships understandable to screen readers.

## Review checklist

Test at minimum:

1. Keyboard-only navigation from page start through search, filters, views, tool details, comparison, token dialog, and exports.
2. Focus placement and escape/close behavior for overlays.
3. A current screen reader with at least one major browser.
4. Light and dark themes, high-contrast preferences where available, and 200% browser zoom.
5. Narrow/mobile layouts and text resizing.
6. Loading, refresh, empty, error, and rate-limit states.
7. Reduced-motion preferences.

Automated accessibility tools are useful but do not replace manual keyboard and screen-reader testing. Record tools, browser/assistive-technology versions, and known limitations in the pull request.

## Current review priorities

The interface uses custom cards, charts, filters, dialogs, animated transitions, tooltips, and multiple views. These need recurring manual review, especially for focus management, chart alternatives, tooltip availability, status announcements, contrast, and reduced motion. Absence of a known issue is not evidence of conformance.

## Report an accessibility issue

Open an issue and include:

- page/view and control;
- expected and actual behavior;
- browser, operating system, and assistive technology;
- keyboard steps or a minimal reproduction;
- screenshots or recordings when safe and helpful;
- the impact and any workaround.

Do not include personal or sensitive information. If the report exposes a security or privacy weakness, follow [SECURITY.md](../SECURITY.md) instead.
