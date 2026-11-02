import { useEffect, useState } from "react"
import { StreamIcon } from "./stream-icon"

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
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0c111d" : "#f3f5f9")
}

export function ThemeToggle() {
  const [theme, setTheme] = useState(appliedTheme)

  useEffect(() => {
    paintBrowserChrome(theme)
  }, [theme])

  useEffect(() => {
    const media = systemDark()
    const follow = () => setTheme(appliedTheme())
    media.addEventListener("change", follow)
    return () => media.removeEventListener("change", follow)
  }, [])

  function toggle() {
    const next = theme === "dark" ? "light" : "dark"
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private browsing may refuse storage; the choice then lasts for this page only.
    }
    setTheme(next)
  }

  const label = theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"
  return (
    <button type="button" className="hub-icon-button" onClick={toggle} aria-label={label} title={label}>
      <StreamIcon name={theme === "dark" ? "sun" : "moon"} size={18} />
    </button>
  )
}
