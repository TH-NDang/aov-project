import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
import {
  click,
  control,
  currentLocation,
  field,
  pageText,
  press,
  renderAt,
  serve,
  type,
  waitFor,
  withDom,
} from "./fixtures/dom.tsx"
import { setSession, signedIn, signIns } from "./fixtures/stream-auth.ts"
import { claim, managers, notification, page, slice, viewer } from "./fixtures/community-data.ts"

withDom()
const { CommunityAccount } = await import("../src/features/community/pages/community-account-page.tsx")
const { CommunityPageManager } = await import("../src/features/community/pages/community-manage-page.tsx")
const { CommunityInvitation } = await import("../src/features/community/pages/community-invitation-page.tsx")

const saigon = page("page-saigon", "Saigon Phantom")

beforeEach(() => {
  setSession({ status: "anonymous", name: "", revision: 0 })
  signIns.length = 0
  window.location.hash = ""
})

const showAccount = (tab: string) =>
  renderAt(`/account${tab ? `?tab=${tab}` : ""}`, { "/account": <CommunityAccount /> })

const showManager = () =>
  renderAt("/manage/page-saigon", { "/manage/:id": <CommunityPageManager />, "/account": <p>Account</p> })

function serveManager(role: "OWNER" | "EDITOR" | "MODERATOR" | "", extra: Record<string, unknown> = {}) {
  return serve({
    "GET /me/pages/page-saigon/profile": saigon,
    "GET /me/pages/page-saigon": viewer(role),
    "GET /me/pages/page-saigon/members": managers,
    ...extra,
  })
}

test("a visitor who is not signed in is asked to sign in instead of seeing the account sections", async () => {
  serve({})
  await showAccount("follows")

  assert.match(pageText(), /Sign in to join the community/)
  assert.equal(document.querySelector('nav[aria-label="Account sections"]'), null)
})

test("signing in from the account prompt opens the sign-in page", async () => {
  serve({})
  await showAccount("")

  await click(control("Create account"), "create account button")

  assert.deepEqual(signIns, [[true]])
})

test("an account section opens from the address and choosing another one changes the address", async () => {
  signedIn()
  serve({ "GET /me/follows": slice([]), "GET /me/notifications": slice([]) })
  await showAccount("follows")
  assert.equal(document.querySelector("[aria-current=page]")?.textContent, "Following")

  await click(control("Notifications"), "notifications tab")

  assert.equal(currentLocation(), "/account?tab=notifications")
})

test("the profile section drops the section from the address", async () => {
  signedIn()
  serve({ "GET /me/follows": slice([]) })
  await showAccount("follows")

  await click(control("Profile"), "profile tab")

  assert.equal(currentLocation(), "/account")
})

test("the notifications section shows how many notifications are unread", async () => {
  signedIn()
  serve({ "GET /me/follows": slice([]), "GET /me/notifications/unread": { unread: 2 } })
  await showAccount("follows")

  const count = await waitFor(() => document.querySelector(".cp-tab-count"))
  assert.equal(count.textContent, "2")
  assert.equal(count.getAttribute("aria-label"), "2 unread")
})

test("the following section lists the followed pages with their kind and followers", async () => {
  signedIn()
  serve({ "GET /me/follows": slice([saigon, page("page-an", "An", { kind: "PLAYER", followers: 1 })]) })
  await showAccount("follows")

  await waitFor(() => document.querySelectorAll(".cp-row").length === 2)
  const rows = [...document.querySelectorAll(".cp-row-text")].map((row) => row.textContent)
  assert.deepEqual(rows, ["Saigon PhantomTeam · 1,200 followers", "AnPlayer · 1 follower"])
  assert.equal(document.querySelector("#account-follows small")?.textContent, "2")
})

test("unfollowing a page tells the service to stop following that page", async () => {
  signedIn()
  const server = serve({ "GET /me/follows": slice([saigon]), "POST /me/pages/page-saigon/follow": undefined })
  await showAccount("follows")

  await click(await waitFor(() => control("Unfollow Saigon Phantom")), "unfollow button")

  await waitFor(() => server.to("POST /me/pages/page-saigon/follow").length === 1)
  assert.deepEqual(server.to("POST /me/pages/page-saigon/follow")[0]!.body, { following: false })
})

