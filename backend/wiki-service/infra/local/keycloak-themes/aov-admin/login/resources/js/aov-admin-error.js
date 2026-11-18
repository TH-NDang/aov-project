// Hands the error of the Google sign-in popup to the Admin window, which shows its own message, then closes.
(function () {
  var page = document.querySelector("[data-code]");
  if (!page || !window.opener) return;
  try {
    // Only a stable code leaves the page. Admin accepts it from its own popup at the Keycloak origin only.
    window.opener.postMessage(
      { type: "aov-google-error", code: page.getAttribute("data-code") },
      "*",
    );
  } catch (error) {
    return;
  }
  window.close();
})();
