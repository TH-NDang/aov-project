import assert from "node:assert/strict"
import { after, before, beforeEach, test } from "node:test"
import { act } from "react"
import type { Root } from "react-dom/client"
import { createWindow, installWindow, QuietResizeObserver, waitFor } from "./fixtures/dom"

const dom = createWindow()
let restoreGlobals = () => {}
const moment = "2026-11-06T18:30:00Z"
let root: Root
let chooseTimeZone: (zone: string | null) => Promise<void>
let LocalTime: typeof import("@aov/ui/components/local-time").LocalTime

const shown = () => dom.window.document.querySelector("time")!
const popup = () => dom.window.document.querySelector(".local-time-popup")
const text = () => (popup()?.textContent ?? "").replaceAll(" ", " ")

async function render(element: React.ReactElement) {
  await act(async () => root.render(element))
}

function fire(target: Element, type: string, init: Record<string, unknown> = {}) {
  const PointerEvent = (dom.window as unknown as { PointerEvent?: typeof MouseEvent }).PointerEvent
  const Base = type.startsWith("pointer") && PointerEvent ? PointerEvent : dom.window.MouseEvent
  const event = new Base(type, { bubbles: true, cancelable: true, ...init })
  if (type.startsWith("pointer") && !PointerEvent)
    Object.defineProperty(event, "pointerType", { value: init.pointerType ?? "mouse" })
  return act(async () => {
    target.dispatchEvent(event)
  })
}

before(async () => {
  restoreGlobals = installWindow(dom.window, {
    ResizeObserver: QuietResizeObserver,
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0),
    cancelAnimationFrame: (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle),
  })
  const { createRoot } = await import("react-dom/client")
  ;({ chooseTimeZone } = await import("@aov/ui/lib/time-zone"))
  ;({ LocalTime } = await import("@aov/ui/components/local-time"))
  root = createRoot(dom.window.document.getElementById("root")!)
})

beforeEach(async () => {
  await act(async () => root.render(null))
  await act(async () => chooseTimeZone("Asia/Ho_Chi_Minh"))
})

after(async () => {
  await act(async () => root.unmount())
  dom.window.close()
  restoreGlobals()
})

test("the time shows in the chosen zone, follows a new choice, and keeps its machine-readable value", async () => {
  await render(<LocalTime value={moment} format={{ hour: "2-digit", minute: "2-digit" }} />)
  assert.equal(shown().getAttribute("datetime"), moment)
  assert.match(shown().textContent!, /^01:30/)

  await act(async () => chooseTimeZone("America/New_York"))
  assert.match(shown().textContent!, /^13:30/, "a new choice applies without a reload")
})

test("screen readers get the original time without opening anything; items with no zone say UTC", async () => {
  await render(<LocalTime value={moment} />)
  assert.match(shown().textContent!, /Giờ gốc: 18:30 06\/11\/2026, UTC/)
  assert.equal(shown().getAttribute("role"), "button")
  assert.equal(shown().getAttribute("tabindex"), "0")
  assert.equal(shown().getAttribute("aria-expanded"), "false")
})

test("clicking shows the item's original time in its own zone, and clicking again closes it", async () => {
  await render(<LocalTime value={moment} sourceTimeZone="Asia/Bangkok" />)
  assert.equal(popup(), null)

  await fire(shown(), "click")
  assert.equal(shown().getAttribute("aria-expanded"), "true")
  assert.match(text(), /Giờ gốc · Thái Lan \(UTC\+7\)01:30 07\/11\/2026/)

  await act(async () => chooseTimeZone("America/New_York"))
  assert.match(text(), /Giờ của bạn · New York \(UTC-5\)13:30 06\/11\/2026/)

  await fire(shown(), "click")
  assert.equal(popup(), null)
})

test("a row around the time does not activate when the time is used", async () => {
  let activations = 0
  await render(
    <a
      href="#row"
      onClick={(event) => {
        event.preventDefault()
        activations++
      }}
    >
      <LocalTime value={moment} />
    </a>,
  )
  await fire(shown(), "click")
  assert.equal(activations, 0)
  await fire(popup()!, "click")
  assert.equal(activations, 0, "the popup sits in a portal, but React events still bubble through it")
  await act(async () => {
    shown().dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
  })
  assert.equal(activations, 0)
})

test("the keyboard reaches and toggles it: focus opens, Enter and Space press, Escape closes", async () => {
  await render(<LocalTime value={moment} />)
  await act(async () => shown().focus())
  assert.ok(popup(), "tabbing to the time opens it")

  await act(async () => {
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
  })
  assert.equal(popup(), null, "Escape closes it")

  const enter = new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
  await act(async () => {
    shown().dispatchEvent(enter)
  })
  assert.ok(popup())
  assert.equal(enter.defaultPrevented, true)

  const space = new dom.window.KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true })
  await act(async () => {
    shown().dispatchEvent(space)
  })
  assert.equal(popup(), null)
  assert.equal(space.defaultPrevented, true, "Space does not scroll the page")

  await act(async () => shown().blur())
  await fire(shown(), "pointerdown")
  await act(async () => shown().focus())
  assert.equal(popup(), null, "a press focuses it without opening before the click decides")
})

