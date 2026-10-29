import type { ReactNode } from "react"
import { Link, useLocation } from "react-router"
import { StreamBrand } from "./stream-brand"
import { StreamIcon } from "./stream-icon"

export const WIKI_URL = import.meta.env.VITE_WIKI_URL || "http://localhost:5173"
export const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || "http://localhost:5175"

export function StreamShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  return (
    <div className="stream-shell">
      <a href="#main" className="stream-skip">
        Đến nội dung chính
      </a>
      <header className="stream-header">
        <Link to="/" aria-label="AOV Stream — Trang chủ">
          <StreamBrand />
        </Link>
        <nav aria-label="Điều hướng chính">
          <Link
            to="/"
            aria-label="Giải đấu"
            aria-current={!location.pathname.startsWith("/games") ? "page" : undefined}
          >
            <StreamIcon name="trophy" />
            <span>Giải đấu</span>
          </Link>
          <a href={WIKI_URL} aria-label="AOV WiKi">
            <StreamIcon name="spark" />
            <span>WiKi</span>
            <StreamIcon name="external" size={12} />
          </a>
        </nav>
        <a
          className="stream-admin-link"
          href={`${ADMIN_URL}/tournaments`}
          aria-label="Đóng góp dữ liệu giải đấu"
          title="Biên tập dữ liệu giải đấu"
        >
          <StreamIcon name="plus" size={16} />
          <span>Đóng góp</span>
        </a>
      </header>
      <main id="main">{children}</main>
      <footer className="stream-footer">
        <StreamIcon name="spark" size={14} />
        <span>Quan sát trận đấu. Khám phá cách chơi.</span>
        <span>Dữ liệu được biên tập từ nguồn đối chiếu.</span>
      </footer>
    </div>
  )
}
