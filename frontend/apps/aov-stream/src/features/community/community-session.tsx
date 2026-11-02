import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router"
import { completeLogin, signIn, signOut, useCommunitySession } from "./community-auth"
import { StreamShell } from "../../components/stream-shell"
import { StreamIcon } from "../../components/stream-icon"
import { AccountAvatar } from "../account/account-profile"
import { useOwnProfile } from "../account/profile-api"

export function CommunitySessionButton() {
  const session = useCommunitySession()
  const profile = useOwnProfile()
  const location = useLocation()
  const [error, setError] = useState("")
  const name = profile.data?.displayName || session.name
  return (
    <div className="cp-session">
      {session.status === "authenticated" ? (
        <>
          <Link
            className="account-session-link"
            to="/account"
            title="Tài khoản"
            aria-label={`Tài khoản: ${name}`}
            aria-current={location.pathname === "/account" ? "page" : undefined}
          >
            <AccountAvatar url={profile.data?.avatarUrl} name={name} />
            <span>{name}</span>
          </Link>
          <button className="account-signout" title="Đăng xuất" aria-label="Đăng xuất" onClick={() => signOut()}>
            <StreamIcon name="logout" size={16} />
            <span>Đăng xuất</span>
          </button>
        </>
      ) : (
        <button onClick={() => void signIn().catch(() => setError("Chưa mở được đăng nhập."))}>Đăng nhập</button>
      )}
      {error && <span role="alert">{error}</span>}
    </div>
  )
}
export function CommunityLoginCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    void completeLogin()
      .then((path) => {
        if (active) navigate(path, { replace: true })
      })
      .catch((error) => {
        if (active) setError(error.message)
      })
    return () => {
      active = false
    }
  }, [navigate])
  return (
    <StreamShell>
      <div className="cp-container cp-empty">
        <h1>{error ? "Đăng nhập chưa hoàn tất" : "Đang hoàn tất đăng nhập…"}</h1>
        {error && (
          <>
            <p role="alert">{error}</p>
            <Link className="cp-button" to="/pages">
              Về danh bạ
            </Link>
          </>
        )}
      </div>
    </StreamShell>
  )
}