test("hovering opens it and leaving closes it; a click keeps it open", async (t) => {
  await render(<LocalTime value={moment} />)
  await fire(shown(), "pointerover", { pointerType: "mouse" })
  await waitFor(popup, "hover opens")

  await fire(shown(), "pointerout", { pointerType: "mouse" })
  await waitFor(() => popup() === null, "leaving closes")

  await fire(shown(), "pointerover", { pointerType: "mouse" })
  await waitFor(popup, "hover opens again")
  t.mock.timers.enable({ apis: ["setTimeout"] })
  try {
    await fire(shown(), "click")
    await fire(shown(), "pointerout", { pointerType: "mouse" })
    await act(async () => t.mock.timers.tick(200))
    assert.ok(popup(), "a click during hover pins it")
  } finally {
    t.mock.timers.reset()
  }
})

test("a tap works where there is no hover", async (t) => {
  await render(<LocalTime value={moment} />)
  t.mock.timers.enable({ apis: ["setTimeout"] })
  try {
    await fire(shown(), "pointerover", { pointerType: "touch" })
    await act(async () => t.mock.timers.tick(150))
    assert.equal(popup(), null, "touch never opens by hovering")
  } finally {
    t.mock.timers.reset()
  }
  await fire(shown(), "pointerdown", { pointerType: "touch" })
  await fire(shown(), "click")
  assert.ok(popup())
})

test("a date with no time is written as is: no conversion, no dashes, no popup", async () => {
  for (const zone of ["America/Los_Angeles", "Pacific/Kiritimati", "Asia/Ho_Chi_Minh"]) {
    await act(async () => chooseTimeZone(zone))
    await render(<LocalTime value="2026-10-30" />)
    assert.equal(shown().textContent, "30/10/2026", zone)
    assert.equal(shown().getAttribute("datetime"), "2026-10-30")
    assert.equal(shown().getAttribute("role"), null)
    assert.equal(shown().getAttribute("tabindex"), null)
    await fire(shown(), "click")
    assert.equal(popup(), null)
  }
})

test("pressing the popup keeps it open so its text can be selected", async () => {
  await render(<LocalTime value={moment} />)
  await act(async () => shown().focus())
  assert.ok(popup())
  const inside = popup() as HTMLElement
  await act(async () => {
    shown().dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true, relatedTarget: inside }))
  })
  assert.ok(popup(), "focus moved into the popup")
  await act(async () => {
    shown().dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true, relatedTarget: null }))
  })
  assert.equal(popup(), null, "focus moved elsewhere")
})

test("a locale or source zone this browser does not know cannot break the page", async () => {
  await render(<LocalTime value={moment} locale="not a locale" sourceTimeZone="Mars/Olympus" />)
  assert.match(shown().textContent!, /01:30/)
  assert.match(shown().textContent!, /18:30 06\/11\/2026, UTC/, "an unknown source reads as UTC")
})

test("another tab's choice applies here, and a bad stored value is ignored", async () => {
  const { currentTimeZone, browserTimeZone } = await import("@aov/ui/lib/time-zone")
  await render(<LocalTime value={moment} format={{ hour: "2-digit", minute: "2-digit" }} />)
  const fromOtherTab = async (value: string) => {
    dom.window.localStorage.setItem("aov:time-zone:v1", value)
    await act(async () => {
      dom.window.dispatchEvent(new dom.window.StorageEvent("storage", { key: "aov:time-zone:v1" }))
    })
  }
  await fromOtherTab("America/New_York")
  assert.match(shown().textContent!, /^13:30/)
  await fromOtherTab("Mars/Olympus")
  assert.equal(currentTimeZone(), browserTimeZone())
})

test("quick choices save one at a time, newest last, and the profile does not undo them meanwhile", async () => {
  const { currentTimeZone, useAccountTimeZone } = await import("@aov/ui/lib/time-zone")
  const saved: string[] = []
  const pending: (() => void)[] = []
  const save = (zone: string) =>
    new Promise<void>((resolve) => {
      saved.push(zone)
      pending.push(resolve)
    })
  const Account = ({ timeZone }: { timeZone: string }) => {
    useAccountTimeZone({ id: "me", timeZone }, save)
    return null
  }
  await render(<Account timeZone="Asia/Tokyo" />)

  let choices: Promise<unknown> = Promise.resolve()
  await act(async () => {
    choices = Promise.all([chooseTimeZone("Asia/Seoul"), chooseTimeZone("Asia/Taipei"), chooseTimeZone("Europe/Paris")])
  })
  try {
    assert.deepEqual(saved, ["Asia/Seoul"], "only one write is in flight")

    await render(<Account timeZone="Asia/Seoul" />)
    assert.equal(currentTimeZone(), "Europe/Paris", "the first write landing does not undo the newest choice")

    pending.shift()!()
    await waitFor(() => saved.length === 2)
    assert.deepEqual(saved, ["Asia/Seoul", "Europe/Paris"], "choices in between are skipped")
  } finally {
    // A save left waiting would hold up every later choice in this file.
    for (const release of pending) release()
    await act(async () => {
      await choices
    })
  }

  await render(<Account timeZone="Europe/Paris" />)
  assert.equal(currentTimeZone(), "Europe/Paris")
})

