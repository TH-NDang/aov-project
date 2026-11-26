import assert from "node:assert/strict"
import { after, before, beforeEach, test } from "node:test"
import { act } from "react"
import type { Root } from "react-dom/client"
import type { TournamentPlacement } from "@aov/community-contracts"
import { createWindow, flush, installWindow, QuietResizeObserver } from "./fixtures/dom"

const dom = createWindow()
let restoreGlobals = () => {}
let root: Root
let chooseCurrency: (currency: string | null) => Promise<void>
let LocalMoney: typeof import("@aov/ui/components/local-money").LocalMoney
let LocalPrizeText: typeof import("@aov/ui/components/local-money").LocalPrizeText
let FinalPlacesTable: typeof import("../src/features/competition/workspace/final-places-table").FinalPlacesTable
let TournamentAwards: typeof import("../src/features/esports/components/tournament-awards").TournamentAwards

// Each test uses its own day, because rates loaded for a day stay for the life of the page.
const dayRates: Record<string, { currency: string; unitsPerUsd: number; rateDate: string }[]> = {
  "2020-03-02": [
    { currency: "VND", unitsPerUsd: 23216, rateDate: "2020-03-02" },
    { currency: "THB", unitsPerUsd: 31.428, rateDate: "2020-03-02" },
  ],
  "2026-09-28": [{ currency: "VND", unitsPerUsd: 25761, rateDate: "2026-09-27" }],
}
const requests: string[] = []
let failNext = false

const shown = () => dom.window.document.querySelector(".local-money")
const body = () => dom.window.document.getElementById("root")!.textContent ?? ""
const popup = () => dom.window.document.querySelector(".local-time-popup")
const spaced = (text: string | null | undefined) => (text ?? "").replace(/[  ]/g, " ")

async function render(element: React.ReactElement) {
  await act(async () => root.render(element))
  await flush()
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
    fetch: async (input: string) => {
      requests.push(input)
      if (failNext) {
        failNext = false
        return new Response("", { status: 503 })
      }
      const days = new URL(input, "http://localhost").searchParams.get("on")!.split(",")
      return Response.json({ base: "USD", days: days.map((on) => ({ on, rates: dayRates[on] ?? [] })) })
    },
  })
  const { createRoot } = await import("react-dom/client")
  ;({ chooseCurrency } = await import("@aov/ui/lib/currency"))
  ;({ LocalMoney, LocalPrizeText } = await import("@aov/ui/components/local-money"))
  ;({ FinalPlacesTable } = await import("../src/features/competition/workspace/final-places-table"))
  ;({ TournamentAwards } = await import("../src/features/esports/components/tournament-awards"))
  root = createRoot(dom.window.document.getElementById("root")!)
})

beforeEach(async () => {
  await act(async () => root.render(null))
  await act(async () => chooseCurrency("VND"))
  requests.length = 0
})

after(async () => {
  await act(async () => root.unmount())
  dom.window.close()
  restoreGlobals()
})

const dollars = (amount: number) => [{ amount, currency: "USD" }]

test("an amount reads in the chosen currency at the rate of its own day, with dashes", async () => {
  await render(<LocalMoney amounts={dollars(1000)} on="2020-03-02" />)
  assert.match(spaced(shown()?.textContent), /^23\.216\.000 VND/)
  assert.equal(shown()?.getAttribute("role"), "button")
  assert.equal(shown()?.getAttribute("tabindex"), "0")

  await act(async () => chooseCurrency("THB"))
  assert.match(spaced(shown()?.textContent), /^31\.428 THB/, "a new choice applies without a reload")
})

test("the same amount on another day reads at that day's rate, and names the date of the rate", async () => {
  await render(<LocalMoney amounts={dollars(1000)} on="2026-09-28" />)
  assert.match(spaced(shown()?.textContent), /^25\.761\.000 VND/)
  assert.match(spaced(shown()?.textContent), /Tỷ giá ngày 27\/09\/2026/, "the nearest earlier rate, said plainly")
})

test("screen readers get the original without opening anything", async () => {
  await render(<LocalMoney amounts={dollars(1000)} on="2020-03-02" />)
  assert.match(spaced(shown()?.textContent), /\(Số tiền gốc: 1\.000 USD, Tỷ giá ngày 02\/03\/2020\)/)
  assert.equal(shown()?.getAttribute("aria-expanded"), "false")
})

test("clicking shows the original with its unit and the rate, and clicking again closes it", async () => {
  await render(<LocalMoney amounts={dollars(1000)} on="2020-03-02" />)
  assert.equal(popup(), null)

  await fire(shown()!, "click")
  assert.equal(shown()?.getAttribute("aria-expanded"), "true")
  const text = spaced(popup()?.textContent)
  assert.match(text, /Số tiền gốc1\.000 USD/)
  assert.match(text, /Tỷ giá ngày 02\/03\/20201 USD = 23\.216 VND/)

  await fire(shown()!, "click")
  assert.equal(popup(), null)
})

test("the keyboard opens and closes it the same way", async () => {
  await render(<LocalMoney amounts={dollars(1000)} on="2020-03-02" />)
  const press = (key: string) =>
    act(async () => {
      shown()!.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }))
    })

  await press("Enter")
  assert.notEqual(popup(), null)
  await press(" ")
  assert.equal(popup(), null)
})

test("a row around the amount does not activate when the amount is used", async () => {
  let activations = 0
  await render(
    <a href="#row" onClick={() => activations++}>
      <LocalMoney amounts={dollars(1000)} on="2020-03-02" />
    </a>,
  )
  await fire(shown()!, "click")
  assert.equal(activations, 0)
})

