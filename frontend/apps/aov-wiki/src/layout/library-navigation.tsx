import { NavLink } from "react-router"
import type { ReactNode } from "react"
import "./library-navigation.css"

const NAV_ICONS = {
  book: (
    <>
      <path d="M5 4h12a2 2 0 0 1 2 2v14H7a3 3 0 0 1-3-3V5a1 1 0 0 1 1-1Z" />
      <path d="M7 4v13m-3 0h15m-9-9h6m-6 4h4" />
    </>
  ),
  hero: (
    <>
      <path d="m12 3 7 6-2 10-5 3-5-3L5 9Z" />
      <path d="m8 10 4 2 4-2m-4-7v9m-3 2 1 3m5-3-1 3" />
    </>
  ),
  skin: (
    <>
      <path d="M3 6c4 2 5 0 9-1 4 1 5 3 9 1l-2 10-7 5-7-5Z" />
      <path d="m6 10 4 1-1 2-3-1m12-2-4 1 1 2 3-1m-8 4h4" />
    </>
  ),
  equipment: (
    <>
      <path d="m4 3 9 10-2 2L2 5V3Zm16 0-9 10 2 2 9-10V3Z" />
      <path d="m13 15 6 6m-8-6-6 6m10-8 5 5M9 13l-5 5" />
    </>
  ),
  map: (
    <>
      <path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2Zm6-2v14m6-12v14" />
      <path d="m5 13 2-3m4-1 2 3m4 2 2-3" />
    </>
  ),
  mode: (
    <>
      <path d="M5 22V4m0 1c6-5 8 4 15 0v11c-7 4-9-5-15 0" />
      <path d="m10 8 5 2-5 2Z" />
    </>
  ),
} satisfies Record<string, ReactNode>

export function LibraryNavIcon({ name }: { name: keyof typeof NAV_ICONS }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {NAV_ICONS[name]}
    </svg>
  )
}

const UPCOMING = [
  { label: "Kho trang bị", icon: "equipment" },
  { label: "Bản đồ", icon: "map" },
  { label: "Chế độ chơi", icon: "mode" },
] as const

export function LibraryNavigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="wiki-library-navigation" aria-label="Danh mục wiki">
      <details className="wiki-library-nav-group" open>
        <summary>
          <LibraryNavIcon name="book" />
          <span>Sổ tay nhân vật</span>
          <span className="wiki-library-nav-chevron" aria-hidden="true">
            ⌃
          </span>
        </summary>
        <NavLink className="wiki-library-nav-hero wiki-library-nav-child" to="/hero" onClick={onNavigate}>
          <LibraryNavIcon name="hero" />
          <span>Danh sách tướng</span>
          <span className="wiki-library-nav-art" aria-hidden="true" />
        </NavLink>
        <div className="wiki-library-nav-unavailable wiki-library-nav-child" aria-disabled="true">
          <LibraryNavIcon name="skin" />
          <span>Trang phục</span>
          <span className="wiki-library-nav-soon">Sắp có</span>
        </div>
      </details>
      <div className="wiki-library-nav-upcoming">
        {UPCOMING.map((item) => (
          <div key={item.label} className="wiki-library-nav-unavailable" aria-disabled="true">
            <LibraryNavIcon name={item.icon} />
            <span>{item.label}</span>
            <span className="wiki-library-nav-soon">Sắp có</span>
          </div>
        ))}
      </div>
      <NavLink className="wiki-library-nav-home" to="/" onClick={onNavigate}>
        Về trang chủ<span aria-hidden="true">↗</span>
      </NavLink>
    </nav>
  )
}
