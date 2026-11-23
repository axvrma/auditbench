import { cp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
const output = new URL("../landing-dist/", import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL("../landing/", import.meta.url), output, { recursive: true });
const configured =
  process.env.SITE_URL || process.env.DEPLOY_PRIME_URL || process.env.URL;
if (configured) {
  const origin = new URL(configured).origin;
  const file = new URL("index.html", output);
  const html = (await readFile(file, "utf8"))
    .replace(
      "</head>",
      `<link rel="canonical" href="${origin}/"><meta property="og:url" content="${origin}/"></head>`,
    )
    .replace(
      'content="/assets/social.png"',
      `content="${origin}/assets/social.png"`,
    );
  await writeFile(file, html);
  await writeFile(
    new URL("sitemap.xml", output),
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>`,
  );
  await writeFile(
    new URL("robots.txt", output),
    `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`,
  );
} else {
  await writeFile(new URL("robots.txt", output), "User-agent: *\nAllow: /\n");
}
console.log(
  "Static marketing site prepared in landing-dist. No local engine or database is deployed.",
);
