import assert from "node:assert/strict"
import test from "node:test"

import { AccountSecurityError } from "../src/lib/account-security.ts"
import { actionNotice, passwordError, relativeTime } from "../src/lib/account-security-model.ts"
import { localeText } from "../src/lib/locale-text.ts"
import { hoursAgo } from "./fixtures/account-security.ts"

const english = localeText("en")
const failure = (code, context = {}) => new AccountSecurityError(400, code, context)

test("a cancelled action reads as cancelled", () => {
  assert.deepEqual(actionNotice({ action: "CONFIGURE_TOTP", status: "cancelled" }, english), {
    tone: "info",
    message: "You cancelled.",
  })
})

test("an action that failed at the identity provider reads as an error", () => {
  assert.equal(actionNotice({ action: "CONFIGURE_TOTP", status: "error" }, english)?.tone, "error")
})

test("new recovery codes say that two-step sign-in is on", () => {
  const notice = actionNotice({ action: "CONFIGURE_RECOVERY_AUTHN_CODES", status: "success" }, english)

  assert.equal(notice?.message, "New recovery codes were created. Two-step sign-in is on.")
})

test("a deleted authenticator says that two-step sign-in is off", () => {
  const notice = actionNotice({ action: "delete_credential:otp-1", status: "success" }, english)

  assert.equal(notice?.message, "Two-step sign-in is off.")
})

test("any other finished action reads as saved", () => {
  assert.deepEqual(actionNotice({ action: "CONFIGURE_TOTP", status: "success" }, english), {
    tone: "success",
    message: "Saved.",
  })
})

test("no time gives no relative time", () => {
  assert.equal(relativeTime(null, "en"), null)
})

test("a time a few hours ago reads in hours", () => {
  assert.equal(relativeTime(hoursAgo(2), "en"), "2 hours ago")
})

test("a time more than a day ago reads in days", () => {
  assert.equal(relativeTime(hoursAgo(49), "en"), "2 days ago")
})

test("a time within the last minute reads as this minute", () => {
  assert.equal(relativeTime(hoursAgo(0), "en"), "this minute")
})

test("a relative time reads in Vietnamese for any locale that is not English", () => {
  assert.equal(
    relativeTime(hoursAgo(2), "vi-VN"),
    new Intl.RelativeTimeFormat("vi", { numeric: "auto" }).format(-2, "hour"),
  )
})

test("a wrong code tells how many attempts are left", () => {
  assert.equal(
    passwordError(failure("USER_PASSWORD_CODE_INVALID", { attemptsRemaining: 3 }), english),
    "Incorrect code. 3 attempts left.",
  )
})

test("a wrong code with no attempts left asks for a new code", () => {
  assert.equal(
    passwordError(failure("USER_PASSWORD_CODE_INVALID"), english),
    "Incorrect code and no attempts left. Send a new code.",
  )
})

test("a wait of less than two minutes before a new code is told in seconds", () => {
  assert.equal(
    passwordError(failure("USER_PASSWORD_CODE_RATE_LIMITED", { retryAfterSeconds: 90 }), english),
    "Too many codes requested. Try again in 90 seconds.",
  )
})

test("a longer wait before a new code is told in whole minutes", () => {
  assert.equal(
    passwordError(failure("USER_PASSWORD_CODE_RATE_LIMITED", { retryAfterSeconds: 150 }), english),
    "Too many codes requested. Try again in 3 minutes.",
  )
})

test("each password rule the server names has its own message", () => {
  const rejected = (policy) => passwordError(failure("USER_PASSWORD_REJECTED", { policy }), english)

  assert.equal(rejected("passwordMinLength"), "The password is too short.")
  assert.equal(rejected("passwordHistory"), "Do not reuse a recent password.")
  assert.equal(rejected("passwordNotUsername"), "The password must not match your username or email.")
  assert.equal(rejected("passwordNotEmail"), "The password must not match your username or email.")
  assert.equal(rejected("passwordBlacklist"), "This password is too common.")
})

test("a password rule the screen does not know asks for a stronger password", () => {
  assert.equal(
    passwordError(failure("USER_PASSWORD_REJECTED", { policy: "upperCase" }), english),
    "The password does not meet the security rules. Add capitals, digits or symbols and try again.",
  )
})

test("an expired code asks for a new code", () => {
  assert.equal(passwordError(failure("USER_PASSWORD_CODE_EXPIRED"), english), "The code expired. Send a new code.")
})

test("an error that does not come from the account server reads as a general failure", () => {
  assert.equal(passwordError(new Error("offline"), english), "Something went wrong. Please try again.")
})

test("an error code the screen does not know reads as a general failure", () => {
  assert.equal(passwordError(failure("SOMETHING_NEW"), english), "Something went wrong. Please try again.")
})