test("a missing or broken value shows the fallback and nothing to press", async () => {
  await render(<LocalTime value={null} fallback="Chưa có giờ thi đấu" />)
  assert.equal(dom.window.document.getElementById("root")!.textContent, "Chưa có giờ thi đấu")
  await render(<LocalTime value="not a date" fallback="Chưa có" />)
  assert.equal(dom.window.document.getElementById("root")!.textContent, "Chưa có")
  assert.equal(dom.window.document.querySelector("time"), null)
})

test("a saved profile sets the zone and takes new choices; a profile never saved does neither", async () => {
  const { currentTimeZone, timeZoneSaveFailed, useAccountTimeZone } = await import("@aov/ui/lib/time-zone")
  const saved: string[] = []
  let failSave = false
  const save = async (zone: string) => {
    if (failSave) throw new Error("conflict")
    saved.push(zone)
  }
  const Account = ({ profile }: { profile: { id: string | null; timeZone: string } | undefined }) => {
    useAccountTimeZone(profile, save)
    return null
  }

  await render(<Account profile={undefined} />)
  await act(async () => chooseTimeZone("Asia/Seoul"))
  assert.deepEqual<string[]>(saved, [], "nobody signed in: the choice stays in this browser")

  await render(<Account profile={{ id: null, timeZone: "Asia/Ho_Chi_Minh" }} />)
  assert.equal(currentTimeZone(), "Asia/Seoul", "a server default does not replace the choice")
  await act(async () => chooseTimeZone("Asia/Taipei"))
  assert.deepEqual<string[]>(saved, [], "a choice does not create a profile")

  await render(<Account profile={{ id: "me", timeZone: "Asia/Tokyo" }} />)
  assert.equal(currentTimeZone(), "Asia/Tokyo", "the shared profile wins when it loads")

  await act(async () => chooseTimeZone("Europe/Paris"))
  assert.deepEqual(saved, ["Europe/Paris"], "a new choice goes to the profile")
  assert.equal(currentTimeZone(), "Europe/Paris", "and applies at once")

  failSave = true
  await act(async () => chooseTimeZone("Europe/London"))
  assert.equal(currentTimeZone(), "Europe/London", "a failed save is reported, not rolled back mid-page")
  assert.equal(timeZoneSaveFailed(), true, "the failure stays known after the settings control closes")

  failSave = false
  await act(async () => chooseTimeZone("Europe/London"))
  assert.equal(timeZoneSaveFailed(), false, "choosing again clears it")
  assert.equal(saved.at(-1), "Europe/London")

  failSave = true
  await act(async () => chooseTimeZone("Asia/Jakarta"))
  assert.equal(timeZoneSaveFailed(), true)

  await render(<Account profile={undefined} />)
  await act(async () => chooseTimeZone("UTC"))
  assert.equal(saved.includes("UTC"), false, "after sign-out nothing is sent")
  assert.equal(timeZoneSaveFailed(), false, "signing out clears the failure")
})

test("a passing failure is retried once before it is reported", async () => {
  const { timeZoneSaveFailed, useAccountTimeZone } = await import("@aov/ui/lib/time-zone")
  let attempts = 0
  const save = async () => {
    attempts++
    if (attempts === 1) throw new Error("network")
  }
  const Account = () => {
    useAccountTimeZone({ id: "me", timeZone: "Asia/Tokyo" }, save)
    return null
  }
  await render(<Account />)
  await act(async () => chooseTimeZone("Asia/Seoul"))
  assert.equal(attempts, 2)
  assert.equal(timeZoneSaveFailed(), false)
})

test("the esports labels read moments in the chosen zone and leave calendar dates alone", async () => {
  const { exactDate, formatDate, formatTime, relativeDay } = await import("../src/features/esports/model/labels")
  await act(async () => chooseTimeZone("Asia/Ho_Chi_Minh"))
  assert.equal(formatTime(moment), "01:30")
  assert.equal(formatDate(moment), "07/11/2026", "the 6th in UTC is the 7th in Vietnam")
  assert.equal(formatDate("2026-10-30"), "30/10/2026")
  assert.equal(formatTime("2026-10-30"), "", "a day has no time")
  assert.equal(relativeDay(moment, new Date("2026-11-07T01:00:00Z")), "Hôm nay")
  assert.doesNotMatch(exactDate("2026-10-30"), /:/)

  await act(async () => chooseTimeZone("America/Los_Angeles"))
  assert.equal(formatTime(moment), "10:30")
  assert.equal(formatDate(moment), "06/11/2026")
  assert.equal(formatDate("2026-10-30"), "30/10/2026", "the day does not move")
  assert.equal(relativeDay(moment, new Date("2026-11-07T01:00:00Z")), "Hôm nay", "still the 6th there")
  assert.equal(relativeDay(moment, new Date("2026-11-07T09:00:00Z")), "Hôm qua")
})
