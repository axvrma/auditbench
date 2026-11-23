# Architecture review — Auditbench 2.0

Reviewed baseline 0a92550, including the three latest desktop/release commits. This is an incremental modernization of the existing React/Vite, Express/SQLite and sandboxed Electron application. The lightweight public site remains separate and deploys to Netlify.

## Baseline findings

- Credentials and URL passwords are plaintext and returned by listing and mutation endpoints.
- Development CORS is unrestricted; desktop session protection already exists and must be retained.
- Chrome authentication errors are swallowed. Lighthouse requests obsolete PWA scoring and runtime errors can be stored as completed results.
- SQLite foreign keys are declared but not enabled; running rows recover only in desktop mode.
- History selects the earliest 30 records; list APIs transfer full reports repeatedly.
- Polling and timers are duplicated across dashboard, buttons and module manager, with cleanup gaps.
- Modules cannot be renamed and URL addresses cannot be edited in the existing interface.
- Frontend has no error boundary, dark theme or settings. Credential UI reveals passwords.
- Existing desktop token, loopback binding, sandbox, single-instance behavior and per-user paths are sound foundations.
- Release matrix targets NSIS but previous Windows distribution is ZIP; website must resolve actual assets rather than construct names.
- No baseline automated tests. Root shell defaults to Node 18; installed Node 24.19.0 is used for all verification.

## Decisions

Retain dependency/runtime versions unless compatibility or security evidence warrants a scoped change. Keep SQLite schema compatible, retain historical PWA columns, enable foreign keys and index history. Encrypt secrets through a main-process supplied OS protector; no renderer bridge or locally persisted encryption key. Back up legacy plaintext before transactional conversion; refuse secret writes/use without secure protection. In browser development an externally managed 32-byte key is optional.

Use one application audit provider with cancellable polling and completion refresh. Split forms, modules, history, settings and report details into feature components. Derive summary averages from each website's latest completed run, excluding null measurements. Keep failed and partial results visible and fetch reports on demand. Persist runtime-error reports and any captured screenshot; record completion timestamps separately and compare only matching audit profiles.

Retain static marketing hosting, using genuine screenshots of the implemented application and dynamic GitHub asset discovery with release-page fallbacks. No cloud audit service, automatic installer execution, release publication or version tag is introduced.

Baseline command results and final checks are recorded in verification.md after execution.
