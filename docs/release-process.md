# Desktop release process

The release target is Auditbench 2.0.0 (`v2.0.0`). The root package version, tag and packaged application version must match.

## Commands

Use Node 24 and `npm ci`. `npm run build` compiles the backend, checks/builds the dashboard and prepares the public site. `npm run package:desktop` explicitly rebuilds native dependencies for Electron and packages the current host platform with publication disabled. Distribution artifacts are ignored under release/.

Explicit platform builds:

```sh
npm run package:desktop -- --mac --arm64
npm run package:desktop -- --mac --x64
npm run package:desktop -- --win --x64
npm run package:desktop -- --linux --x64
```

Prefer native runners; a successful compile is not proof of startup on another OS. Native better-sqlite3 must match the chosen Electron architecture. `npm test` and `npm run test:browser` rebuild it for Node; packaging and `npm start` rebuild it for Electron. Do not run native rebuilds concurrently in one checkout.

## Artifacts

macOS arm64/x64 use DMG, Windows x64 produces both NSIS EXE and portable ZIP, and Linux x64 uses AppImage. Portable Windows archives must be fully extracted before launch. NSIS allows choosing an installation directory. Linux assets may use x86_64 in their generated name. The website discovers names from actual release metadata.

Source brand assets include a 1024px PNG, Windows ICO and macOS ICNS. They are product inputs, unlike generated installers, which must not be committed. macOS uses ad-hoc identity `-`; builds are not Developer ID signed or notarized. Windows has no configured Authenticode signing certificate. Distribution security prompts must be accurately disclosed.

## GitHub Actions

The existing tag/manual workflow remains the publication mechanism. All four native-runner jobs install with npm ci, run typecheck and tests, rebuild native Electron modules, build and package, validate artifact presence and upload matching DMG/EXE/ZIP/AppImage files. The tag must exactly match `v<package.json version>`. Only the publication job gets contents:write; it waits for every package job. Failure to find expected artifacts fails the build. Existing valid release tags can be selected manually.

When you explicitly authorize a release, set the intended version, update and commit the lockfile, verify the exact tag, then push through your normal review process. The existing workflow can publish a draft only after all package jobs pass. Never invoke it against an existing release merely to test packaging: it uploads with --clobber and makes the release public.

Before distributing, run `node scripts/desktop-smoke.mjs /absolute/path/to/packaged/executable` on each native runner or device. The smoke uses isolated data, verifies the real renderer title and clean exit, and never contacts a production database. Validate an upgrade with a copy of existing data and the original OS key store. This task's actual host/platform coverage is documented in verification.md.

## Signing

For public macOS distribution, provision Developer ID credentials, configure hardened runtime/entitlements appropriate to Electron and complete notarization/stapling. For Windows, provision a trusted signing identity and sign installers/binaries through the supported builder integration. Secrets belong in the release runner's secret store. Those identities are not present in the repository; no signed or verified-installer claim is made.

Auditbench distributions use `Auditbench-<version>-<os>-<arch>.<ext>` filenames. The stable application ID and legacy profile/key-store identity are retained for upgrades. Older published assets keep their original filenames; the website resolver accepts either brand and never invents renamed URLs for existing assets.
