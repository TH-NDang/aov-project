import { Link } from "react-router"
import { StreamHead } from "./stream-head"
import { useStreamLocale } from "./stream-locale"
import { StreamShell } from "./stream-shell"

/** An address Stream has no page for. It stays where it is, so a mistyped link says so instead of opening home. */
export function StreamNotFound() {
  const { text } = useStreamLocale()
  return (
    <StreamShell>
      <StreamHead title={text("Không tìm thấy trang — AOV Stream", "Page not found — AOV Stream")} noindex />
      <div className="cp-container">
        <section className="hub-state">
          <h1>{text("Không tìm thấy trang", "Page not found")}</h1>
          <p>
            {text("Địa chỉ này không có trang nào trên AOV Stream.", "There is no page at this address on AOV Stream.")}
          </p>
          <div className="hub-state-actions">
            <Link className="cp-button cp-primary" to="/">
              {text("Về trang chủ", "Back to home")}
            </Link>
            <Link className="cp-button" to="/competitions">
              {text("Xem các giải đấu", "See tournaments")}
            </Link>
          </div>
        </section>
      </div>
    </StreamShell>
  )
}
