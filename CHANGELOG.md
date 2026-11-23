# Changelog

## 2.0.0 — Auditbench

- Introduces the Auditbench name, refreshed desktop workspace and public website, with attribution to [Abhishek Verma](https://axvrma.com).
- Adds persistent light/dark/system themes, compact navigation, functional settings, searchable audit history, previous-run comparisons, screenshots and full JSON report inspection.
- Uses one shared audit-progress mechanism and supports the four current Lighthouse scoring categories. Historical PWA measurements remain stored.
- Fails authentication and incomplete runs visibly, preserves runtime-error reports and screenshots, and recovers interrupted attempts on restart.
- Protects saved passwords with asynchronous OS-backed storage, redacts secrets from API responses and validates local requests.
- Preserves the existing application ID, profile directory, databases, screenshots and key-store identity across the rename.
- Provides macOS Apple Silicon/Intel DMGs, Windows x64 NSIS and portable ZIP distributions, and a Linux x64 AppImage through native GitHub Actions runners.
- Updates website downloads to the canonical `axvrma/auditbench` repository and resolves available assets from the latest published release.

### Upgrade and installation notes

Google Chrome is required. Installers are not Developer ID signed/notarized on macOS or Authenticode signed on Windows. For the Windows portable ZIP, extract the complete archive before launch.

Legacy plaintext credentials are migrated only when secure OS storage is available. Migration creates a sensitive recovery backup; verify saved logins before removing that backup. An unavailable key store leaves authentication locked rather than saving plaintext. Existing data is retained.

Known dependency advisories and runtime verification limits are documented in `docs/verification.md`.
