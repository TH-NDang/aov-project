import assert from "node:assert/strict"
import { test } from "node:test"
import { button, click, field, pageText, render, type, waitFor, withDom } from "./fixtures/dom.tsx"
import {
  challengeWith,
  fakeAccountApi,
  overviewWith,
  recordedActions,
  secondsFromNow,
  twoFactorOn,
} from "./fixtures/account-security.ts"
import { AccountSecurityError } from "../src/lib/account-security.ts"
import type { AccountActionResult } from "../src/lib/public-auth.ts"

withDom()
const { PublicAccountSecurity } = await import("../src/components/public-account-security.tsx")

type Fake = ReturnType<typeof fakeAccountApi>

async function show(fake: Fake = fakeAccountApi(), actionResult: AccountActionResult | null = null) {
  const actions = recordedActions()
  await render(
    <PublicAccountSecurity locale="en" api={fake.api} startAction={actions.startAction} actionResult={actionResult} />,
  )
  await waitFor(() => pageText().includes("Password") || pageText().includes("Could not reach"))
  return { ...fake, actions: actions.actions }
}

async function openPasswordForm(password = "correct horse", repeat = password) {
  await click(button("Change password"), "change password button")
  await type(field("New password"), password)
  await type(field("Repeat new password"), repeat)
  await click(button("Send confirmation code"), "send code button")
}

const alerts = () => [...document.querySelectorAll('[role="alert"]')].map((alert) => alert.textContent?.trim())
const status = () => document.querySelector('.pas-notice[role="status"]')?.textContent

test("the settings show the email and whether it is verified once the account loads", async () => {
  const fake = await show()

  assert.match(pageText(), /player@example\.testVerified/)
  assert.deepEqual(
    fake.calls.map((call) => call.name),
    ["overview", "sessions"],
  )
})

test("a failed load offers a retry that reads the account again", async () => {
  let failures = 1
  const fake = fakeAccountApi({
    overview: async () => {
      if (failures-- > 0) throw new AccountSecurityError(0, "NETWORK_ERROR")
      return overviewWith()
    },
  })
  await show(fake)
  assert.match(pageText(), /Could not reach the account server/)

  await click(button("Retry"), "retry button")

  await waitFor(() => pageText().includes("player@example.test"))
  assert.equal(fake.callsTo("overview").length, 2)
})

test("an account without a password is offered to set one", async () => {
  await show(fakeAccountApi({ overview: async () => overviewWith({ password: { set: false, updatedAt: null } }) }))

  assert.ok(button("Set password"))
  assert.match(pageText(), /Your account has no password yet/)
})

test("an account that cannot receive the code is told why the password cannot change", async () => {
  await show(fakeAccountApi({ overview: async () => overviewWith({ passwordChangeAvailable: false }) }))

  assert.equal(button("Change password"), undefined)
  assert.match(pageText(), /Password changes are unavailable/)
})

test("a password shorter than eight characters is refused before a code is sent", async () => {
  const fake = await show()

  await openPasswordForm("short")

  assert.deepEqual(alerts(), ["Use at least 8 characters."])
  assert.equal(fake.callsTo("startPasswordChange").length, 0)
})

test("passwords that do not match are refused before a code is sent", async () => {
  const fake = await show()

  await openPasswordForm("correct horse", "correct horses")

  assert.deepEqual(alerts(), ["The passwords do not match."])
  assert.equal(fake.callsTo("startPasswordChange").length, 0)
})

test("a matching new password sends a code in the page language and asks for it", async () => {
  const fake = await show()

  await openPasswordForm()

  await waitFor(() => pageText().includes("A 6-digit code was sent to p***@example.test"))
  assert.deepEqual(fake.callsTo("startPasswordChange")[0]!.args, ["en"])
  assert.ok(field("Confirmation code"))
})

test("a six-digit code changes the password, reports the devices signed out and reloads the account", async () => {
  const fake = await show(
    fakeAccountApi({ confirmPasswordChange: async () => ({ otherSessions: "SIGNED_OUT", signedOut: 2 }) }),
  )
  await openPasswordForm()
  await type(field("Confirmation code"), "123456")

  await click(button("Change password"), "confirm button")

  await waitFor(() => status() === "Password changed and 2 other devices signed out.")
  assert.deepEqual(fake.callsTo("confirmPasswordChange")[0]!.args, [
    "challenge-1",
    { code: "123456", newPassword: "correct horse", signOutOtherSessions: true, language: "en" },
  ])
  assert.equal(fake.callsTo("overview").length, 2)
  assert.ok(button("Change password"), "the form closes back to its button")
})

