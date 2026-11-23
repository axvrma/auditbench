const releases = "https://github.com/axvrma/auditbench/releases/latest";
const menu = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#navigation");
menu?.addEventListener("click", () => {
  const open = menu.getAttribute("aria-expanded") !== "true";
  menu.setAttribute("aria-expanded", String(open));
  navigation?.classList.toggle("open", open);
});
navigation?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    menu?.setAttribute("aria-expanded", "false");
    navigation.classList.remove("open");
  }
});
async function loadDownloads() {
  try {
    const response = await fetch(
      "https://api.github.com/repos/axvrma/auditbench/releases/latest",
      {
        signal: AbortSignal.timeout(7000),
        headers: { Accept: "application/vnd.github+json" },
      },
    );
    if (!response.ok) throw new Error("Release metadata unavailable");
    const release = await response.json();
    if (!Array.isArray(release.assets) || typeof release.tag_name !== "string")
      throw new Error("Invalid release metadata");
    for (const card of document.querySelectorAll("[data-platform]")) {
      const platform = card.dataset.platform;
      const match = release.assets
        .filter(
          (asset) =>
            typeof asset.name === "string" &&
            typeof asset.browser_download_url === "string",
        )
        .sort(
          (a, b) =>
            Number(/\.exe$/i.test(b.name)) - Number(/\.exe$/i.test(a.name)),
        )
        .find((asset) => {
          const name = asset.name.toLowerCase();
          return platform === "mac-arm64"
            ? /(?:mac|darwin).*arm64.*\.dmg$/.test(name)
            : platform === "mac-x64"
              ? /(?:mac|darwin).*x64.*\.dmg$/.test(name)
              : platform === "win-x64"
                ? /win.*x64.*\.(exe|zip)$/.test(name)
                : /linux.*(?:x64|x86_64).*\.appimage$/.test(name);
        });
      if (match) {
        const target = new URL(match.browser_download_url);
        if (
          target.origin !== "https://github.com" ||
          !target.pathname.startsWith(
            "/axvrma/auditbench/releases/download/",
          )
        )
          continue;
        card.href = target.href;
        card.querySelector("small").textContent = /\.zip$/i.test(match.name)
          ? "Download portable ZIP"
          : /\.exe$/i.test(match.name)
            ? "Download NSIS installer"
            : /\.dmg$/i.test(match.name)
              ? "Download DMG"
              : "Download AppImage";
      } else {
        card.href = releases;
        card.querySelector("small").textContent = "Check release availability";
      }
    }
    document.querySelector("#release-status").textContent =
      `${release.tag_name} · Downloads resolved from the official GitHub release.`;
  } catch {
    document.querySelector("#release-status").textContent =
      "Live release details are unavailable. Choose a platform to browse official GitHub releases.";
  }
}
void loadDownloads();
