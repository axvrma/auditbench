# Security model and credential migration

Auditbench is a local tool for websites the user is authorized to inspect. It intentionally supports loopback and private-network websites; do not expose this engine as a public service.

## Local request boundary

Express binds only to 127.0.0.1. Host validation rejects DNS rebinding hosts. Requests with an untrusted Origin or cross-site fetch metadata are denied. Desktop requests additionally require the session token injected by the private Electron session. Browser development API requests require X-Lighthouse-Client: workspace; no permissive CORS is enabled, so foreign websites cannot supply this header through a successful preflight. Only the app's own origin and the fixed loopback Vite origins are allowed. Vite binds to loopback on a strict port.

Security headers include CSP, no-sniff, no-store and no-referrer. Reports are fetched on demand as JSON, rendered as escaped text and never executed as audited HTML. User-entered audit and login URLs accept HTTP(S) without embedded usernames or passwords. JSON bodies are size-limited, writable fields validated and controlled database errors returned without SQL or request payloads. External links use noreferrer; Electron restricts its external URL schemes.

The token and optional development key are omitted from Chrome's inherited environment. Login failure messages are controlled. Verbose audit URL, authentication and raw Lighthouse warning logging has been removed. Full reports and screenshots can contain private page data; they stay local behind the same application access boundary. Their directory is created with owner-only permissions; the database is chmod 0600. Directory/file mode protection follows platform semantics and is not a substitute for Windows user ACLs or full-disk encryption.

## Secret protection

Desktop passwords use the asynchronous Electron safeStorage API, backed by macOS Keychain, Windows DPAPI or an available Linux secret store. Linux basic_text and unavailable protection are rejected. Encryption does not protect an already compromised user account or all same-user processes on every OS. Unsigned macOS builds can trigger Keychain access prompts across upgrades.

Neither credential nor URL listings/mutations return password values. They return has_password. Password fields begin empty when editing: omit a replacement to preserve the saved secret. Website authentication can be removed explicitly. Database ciphertext is version-prefixed; decrypt failures lock the affected authentication and fail audits rather than falling back to an unauthenticated result.

Browser development optionally accepts LIGHTHOUSE_SECRET_KEY, a base64-encoded random 32-byte key supplied by an external secret manager or the invoking environment. AES-256-GCM uses a fresh nonce per write. Never commit this key, put it beside the database, or use a production desktop data directory for development. Desktop OS ciphertext and external-key development ciphertext are not interchangeable; use separate directories.

## Legacy plaintext migration

Before converting nonempty legacy credential/password fields, the app creates a unique SQLite-consistent `pre-encryption-<timestamp>.db` backup in the same data directory with owner-only permissions. A transaction replaces all affected fields with protected ciphertext. secure_delete plus VACUUM removes old page contents from the active database. Modules, URLs, audits, historical PWA columns and screenshot references are retained; audit_profile and completed_at are additive nullable migrations. Historical timestamps are labeled as run starts when a completion time is unavailable.

A visible migration notice identifies the recovery backup. **The backup still contains plaintext passwords.** Verify your saved logins and remove that backup securely when recovery is no longer needed. Filesystem snapshots, drive backups and storage hardware may retain earlier copies; use your operating system's data protection controls.

Without secure protection, legacy data is preserved, never returned over the API, and never used for authentication. A visible message asks the user to reopen with an unlocked OS store. No plaintext write fallback is permitted. If OS keys were lost or credentials came from another machine/protector, re-enter the password; there is no recoverable repository key.

## Authentication accuracy

The engine waits for login submission/navigation, rejects a login form that remains visible and rejects requested pages still presenting a password field. Missing credentials, unlock failures and authentication exceptions are failed audits. Fresh Chrome profiles isolate runs. This conservative form-based flow does not guarantee support for MFA, captchas, external identity providers, shadow-DOM forms or arbitrary sessionStorage-based authentication. It may reject pages with a password field unrelated to login. Use the selectors to target your login form, and inspect the final screenshot/report to verify the intended content.

Runtime Lighthouse errors are failures; missing category scores remain null and are labeled partial in the UI. Authentication cookies are temporary in Chrome's owned profile; saved sessions are not exported or persisted by the app.

## Dependency audit

The baseline npm audit reported 49 findings including two critical findings. Compatible lockfile fixes were applied without forcing a major Lighthouse, Electron, Puppeteer or builder change. The final audit still reports transitive advisories; see verification.md. Do not treat passing functional tests as a clean dependency audit. The local-only boundary reduces exposure but does not remove the need for future dependency upgrades and review.