test("an amount already in the reader's currency is plain text and needs no rates", async () => {
  await render(<LocalMoney amounts={[{ amount: 22000000, currency: "vnd" }]} on="2020-03-02" />)
  assert.equal(shown(), null, "no dashes")
  assert.equal(dom.window.document.querySelector("[role=button]"), null)
  assert.equal(spaced(body()), "22.000.000 VND")
  assert.deepEqual(requests, [])
})

test("a prize recorded in two units reads in the one the reader uses and reveals both", async () => {
  await render(
    <LocalMoney
      amounts={[
        { amount: 948, currency: "USD" },
        { amount: 22000000, currency: "vnd" },
      ]}
      on="2020-03-02"
    />,
  )
  assert.match(spaced(shown()?.textContent), /^22\.000\.000 VND/)
  await fire(shown()!, "click")
  assert.match(spaced(popup()?.textContent), /Số tiền gốc948 USD · 22\.000\.000 VND/)
  assert.doesNotMatch(spaced(popup()?.textContent), /Tỷ giá/, "nothing was converted")
  assert.deepEqual(requests, [])
})

test("a missing rate keeps the original amount and never shows a wrong number", async () => {
  await render(<LocalMoney amounts={dollars(1000)} on="2010-01-01" />)
  assert.equal(shown(), null)
  assert.equal(spaced(body()), "1.000 USD")

  await render(<LocalMoney amounts={[{ amount: 500, currency: "EUR" }]} on="2020-03-02" />)
  assert.equal(shown(), null)
  assert.equal(spaced(body()), "500 EUR")
})

test("a failed request keeps the original amount", async () => {
  failNext = true
  await render(<LocalMoney amounts={dollars(1000)} on="2021-01-01" />)
  assert.equal(shown(), null)
  assert.equal(spaced(body()), "1.000 USD")
})

test("a word in place of a currency reads as written", async () => {
  await render(<LocalMoney amounts={[{ amount: 10000, currency: "nội tệ" }]} on="2020-03-02" />)
  assert.equal(spaced(body()), "10.000 nội tệ")
})

test("no amount shows the fallback", async () => {
  await render(<LocalMoney amounts={[{ amount: null, currency: "USD" }]} fallback="–" />)
  assert.equal(body(), "–")
  assert.deepEqual(requests, [])
})

test("a page of prizes asks for all its days in one request", async () => {
  await render(
    <>
      <LocalMoney amounts={dollars(1)} on="2022-01-01" />
      <LocalMoney amounts={dollars(2)} on="2022-02-01" />
      <LocalMoney amounts={dollars(3)} on="2022-02-01" />
    </>,
  )
  assert.equal(requests.length, 1)
  assert.match(requests[0], /on=2022-01-01,2022-02-01$/)
})

test("the short form keeps the exact amount in its popup", async () => {
  await render(<LocalMoney amounts={dollars(1000)} on="2020-03-02" compact />)
  assert.match(spaced(shown()?.textContent), /^23 Tr ₫/)
  await fire(shown()!, "click")
  assert.match(spaced(popup()?.textContent), /Đơn vị của bạn23\.216\.000 VND/)

  await act(async () => chooseCurrency("USD"))
  assert.equal(shown(), null)
  assert.equal(body(), "$1K")
})

test("a final table reads each prize at the rate of the day the tournament ended", async () => {
  const content = { startsOn: "2020-02-20", endsOn: "2020-03-02", localCurrency: "vnd" }
  const row = (recorded: TournamentPlacement) => ({
    key: recorded.place,
    state: "RECORDED" as const,
    recorded,
    ...recorded,
  })
  const team = (id: string) => ({ id, name: id, shortName: id })
  await render(
    <>
      <FinalPlacesTable
        rows={[
          row({ place: "1", teamName: "Đội A", prizeUsd: 425.19, prizeLocal: 10000000 }),
          row({ place: "2", teamName: "Đội B", prizeUsd: 170.08 }),
          row({ place: "3", teamName: "Đội C", prizeLocal: 4000000 }),
        ]}
        content={content}
        team={team}
      />
      <TournamentAwards
        content={{ ...content, awards: [{ title: "MVP", recipientName: "X", prizeUsd: 100 }] }}
        team={team}
      />
    </>,
  )
  const [first, second, third] = [...dom.window.document.querySelectorAll("tbody tr")].map((entry) =>
    spaced(entry.textContent),
  )
  assert.match(
    first!,
    /Đội A.*10\.000\.000 VND \(Số tiền gốc: 425,19 USD · 10\.000\.000 VND\)/,
    "the recorded amount, not a conversion",
  )
  assert.match(second!, /Đội B.*3\.948\.577 VND \(Số tiền gốc: 170,08 USD, Tỷ giá ngày 02\/03\/2020\)/)
  assert.match(third!, /Đội C.*4\.000\.000 VND/)
  assert.match(spaced(body()), /MVP.*2\.321\.600 VND/)
})

test("a prize pool written as text is read when it is certain and kept as written when it is not", async () => {
  await render(<LocalPrizeText text="3,500 USD" currency="USD" on="2020-03-02" />)
  assert.match(spaced(shown()?.textContent), /^81\.256\.000 VND/)

  await render(<LocalPrizeText text="100 triệu" currency="VND" on="2020-03-02" />)
  assert.equal(shown(), null)
  assert.equal(body(), "100 triệu VND", "the unit still follows the words")

  await render(<LocalPrizeText text="Hơn 100 triệu VND" currency="VND" on="2020-03-02" />)
  assert.equal(body(), "Hơn 100 triệu VND", "the unit is not said twice")

  await render(<LocalPrizeText text="6650000000" currency="" />)
  assert.equal(spaced(body()), "6.650.000.000", "digits with no unit stay readable")
})