test("keeping the other devices signed in is sent with the code", async () => {
  const fake = await show()
  await openPasswordForm()
  await type(field("Confirmation code"), "123456")
  await click(field("Sign out of other devices"), "sign out others checkbox")

  await click(button("Change password"), "confirm button")

  await waitFor(() => status() === "Password changed.")
  assert.equal(
    (fake.callsTo("confirmPasswordChange")[0]!.args[1] as { signOutOtherSessions: boolean }).signOutOtherSessions,
    false,
  )
})

test("a code field keeps only digits and refuses fewer than six of them", async () => {
  const fake = await show()
  await openPasswordForm()
  const code = field("Confirmation code")

  await type(code, "12a4")
  await click(button("Change password"), "confirm button")

  assert.equal(code.value, "124")
  assert.deepEqual(alerts(), ["Enter the 6-digit code."])
  assert.equal(fake.callsTo("confirmPasswordChange").length, 0)
})

test("a wrong code tells how many attempts are left", async () => {
  await show(
    fakeAccountApi({
      confirmPasswordChange: async () => {
        throw new AccountSecurityError(400, "USER_PASSWORD_CODE_INVALID", { attemptsRemaining: 2 })
      },
    }),
  )
  await openPasswordForm()
  await type(field("Confirmation code"), "123456")

  await click(button("Change password"), "confirm button")

  await waitFor(() => alerts().includes("Incorrect code. 2 attempts left."))
})

test("a rejected password names the rule it breaks", async () => {
  await show(
    fakeAccountApi({
      confirmPasswordChange: async () => {
        throw new AccountSecurityError(400, "USER_PASSWORD_REJECTED", { policy: "passwordHistory" })
      },
    }),
  )
  await openPasswordForm()
  await type(field("Confirmation code"), "123456")

  await click(button("Change password"), "confirm button")

  await waitFor(() => alerts().includes("Do not reuse a recent password."))
})

test("the code cannot be sent again before the server allows it", async () => {
  await show(
    fakeAccountApi({ startPasswordChange: async () => challengeWith({ resendAvailableAt: secondsFromNow(30) }) }),
  )

  await openPasswordForm()

  const resend = await waitFor(() => button("Resend in"))
  assert.match(resend.textContent ?? "", /^Resend in \d+s$/)
  assert.equal(resend.disabled, true)
})

test("sending the code again asks the server for a new code", async () => {
  const fake = await show()
  await openPasswordForm()

  await click(await waitFor(() => button("Resend code")), "resend button")

  assert.equal(fake.callsTo("startPasswordChange").length, 2)
})

test("cancelling the password change closes the form without a request", async () => {
  const fake = await show()
  await click(button("Change password"), "change password button")

  await click(button("Cancel"), "cancel button")

  assert.ok(button("Change password"))
  assert.equal(document.querySelector("form"), null)
  assert.equal(fake.callsTo("startPasswordChange").length, 0)
})

test("a signed-in device shows its name, address, apps and when it was last active", async () => {
  await show()

  const phone = document.querySelectorAll(".pas-session")[1]!
  assert.match(phone.textContent ?? "", /^Chrome 130 · Android 14/)
  assert.match(phone.textContent ?? "", /IP 203\.0\.113\.7 · Active 2 hours ago/)
  assert.match(phone.textContent ?? "", /AOV Stream, AOV WiKi/)
  assert.match(document.querySelectorAll(".pas-session")[0]!.textContent ?? "", /This device/)
  assert.match(document.querySelectorAll(".pas-session")[2]!.textContent ?? "", /^Unknown device/)
})

test("signing out a device asks for confirmation before it signs that session out", async () => {
  const fake = await show()

  await click(button("Sign out Chrome 130 · Android 14"), "sign out phone button")
  assert.equal(fake.callsTo("signOutSession").length, 0)
  await click(button("Confirm"), "confirm button")

  assert.deepEqual(fake.callsTo("signOutSession")[0]!.args, ["s-phone"])
  assert.equal(fake.callsTo("sessions").length, 2)
})

