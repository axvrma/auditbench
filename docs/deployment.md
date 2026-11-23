# Public website deployment

The marketing site remains buildless HTML/CSS/JavaScript in landing/. Its small preparation script uses only Node built-ins to copy files to landing-dist and generate deployment-specific metadata. No backend, local database, native modules, Netlify Functions or paid service is required at runtime.

## Netlify

Connect this repository, choose `main` as the production branch, and use the committed netlify.toml. It selects Node 24, runs `node scripts/build-landing.mjs` and publishes only `landing-dist`. Pull-request deploy previews use the same command. Native installation scripts are disabled during the automatic dependency installation; the marketing preparation script needs no installed packages.

Set `SITE_URL=https://your-custom-domain.example` to make your preferred domain canonical. Without it, Netlify's DEPLOY_PRIME_URL or URL supplies the deployed origin. The build generates an absolute canonical URL, Open Graph URL/image, sitemap.xml and robots.txt. Configure the custom domain and HTTPS in Netlify's domain settings; no domain is guessed or purchased by this implementation. A local build without any deployment URL still works but intentionally cannot advertise a canonical origin or sitemap URL.

Local production preview:

```sh
SITE_URL=https://your-domain.example npm run build:landing
python3 -m http.server 8080 --bind 127.0.0.1 --directory landing-dist
```

All page resources use root-relative paths. Serve at the site root. CSP restricts scripts, fonts and images to the site, permits only the public GitHub API connection, and denies frames and plugins. HTML and scripts use normal cache validation; assets cache for one day and version-stable bundled fonts for one year. No analytics or third-party font request is required.

## Downloads

The page reads the official repository's latest GitHub release. It only accepts HTTPS GitHub URLs under this repository's release-download path. It discovers available DMGs, Windows NSIS EXE or portable ZIP, and Linux x64/x86_64 AppImages. An EXE is preferred if both Windows formats are present. Platform choice stays manual and explicit. Missing assets, malformed metadata, timeouts and API rate limits retain the valid official releases-page fallback.

The current v1.1.0 Windows asset is a ZIP and the Linux filename uses x86_64. Neither is replaced with a constructed installer link. The page discloses Chrome requirements and unsigned/non-notarized distributions. Asset availability is not a guarantee of code signing.

## Validation

`npm run test:landing` runs desktop/mobile browser checks, release-failure fallback and a real mobile Lighthouse audit. `npm test` verifies local asset references and output separation. Scores and local results are in verification.md. No Netlify deployment was created or modified in this task; production/PR deployments occur after the repository changes are pushed through your existing integration.
