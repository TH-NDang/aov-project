import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import type { TimelineEvent } from "../src/features/esports/model/timeline"
import { inPage, game, lookups, popoverGlobals } from "./fixtures/esports-ui"

test("faces pressed with the mouse leave the focus in the form of a moment, so Enter saves it", async () => {
  await inPage(async (document, render) => {
    const { EventComposer } = await import("../src/features/esports/components/game/event-composer")
    const saved: TimelineEvent[] = []
    await render(
      <EventComposer
        game={game}
        at={100}
        knownDuration={900}
        items={[]}
        initialKind="KILL"
        snapshotsFor={() => []}
        events={[]}
        onSave={(event) => saved.push(event)}
        onCancel={() => {}}
      />,
    )
    const window = document.defaultView!
    /** A press with the mouse: the browser moves the focus to what is pressed, unless the press says otherwise. */
    const press = async (face: HTMLButtonElement) => {
      const down = new window.MouseEvent("mousedown", { bubbles: true, cancelable: true })
      face.dispatchEvent(down)
      if (!down.defaultPrevented) face.focus()
      await act(async () => face.click())
    }
    const group = (label: string) => document.querySelector(`[role="group"][aria-label="${label}"]`)!
    await press(group("Hạ gục").querySelector<HTMLButtonElement>('[data-seat="BLUE:JUNGLE"]')!)
    await press(group("Bị hạ").querySelector<HTMLButtonElement>('[data-seat="RED:MID"]')!)
    const focused = document.activeElement as HTMLElement
    await act(async () =>
      focused.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })),
    )
    assert.equal(saved.length, 1, "Enter saved the moment")
    assert.equal(saved[0]!.kind === "KILL" && saved[0]!.victim, "RED:MID")
  }, popoverGlobals)
})

test("a long title of a moment is said whole where the list cuts it", async () => {
  await inPage(async (document, render) => {
    const { MomentRow } = await import("../src/features/esports/components/game/moment-row")
    const title = "Pha cướp Rồng của Sinestrea trong lúc bốn tướng đội đỏ đang vây quanh mục tiêu"
    const note: TimelineEvent = { id: "n1", kind: "NOTE", at: 200, title }
    await render(
      <ul>
        <MomentRow
          event={note}
          game={game}
          lookups={lookups}
          videoSecond={null}
          later={false}
          active
          onSelect={() => {}}
        />
      </ul>,
    )
    assert.equal(document.querySelector(".esp-moment-title")?.getAttribute("title"), title)
  })
})
