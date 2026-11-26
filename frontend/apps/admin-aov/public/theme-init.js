// Applies the stored theme before the first paint. A file rather than an inline script, so that the content security
// policy can refuse every inline script.
try {
  var t = localStorage.getItem("aov-admin-theme")
  if (t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches))
    document.documentElement.classList.add("dark")
} catch (e) {}
