const parameters = new URLSearchParams(location.hash.slice(1))
const state = parameters.get("state")
const status = parameters.get("status")
history.replaceState(null, "", location.pathname)
const message = document.getElementById("status")
const valid = state && /^[A-Za-z0-9_-]{43}$/.test(state) && status
// Same key as GOOGLE_REDIRECT_KEY in src/app/auth/auth-api.ts.
const redirectKey = "aov-admin-google-redirect"
// Same name as GOOGLE_CHANNEL in src/app/auth/auth-api.ts.
const channelName = "aov-admin-google"

function sameOriginTarget(path) {
  const target = new URL(typeof path === "string" && path ? path : "../", location.href)
  return target.origin === location.origin ? target.href : new URL("../", location.href).href
}

function readSaved() {
  try {
    return JSON.parse(sessionStorage.getItem(redirectKey) || "null")
  } catch {
    return null
  }
}

// Reaches the Admin tab that started the sign-in when this window lost its opener on the way (a COOP header on a page
// of the flow does that). Like the opener message, it carries no token.
function broadcast() {
  if (typeof BroadcastChannel === "undefined") return false
  try {
    const channel = new BroadcastChannel(channelName)
    channel.postMessage({ type: "aov-google-complete", state, status })
    channel.close()
    return true
  } catch {
    return false
  }
}

const saved = valid && !window.opener ? readSaved() : null

if (window.opener && valid) {
  // This is only a completion signal. Tokens remain between the backend and its HttpOnly cookie.
  window.opener.postMessage({ type: "aov-google-complete", state, status }, location.origin)
  message.textContent =
    status === "success"
      ? "Đăng nhập thành công. Bạn có thể đóng cửa sổ này."
      : "Đăng nhập chưa hoàn tất. Hãy quay lại trang quản trị."
} else if (saved && saved.state === state) {
  // Same-page sign-in, used when the browser blocked the popup: return to the Admin page it started from, which
  // reads the status. A state this tab did not start is not followed.
  try {
    sessionStorage.setItem(redirectKey, JSON.stringify({ ...saved, status }))
  } catch {
    /* The Admin page still signs in from the cookie; only a failure message is lost. */
  }
  message.textContent = "Đang quay lại trang quản trị…"
  location.replace(sameOriginTarget(saved.returnTo))
} else if (valid && broadcast()) {
  message.textContent =
    status === "success"
      ? "Đăng nhập thành công. Bạn có thể đóng cửa sổ này."
      : "Đăng nhập chưa hoàn tất. Hãy quay lại trang quản trị."
  // A popup closes itself; the browser ignores this for a tab the person opened. The delay lets the message leave first.
  setTimeout(() => window.close(), 300)
} else {
  message.textContent = "Hãy quay lại trang quản trị để tiếp tục đăng nhập."
}
