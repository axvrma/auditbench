export type Theme = "system" | "light" | "dark";
export function savedTheme(): Theme {
  const value = localStorage.getItem("lighthouse-theme");
  return value === "dark" || value === "light" ? value : "system";
}
export function applyTheme(theme: Theme, systemDark: boolean) {
  document.documentElement.dataset.theme =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;
  localStorage.setItem("lighthouse-theme", theme);
}