test("a reader who follows no page is pointed to Explore", async () => {
  signedIn()
  serve({ "GET /me/follows": slice([]) })
  await showAccount("follows")

  await waitFor(() => pageText().includes("You are not following any pages yet."))
  assert.equal(control("Explore pages")?.getAttribute("href"), "/explore")
})

test("marking every notification read sends one request", async () => {
  signedIn()
  const server = serve({
    "GET /me/notifications": slice([notification("n1", "New post", false)], 24),
    "GET /me/notifications/unread": { unread: 1 },
    "POST /me/notifications/read-all": undefined,
  })
  await showAccount("notifications")

  await click(await waitFor(() => control("Mark all as read")), "mark all button")

  await waitFor(() => server.to("POST /me/notifications/read-all").length === 1)
})

test("an unread notification can be marked read on its own", async () => {
  signedIn()
  const server = serve({
    "GET /me/notifications": slice([notification("n1", "New post", false), notification("n2", "Old post", true)], 24),
    "GET /me/notifications/unread": { unread: 1 },
    "POST /me/notifications/n1/read": undefined,
  })
  await showAccount("notifications")
  await waitFor(() => pageText().includes("Unread: New post"))
  assert.equal(document.querySelectorAll(".cp-note-read").length, 1)

  await click(control("Mark as read"), "mark read button")

  await waitFor(() => server.to("POST /me/notifications/n1/read").length === 1)
})

test("the pages section lists the managed pages and the status of each request", async () => {
  signedIn()
  serve({
    "GET /me/pages": [saigon],
    "GET /me/claims": [claim("c1", "Hanoi Kings", "PENDING"), claim("c2", "Da Nang", "REJECTED", "No proof")],
  })
  await showAccount("pages")

  await waitFor(() => pageText().includes("Hanoi Kings"))
  assert.equal(document.querySelector(".cp-row-link")?.getAttribute("href"), "/manage/page-saigon")
  assert.deepEqual(
    [...document.querySelectorAll(".cp-badge")].map((badge) => [badge.textContent, badge.getAttribute("data-status")]),
    [
      ["Pending review", "PENDING"],
      ["Not approved", "REJECTED"],
    ],
  )
  assert.match(pageText(), /Da NangNo proof/)
})

test("a reader without managed pages or requests is told how to get them", async () => {
  signedIn()
  serve({ "GET /me/pages": [], "GET /me/claims": [] })
  await showAccount("pages")

  await waitFor(() => pageText().includes("You have not sent any requests yet."))
  assert.match(pageText(), /You do not manage any pages yet\./)
})

test("a visitor is asked to sign in before managing a page", async () => {
  serve({})
  await showManager()

  assert.match(pageText(), /Sign in to manage the page/)
})

test("a reader without a role on the page is told they cannot manage it", async () => {
  signedIn()
  serveManager("")
  await showManager()

  await waitFor(() => pageText().includes("You are not allowed to manage this page yet."))
  assert.equal(control("Back to Pages & requests")?.getAttribute("href"), "/account?tab=pages")
})

test("the manager shows the page with the reader's role", async () => {
  signedIn()
  serveManager("EDITOR")
  await showManager()

  await waitFor(() => document.querySelector("h1")?.textContent === "Saigon Phantom")
  assert.match(pageText(), /Team · your role: editor/)
  assert.equal(control("View public page")?.getAttribute("href"), "/pages/saigon")
})

test("saving the introduction sends the edited text with the version the reader saw", async () => {
  signedIn()
  const server = serveManager("EDITOR", { "PUT /me/pages/page-saigon/presentation": undefined })
  await showManager()
  await waitFor(() => field("Introduction"))

  await type(field<HTMLTextAreaElement>("Introduction"), "Champions of the winter season")
  await click(control("Save introduction"), "save button")

  await waitFor(() => server.to("PUT /me/pages/page-saigon/presentation").length === 1)
  assert.deepEqual(server.to("PUT /me/pages/page-saigon/presentation")[0]!.body, {
    version: 3,
    content: { biography: "Champions of the winter season", avatarUrl: null, coverUrl: null, links: [] },
  })
})

