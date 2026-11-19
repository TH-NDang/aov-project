import { useEffect, useState } from "react"

type Theme = "light" | "dark"

/** index.html applies a stored choice before the first paint; without one the system preference decides. */
const STORAGE_KEY = "aov-stream-theme"
const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)")

function appliedTheme(): Theme {
  const chosen = document.documentElement.dataset.theme
  if (chosen === "light" || chosen === "dark") return chosen
  return systemDark().matches ? "dark" : "light"
}

function paintBrowserChrome(theme: Theme) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#121220" : "#f6f6fb")
}

export function useStreamTheme() {
  const [theme, updateTheme] = useState(appliedTheme)

  useEffect(() => {
    paintBrowserChrome(theme)
  }, [theme])

  useEffect(() => {
    const media = systemDark()
    const follow = () => updateTheme(appliedTheme())
    media.addEventListener("change", follow)
    window.addEventListener("aov-theme-change", follow)
    return () => {
      media.removeEventListener("change", follow)
      window.removeEventListener("aov-theme-change", follow)
    }
  }, [])

  function setTheme(next: Theme) {
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private browsing may refuse storage; the choice then lasts for this page only.
    }
    updateTheme(next)
    window.dispatchEvent(new Event("aov-theme-change"))
  }

  return { theme, setTheme }
}
