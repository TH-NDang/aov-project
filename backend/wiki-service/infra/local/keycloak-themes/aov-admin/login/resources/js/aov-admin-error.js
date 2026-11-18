// Hands the error of the Google sign-in to Admin, which shows its own message: to the opener when the sign-in runs in
// a popup, otherwise by returning to Admin with the code in the fragment.
(function () {
  var page = document.querySelector("[data-code]");
  if (!page) return;
  var code = page.getAttribute("data-code");
  if (window.opener) {
    try {
      // Only a stable code leaves the page. Admin accepts it from its own popup at the Keycloak origin only.
      window.opener.postMessage({ type: "aov-google-error", code: code }, "*");
    } catch (error) {
      return;
    }
    window.close();
    return;
  }
  var back = page.getAttribute("data-return");
  if (back)
    location.replace(
      back.split("#")[0] + "#google-error=" + encodeURIComponent(code),
    );
})();