test("a new channel takes the name of its platform from the link", async () => {
  signedIn()
  serveManager("EDITOR")
  await showManager()
  await click(await waitFor(() => control("Add channel")), "add channel button")

  await type(field("Link"), "https://www.youtube.com/@saigon")

  assert.equal(field("Channel name").value, "YouTube")
})

test("a moderator can read the introduction but not change it", async () => {
  signedIn()
  serveManager("MODERATOR")
  await showManager()

  await waitFor(() => document.querySelector("fieldset"))
  assert.equal(document.querySelector("fieldset")?.disabled, true)
  assert.equal(control("Save introduction"), undefined)
  assert.equal(control("Add channel"), undefined)
})

test("the managers section lists every manager with their role", async () => {
  signedIn()
  serveManager("OWNER")
  await showManager()

  await click(await waitFor(() => control("Managers")), "managers tab")

  await waitFor(() => pageText().includes("Linh (you)"))
  assert.deepEqual(
    [...document.querySelectorAll(".cp-rows .cp-row-text")].map((row) => row.textContent),
    ["Linh (you)Owner", "AnEditor"],
  )
})

test("revoking a manager asks for confirmation before it is sent", async () => {
  signedIn()
  const server = serveManager("OWNER", { "POST /me/pages/page-saigon/members/member-an/revoke": undefined })
  await showManager()
  await click(await waitFor(() => control("Managers")), "managers tab")

  await press(await waitFor(() => control("Actions for An")), "Enter", "member menu")
  await click(await waitFor(() => document.querySelector('[role=menuitem][data-variant="destructive"]')), "revoke item")
  assert.match(pageText(), /An will lose management access to this page\./)
  assert.equal(server.to("POST /me/pages/page-saigon/members/member-an/revoke").length, 0)
  await click(control("Revoke access", document.querySelector(".cp-confirm")!), "confirm revoke button")

  await waitFor(() => server.to("POST /me/pages/page-saigon/members/member-an/revoke").length === 1)
})

test("creating an invitation asks the service for a link with the chosen role", async () => {
  signedIn()
  const server = serveManager("OWNER", { "POST /me/pages/page-saigon/invitations": { token: "tok-1" } })
  await showManager()
  await click(await waitFor(() => control("Managers")), "managers tab")

  await type(field<HTMLSelectElement>("Role"), "MODERATOR")
  await click(control("Create invitation link"), "create invitation button")

  await waitFor(() => server.to("POST /me/pages/page-saigon/invitations").length === 1)
  assert.deepEqual(server.to("POST /me/pages/page-saigon/invitations")[0]!.body, { role: "MODERATOR" })
})

test("an editor sees no way to invite or remove managers", async () => {
  signedIn()
  serveManager("EDITOR")
  await showManager()

  await click(await waitFor(() => control("Managers")), "managers tab")

  await waitFor(() => pageText().includes("Linh (you)"))
  assert.equal(control("Actions for An"), undefined)
  assert.equal(control("Create invitation link"), undefined)
})

test("a visitor is asked to sign in before accepting an invitation", async () => {
  serve({})
  window.location.hash = "#tok-1"
  await renderAt("/invitations", { "/invitations": <CommunityInvitation /> })

  assert.match(pageText(), /Sign in to accept the invitation/)
})

test("an invitation link without its code says the link is incomplete", async () => {
  signedIn()
  serve({})
  await renderAt("/invitations", { "/invitations": <CommunityInvitation /> })

  assert.match(pageText(), /The invitation link is incomplete/)
})

test("accepting an invitation sends its code and opens the manager of that page", async () => {
  signedIn()
  const server = serve({ "POST /me/invitations/accept": { pageId: "page-saigon" } })
  window.location.hash = "#tok-1"
  await renderAt("/invitations", { "/invitations": <CommunityInvitation />, "/manage/:id": <p>Manager</p> })

  await click(control("Accept invitation"), "accept button")

  await waitFor(() => currentLocation() === "/manage/page-saigon")
  assert.deepEqual(server.to("POST /me/invitations/accept")[0]!.body, { token: "tok-1" })
})
