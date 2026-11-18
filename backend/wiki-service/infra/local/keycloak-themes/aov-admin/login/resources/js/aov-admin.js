import { checkAuthSession, startSessionPolling } from "./authChecker.js";

const { sessionPollUrl, authSession } = document.body.dataset;
if (sessionPollUrl) startSessionPolling(sessionPollUrl);
if (authSession) checkAuthSession(authSession);

// Code fields take digits only, so phones should open the number pad.
for (const id of ["otp", "recoveryCodeInput"]) {
  document.getElementById(id)?.setAttribute("inputmode", "numeric");
}
