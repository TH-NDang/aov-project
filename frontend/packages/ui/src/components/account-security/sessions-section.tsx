import { useState } from "react"
import { Laptop, LogOut, MonitorSmartphone, Smartphone } from "lucide-react"
import {
  applicationName,
  deviceName,
  type AccountSecurityApi,
  type AccountSession,
  type SessionList,
} from "../../lib/account-security"
import { relativeTime, type Text } from "../../lib/account-security-model"
import { LocalTime } from "../local-time"
import { factLine, Section } from "./security-section"

/** Where the account is signed in, with a confirmed sign-out for one device or every other one. */
export function SessionsSection({
  sessions,
  api,
  locale,
  text,
  onChanged,
}: {
  sessions: SessionList | null
  api: AccountSecurityApi
  locale: string
  text: Text
  onChanged: () => Promise<unknown>
}) {
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")
  const others = sessions?.sessions.filter((session) => !session.current) ?? []

  async function run(key: string, work: () => Promise<unknown>) {
    setBusy(key)
    setError("")
    try {
      await work()
      setConfirming(null)
      await onChanged()
    } catch {
      setError(text("Chưa đăng xuất được. Vui lòng thử lại.", "Could not sign out. Please try again."))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Section
      icon={<MonitorSmartphone size={18} aria-hidden="true" />}
      title={text("Thiết bị đăng nhập", "Signed-in devices")}
    >
      <p className="pas-muted">
        {text(
          "Các nơi tài khoản đang đăng nhập. Vị trí hiển thị dưới dạng địa chỉ IP.",
          "Where your account is signed in. Location is shown as an IP address.",
        )}
      </p>
      {sessions && !sessions.deviceDetails && (
        <p className="pas-muted">
          {text(
            "Chưa lấy được tên trình duyệt; vẫn hiển thị IP và thời gian.",
            "Browser names are unavailable; IP and times are still shown.",
          )}
        </p>
      )}
      <ul className="pas-sessions">
        {sessions?.sessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            locale={locale}
            text={text}
            confirming={confirming === session.id}
            busy={busy === session.id}
            onAsk={() => setConfirming(session.id)}
            onCancel={() => setConfirming(null)}
            onConfirm={() => void run(session.id, () => api.signOutSession(session.id))}
          />
        ))}
      </ul>
      {error && (
        <p className="pas-error" role="alert">
          {error}
        </p>
      )}
      {others.length > 0 && (
        <div className="pas-actions">
          {confirming === "others" ? (
            <>
              <button
                type="button"
                className="pas-button pas-button-danger"
                disabled={busy !== null}
                onClick={() => void run("others", api.signOutOtherSessions)}
              >
                {busy === "others"
                  ? text("Đang đăng xuất…", "Signing out…")
                  : text(
                      `Xác nhận đăng xuất ${others.length} thiết bị`,
                      `Confirm signing out ${others.length} devices`,
                    )}
              </button>
              <button type="button" className="pas-button" onClick={() => setConfirming(null)}>
                {text("Hủy", "Cancel")}
              </button>
            </>
          ) : (
            <button type="button" className="pas-button" onClick={() => setConfirming("others")}>
              <LogOut size={16} aria-hidden="true" />
              {text("Đăng xuất mọi thiết bị khác", "Sign out all other devices")}
            </button>
          )}
        </div>
      )}
    </Section>
  )
}

function SessionRow({
  session,
  locale,
  text,
  confirming,
  busy,
  onAsk,
  onCancel,
  onConfirm,
}: {
  session: AccountSession
  locale: string
  text: Text
  confirming: boolean
  busy: boolean
  onAsk: () => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const name = deviceName(session.device) ?? text("Thiết bị không rõ", "Unknown device")
  const Icon = session.device?.mobile ? Smartphone : Laptop
  const apps = session.applications.map(applicationName).join(", ")
  return (
    <li className="pas-session" data-current={session.current || undefined}>
      <Icon size={20} aria-hidden="true" />
      <div>
        <strong>
          {name}
          {session.current && <span className="pas-badge pas-badge-ok">{text("Thiết bị này", "This device")}</span>}
        </strong>
        <span>
          {[
            session.ipAddress && `IP ${session.ipAddress}`,
            session.lastAccessAt &&
              text(
                `Hoạt động ${relativeTime(session.lastAccessAt, locale)}`,
                `Active ${relativeTime(session.lastAccessAt, locale)}`,
              ),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span>
          {factLine([
            session.startedAt && (
              <>
                {text("Đăng nhập ", "Signed in ")}
                <LocalTime value={session.startedAt} locale={locale} />
              </>
            ),
            apps,
          ])}
        </span>
      </div>
      {!session.current &&
        (confirming ? (
          <div className="pas-row-actions">
            <button type="button" className="pas-button pas-button-danger" disabled={busy} onClick={onConfirm}>
              {busy ? text("Đang đăng xuất…", "Signing out…") : text("Xác nhận", "Confirm")}
            </button>
            <button type="button" className="pas-button" onClick={onCancel} disabled={busy}>
              {text("Hủy", "Cancel")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="pas-button"
            onClick={onAsk}
            aria-label={text(`Đăng xuất ${name}`, `Sign out ${name}`)}
          >
            {text("Đăng xuất", "Sign out")}
          </button>
        ))}
    </li>
  )
}