test("signing out every other device says how many it signs out", async () => {
  const fake = await show()

  await click(button("Sign out all other devices"), "sign out others button")
  await click(button("Confirm signing out 2 devices"), "confirm button")

  assert.equal(fake.callsTo("signOutOtherSessions").length, 1)
  assert.equal(fake.callsTo("sessions").length, 2)
})

test("a sign-out that fails says so", async () => {
  await show(
    fakeAccountApi({
      signOutSession: async () => {
        throw new AccountSecurityError(500, "UNKNOWN")
      },
    }),
  )

  await click(button("Sign out Chrome 130 · Android 14"), "sign out phone button")
  await click(button("Confirm"), "confirm button")

  await waitFor(() => alerts().includes("Could not sign out. Please try again."))
})

test("turning on two-step sign-in opens the authenticator setup without a fresh sign-in", async () => {
  const shown = await show()

  await click(button("Turn on two-step sign-in"), "turn on button")

  assert.deepEqual(shown.actions, [["CONFIGURE_TOTP", { reauthenticate: false }]])
})

test("two-step sign-in that is on shows its device and the recovery codes left", async () => {
  await show(fakeAccountApi({ overview: async () => overviewWith({ twoFactor: twoFactorOn }) }))

  assert.match(pageText(), /Device: Pixel · On since/)
  assert.match(pageText(), /8\/10 recovery codes left\./)
})

test("turning off two-step sign-in deletes its authenticator after a fresh sign-in", async () => {
  const shown = await show(fakeAccountApi({ overview: async () => overviewWith({ twoFactor: twoFactorOn }) }))

  await click(button("Turn off two-step sign-in"), "turn off button")

  assert.deepEqual(shown.actions, [["delete_credential:otp-1", { reauthenticate: true }]])
})

test("regenerating the recovery codes asks for a fresh sign-in", async () => {
  const shown = await show(fakeAccountApi({ overview: async () => overviewWith({ twoFactor: twoFactorOn }) }))

  await click(button("Regenerate recovery codes"), "regenerate button")

  assert.deepEqual(shown.actions, [["CONFIGURE_RECOVERY_AUTHN_CODES", { reauthenticate: true }]])
})

test("recovery codes left over after two-step sign-in was turned off can be removed", async () => {
  const leftover = { ...overviewWith().twoFactor, recoveryCodes: twoFactorOn.recoveryCodes }
  const fake = await show(fakeAccountApi({ overview: async () => overviewWith({ twoFactor: leftover }) }))

  await click(button("Remove old recovery codes"), "remove codes button")

  assert.equal(fake.callsTo("removeRecoveryCodes").length, 1)
  assert.equal(fake.callsTo("overview").length, 2)
})

test("returning from the authenticator setup opens the recovery codes page right away", async () => {
  const fake = fakeAccountApi()
  const actions = recordedActions()

  await render(
    <PublicAccountSecurity
      locale="en"
      api={fake.api}
      startAction={actions.startAction}
      actionResult={{ action: "CONFIGURE_TOTP", status: "success" }}
    />,
  )

  await waitFor(() => actions.actions.length > 0)
  assert.deepEqual(actions.actions, [["CONFIGURE_RECOVERY_AUTHN_CODES"]])
  assert.equal(status(), "Opening recovery codes…")
  assert.equal(fake.calls.length, 0)
})

test("returning from turning off two-step sign-in removes the recovery codes and says it is off", async () => {
  const fake = await show(fakeAccountApi(), { action: "delete_credential:otp-1", status: "success" })

  await waitFor(() => status() === "Two-step sign-in is off.")
  assert.deepEqual(
    fake.calls.map((call) => call.name),
    ["removeRecoveryCodes", "overview", "sessions"],
  )
})

test("returning from new recovery codes says two-step sign-in is on", async () => {
  await show(fakeAccountApi(), { action: "CONFIGURE_RECOVERY_AUTHN_CODES", status: "success" })

  await waitFor(() => status() === "New recovery codes were created. Two-step sign-in is on.")
})

test("an action the reader cancelled at the identity provider is reported as cancelled", async () => {
  await show(fakeAccountApi(), { action: "CONFIGURE_TOTP", status: "cancelled" })

  await waitFor(() => status() === "You cancelled.")
})
