import { checkAuthSession, startSessionPolling } from "./authChecker.js";

const { sessionPollUrl, authSession } = document.body.dataset;
if (sessionPollUrl) startSessionPolling(sessionPollUrl);
if (authSession) checkAuthSession(authSession);

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest("a[data-once-link]");
  if (!link) return;
  if (link.getAttribute("aria-disabled") === "true") {
    event.preventDefault();
    return;
  }
  link.setAttribute("aria-disabled", "true");
  link.classList.add("aov-disabled");
});
