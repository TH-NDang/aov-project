import { Link } from "react-router"
import { SkinIcon } from "./skin-icon"

export function SkinCollectionHeading({ count, updating = false }: { count?: number; updating?: boolean }) {
  return (
    <>
      <nav className="wiki-skin-breadcrumb" aria-label="Đường dẫn">
        <Link to="/">Trang chủ</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Trang phục</span>
      </nav>
      <header className="wiki-skin-collection-heading">
        <div className="wiki-skin-collection-identity">
          <span className="wiki-skin-collection-mark" aria-hidden="true">
            <SkinIcon name="collection" size={24} />
          </span>
          <h1 className="wiki-skin-title">Trang phục</h1>
        </div>
        <span className="wiki-skin-collection-count" role="status" aria-live="polite" aria-atomic="true">
          <SkinIcon name="collection" size={16} />
          {updating ? (
            <span>Đang lọc…</span>
          ) : count === undefined ? (
            <>
              <span className="wiki-skin-collection-count-skeleton wiki-skeleton" aria-hidden="true" />
              <span className="sr-only">Đang tải trang phục…</span>
            </>
          ) : (
            <>
              <strong>{count.toLocaleString("vi-VN")}</strong>
              <span>trang phục</span>
            </>
          )}
        </span>
        <span className="wiki-skin-collection-decoration" aria-hidden="true">
          <SkinIcon name="collection" size={144} />
        </span>
      </header>
    </>
  )
}
