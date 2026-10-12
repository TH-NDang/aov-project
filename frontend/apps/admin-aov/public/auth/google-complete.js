const parameters = new URLSearchParams(location.hash.slice(1))
const state = parameters.get("state")
const status = parameters.get("status")
history.replaceState(null, "", location.pathname)
const message = document.getElementById("status")
if (window.opener && state && /^[A-Za-z0-9_-]{43}$/.test(state) && status) {
  // This is only a completion signal. Tokens remain between the backend and its HttpOnly cookie.
  window.opener.postMessage({ type: "aov-google-complete", state, status }, location.origin)
  message.textContent =
    status === "success"
      ? "Đăng nhập thành công. Bạn có thể đóng cửa sổ này."
      : "Đăng nhập chưa hoàn tất. Hãy quay lại trang quản trị."
} else {
  message.textContent = "Hãy quay lại trang quản trị để tiếp tục đăng nhập."
}
