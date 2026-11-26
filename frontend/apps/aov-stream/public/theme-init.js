// Applies a stored light/dark choice before the first paint; otherwise the system preference decides. A file rather
// than an inline script, so that the content security policy can refuse every inline script.
try {
  const theme = localStorage.getItem("aov-stream-theme")
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme
} catch {}
