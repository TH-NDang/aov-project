import assert from "node:assert/strict"
import { test } from "node:test"
import { click, control, currentLocation, pageText, renderAt, serve, waitFor, withDom } from "./fixtures/dom.tsx"
import { announcedCompetition, finishedCompetition } from "./fixtures/competition-data.ts"

withDom()
const { PublicCompetitionPage } = await import("../src/features/tournaments/competition-page.tsx")

async function showCompetition(search = "", view = finishedCompetition()) {
  const server = serve({ "GET /competitions/aog": view })
  await renderAt(`/competitions/aog${search}`, { "/competitions/:id": <PublicCompetitionPage /> })
  await waitFor(() => document.querySelector("h1")?.textContent === "AOG Winter 2026")
  return server
}

const chosenTab = () => document.querySelector(".cp-tabs [aria-current=page]")?.textContent
const headings = () => [...document.querySelectorAll(".tn-block h2")].map((heading) => heading.textContent?.trim())

test("a competition that is still loading says so", async () => {
  serve({ "GET /competitions/aog": () => new Promise(() => {}) })

  await renderAt("/competitions/aog", { "/competitions/:id": <PublicCompetitionPage /> })

  assert.equal(document.querySelector('[role="status"] h1')?.textContent, "Loading tournament…")
  assert.equal(control("All tournaments")?.getAttribute("href"), "/competitions")
})

test("a competition that cannot be read says why and offers a retry", async () => {
  serve({})

  await renderAt("/competitions/aog", { "/competitions/:id": <PublicCompetitionPage /> })

  const alert = await waitFor(() => document.querySelector('[role="alert"]'))
  assert.equal(alert.querySelector("h1")?.textContent, "This published content could not be found.")
  assert.ok(control("Retry", alert))
})

test("the header names the competition with its circuit, tier, dates, teams and champion", async () => {
  await showCompetition()

  const header = document.querySelector(".tn-comp-head")!
  assert.equal(header.querySelector(".hub-kicker")?.textContent, "AOG · VN · S-Tier")
  assert.match(header.textContent ?? "", /3 teams/)
  assert.equal(header.querySelector(".tn-champion-team strong")?.textContent, "Saigon Phantom")
  assert.match(header.querySelector(".tn-champion")?.textContent ?? "", /Won 4–2 against Hanoi Kings/)
})

test("the overview shows the latest matches, the table and the bracket with the facts beside them", async () => {
  await showCompetition()

  assert.equal(chosenTab(), "Overview")
  assert.deepEqual(headings(), ["Latest matches", "Standings Group stage", "Bracket Grand final"])
  assert.equal(document.querySelectorAll(".tn-table tbody tr").length, 3)
  assert.deepEqual(
    [...document.querySelectorAll(".tn-side-card h2")].map((heading) => heading.textContent),
    ["Information", "Format", "Individual awards"],
  )
})

test("the facts list the organizer, the format, the venue, the time zone and the sources", async () => {
  await showCompetition()

  const facts = [...document.querySelectorAll(".tn-facts > div")].map((row) => [
    row.querySelector("dt")?.textContent,
    row.querySelector("dd")?.textContent,
  ])
  assert.deepEqual(facts, [
    ["Organizer", "Garena"],
    ["Format", "League · Offline"],
    ["Venue", "Studio One, Ho Chi Minh City"],
    ["Schedule time zone", "Asia/Ho_Chi_Minh"],
  ])
  assert.deepEqual(
    [...document.querySelectorAll(".tn-links a")].map((link) => [link.textContent, link.getAttribute("href")]),
    [
      ["Official site", "https://aog.example.test"],
      ["Verification source", "https://source.example.test"],
    ],
  )
})

test("a table row shows the record, the game difference and who advanced", async () => {
  await showCompetition()

  const [first, , last] = [...document.querySelectorAll(".tn-table tbody tr")]
  assert.deepEqual(
    [...first!.querySelectorAll("td")].map((cell) => cell.textContent),
    ["1, secured a spot to advance", "2", "2–0", "4–1", "+3", "2"],
  )
  assert.equal(last!.querySelector("td:nth-last-child(2)")?.textContent, "-4")
  assert.equal(last!.hasAttribute("data-qualified"), false)
  assert.match(pageText(), /Secured a spot to advance/)
})

