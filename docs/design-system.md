# Design system

Auditbench uses a restrained forest, mint and warm neutral identity across its desktop workspace and static public site. The mark is an original geometric beacon with two side beams, separate from Google's Lighthouse mark.

## Foundations

CSS custom properties in dashboard/src/index.css define canvas, surface, subtle surface, text, secondary text, borders and semantic score colors. Light defaults: canvas #F6F5EE, text #172420, accent #2E7457, mint #DCECCB. Dark defaults: canvas #101B19 and surface #172420, with brighter text and semantic colors. Scores use green for 90–100, amber for 50–89, red below 50 and a neutral dash for missing values. Color is accompanied by a number, label or status text.

Instrument Sans and IBM Plex Mono are self-hosted WOFF2 fonts with their SIL Open Font Licenses in each fonts directory. The system font stack remains usable offline. Monospace is reserved for scores, identifiers, URLs, timestamps and diagnostics.

Spacing follows a 4px foundation with 18–28px panel padding. Surfaces use 6–12px radii, thin borders and minimal shadows. Lucide provides interface icons. Typography and metadata scale with the desktop layout; the landing page uses larger reading text and fluid headings.

## Components and interaction

Shared native dialog, field, empty state, timestamp and score helpers live in components/ui.tsx. Feature components compose these with consistent button, input, table, status, tooltip, progress, toast and skeleton classes. Native modal dialogs provide focus trapping, initial focus, Escape dismissal and restoration to the invoking control. Destructive actions require a named confirmation. Icon actions have accessible names. Native tooltips are used for secondary diagnostics.

The sidebar persists navigation and compact mode. Appearance supports explicit light/dark or a live system preference, persisted in localStorage for browser development and in SQLite for Electron, whose loopback origin changes at each launch. Desktop navigation, compact mode and website selection also use the database preferences. Reduced-motion preferences disable decorative animation. Charts use linear segments between observed runs with visible points; missing values are gaps. Keyboard-operable category selectors and the history table provide exact-value alternatives to chart inspection.

Brand sources are in branding/. Platform assets live in desktop/. Marketing images are genuine captures of the implemented interface against isolated local fixtures. Their measurements are actual Lighthouse results, not representative scores or promised outcomes.
