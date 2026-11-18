const parameters = new URLSearchParams(location.hash.slice(1))
const state = parameters.get("state")
const status = parameters.get("status")
history.replaceState(null, "", location.pathname)
const message = document.getElementById("status")
const valid = state && /^[A-Za-z0-9_-]{43}$/.test(state) && status
// Same key as GOOGLE_REDIRECT_KEY in src/app/auth/auth-api.ts.
const redirectKey = "aov-admin-google-redirect"

function sameOriginTarget(path) {
  const target = new URL(typeof path === "string" && path ? path : "../", location.href)
  return target.origin === location.origin ? target.href : new URL("../", location.href).href
}

if (window.opener && valid) {
  // This is only a completion signal. Tokens remain between the backend and its HttpOnly cookie.
  window.opener.postMessage({ type: "aov-google-complete", state, status }, location.origin)
  message.textContent =
    status === "success"
      ? "Đăng nhập thành công. Bạn có thể đóng cửa sổ này."
      : "Đăng nhập chưa hoàn tất. Hãy quay lại trang quản trị."
} else {
  // Same-page sign-in, used when the browser blocked the popup: return to the Admin page it started from, which
  // reads the status. A state this tab did not start is not followed.
  let saved = null
  try {
    saved = JSON.parse(sessionStorage.getItem(redirectKey) || "null")
  } catch {
    saved = null
  }
  if (valid && saved && saved.state === state) {
    try {
      sessionStorage.setItem(redirectKey, JSON.stringify({ ...saved, status }))
    } catch {
      /* The Admin page still signs in from the cookie; only a failure message is lost. */
    }
    message.textContent = "Đang quay lại trang quản trị…"
    location.replace(sameOriginTarget(saved.returnTo))
  } else {
    message.textContent = "Hãy quay lại trang quản trị để tiếp tục đăng nhập."
  }
}