test("the format card names each stage's format, best-of and tiebreakers", async () => {
  await showCompetition()

  const stages = [...document.querySelectorAll(".tn-stages li")].map((row) => row.textContent)
  assert.deepEqual(stages, [
    "Group stageRound robin · BO3 · 2 legs · 2 teams advanceTiebreakers: game difference → head-to-head",
    "Grand finalSingle elimination · BO7",
  ])
})

test("only the first four award titles show until the rest are unfolded", async () => {
  await showCompetition()
  const titles = () => document.querySelectorAll(".tn-awards dt").length
  assert.equal(titles(), 4)

  await click(control("Show 2 more awards"), "more awards button")

  assert.equal(titles(), 6)
  assert.equal(control("Show less")?.getAttribute("aria-expanded"), "true")
})

test("an award given to several players lists each of them under one title", async () => {
  await showCompetition()

  await click(control("Show 2 more awards"), "more awards button")

  const weekly = [...document.querySelectorAll(".tn-awards > div")].find((group) =>
    group.querySelector("dt")?.textContent?.startsWith("Week 1"),
  )
  assert.deepEqual(
    [...weekly!.querySelectorAll("dd")].map((recipient) => recipient.textContent),
    ["Ba", "Bon"],
  )
})

test("the bracket address opens the standings and bracket tab", async () => {
  await showCompetition("?tab=bracket")

  assert.equal(chosenTab(), "Standings & bracket")
  assert.deepEqual(headings(), ["Group stage Final", "Grand final Single elimination"])
  assert.ok(document.querySelector('.tn-bracket[aria-label="Grand final bracket"]'))
})

test("a bracket without lanes names each of its rounds", async () => {
  await showCompetition("?tab=standings")

  const titles = [...document.querySelectorAll(".tn-bracket-title")].map((title) => title.textContent)
  assert.deepEqual(titles, ["Round 1"])
})

test("leaving the schedule tab drops the schedule's filters from the address", async () => {
  await showCompetition("?tab=matches&team=team-sgp&stage=GROUP")
  assert.equal(chosenTab(), "Schedule & results")

  await click(control("Participating teams"), "teams tab")

  assert.equal(currentLocation(), "/competitions/aog?tab=teams")
})

test("choosing the overview drops the tab from the address", async () => {
  await showCompetition("?tab=teams")

  await click(control("Overview"), "overview tab")

  assert.equal(currentLocation(), "/competitions/aog")
})

test("a team's roster lists the starters in lane order and the substitutes after them", async () => {
  await showCompetition("?tab=teams")

  const saigon = document.querySelector(".tn-team-card")!
  assert.deepEqual(
    [...saigon.querySelectorAll("li")].map((row) => [row.querySelector("small")?.textContent, row.dataset.bench]),
    [
      ["Dark Slayer lane", undefined],
      ["Mid lane", undefined],
      ["Substitute", "true"],
    ],
  )
  assert.match(saigon.textContent ?? "", /LaiDark Slayer lane.*MotMid lane.*HaiSubstitute/)
})

test("the teams tab counts the teams without a published roster and marks a withdrawn team", async () => {
  await showCompetition("?tab=teams")

  assert.match(pageText(), /1 of 3 teams have not published a roster yet\./)
  assert.match(document.querySelectorAll(".tn-team-card")[2]!.textContent ?? "", /Da Nang KnightsWithdrawn/)
})

test("a competition without a schedule says so and points to its teams", async () => {
  await showCompetition("", announcedCompetition())
  assert.match(pageText(), /The schedule has not been announced/)

  await click(control("See the 3 teams taking part"), "teams button")

  assert.equal(currentLocation(), "/competitions/aog?tab=teams")
  assert.equal(document.activeElement?.textContent, "Participating teams")
})
