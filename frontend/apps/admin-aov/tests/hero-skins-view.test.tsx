import assert from "node:assert/strict"
import { test } from "node:test"
import { act } from "react"
import { createMemoryRouter, RouterProvider } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@aov/ui/components/tooltip"
import type { CaptureGroup, CaptureImage } from "../src/features/publishing/model/captures/patch-capture-model"
import type { HeroShop, SkinAcquisition } from "@/lib/api/publishing-api"
import type { Skin } from "@/lib/hero-types"
import type { PatchCaptureWorkspace } from "../src/features/publishing/api/use-patch-captures"
import { createWindow, installWindow, waitFor } from "./fixtures/dom"

let currentFetch: typeof fetch
const dispatchFetch: typeof fetch = (input, init) => currentFetch(input, init)

const skin = (key: string, order: number, name: string): Skin => ({
  skinKey: key,
  displayOrder: order,
  headAssetId: `${key}-head`,
  portraitAssetId: `${key}-portrait`,
  artAssetId: `${key}-art`,
  rarityCode: null,
  translations: [{ locale: "vi-VN", name, description: null, acquisitionNote: null }],
})

const acquisition = (key: string, extra: Partial<SkinAcquisition> = {}): SkinAcquisition => ({
  skinKey: key,
  method: "VOUCHER",
  voucherPrice: 39,
  eventName: null,
  capturedOn: "2026-09-16",
  needsReview: false,
  note: null,
  ...extra,
})

const card = (key: string, reading: string): CaptureImage => ({
  id: `card-${key}`,
  fileName: `${key}.jpg`,
  archive: "shop",
  member: `${key}.jpg`,
  section: "SHOP",
  link: "SHOP",
  skillKey: null,
  skillName: null,
  notes: [],
  kind: "skin",
  skinKey: key,
  entryName: key,
  reading,
  card: 1,
  box: { x: 0, y: 0, width: 10, height: 20, imageWidth: 100, imageHeight: 100 },
  capturedOn: "2026-09-16",
})

const skins = [skin("a", 0, "Trang phục A"), skin("b", 1, "Trang phục B"), skin("c", 2, "Trang phục C")]

async function view(
  options: {
    shop?: Partial<HeroShop>
    captures?: Partial<PatchCaptureWorkspace>
    canWrite?: boolean
    url?: string
  } = {},
) {
  const dom = createWindow("http://localhost/hero/hero-1")
  const requests: string[] = []
  const saves: { path: string; body: Record<string, unknown> }[] = []
  let shop: HeroShop = {
    region: "VN",
    at: "2026-11-06T00:00:00Z",
    price: null,
    skins: [acquisition("a"), acquisition("b", { needsReview: true })],
    priceHistory: [],
    skinHistory: [acquisition("a"), acquisition("a", { capturedOn: "2026-01-01", voucherPrice: 20 })],
    ...options.shop,
  }
  currentFetch = async (input, init) => {
    const path = String(input).replace("/api/wiki/v1", "")
    requests.push(path)
    if (path === "/auth/refresh") return Response.json({ accessToken: "test", expiresIn: 3600 })
    if (path === "/auth/logout") return new Response(null, { status: 204 })
    if (path === "/admin/me")
      return Response.json({ issuer: "fixture", subject: "editor", type: "HUMAN", capabilities: ["hero:write"] })
    if (path === "/users/me") return Response.json({ locale: "vi-VN" })
    const shopPath = /^\/admin\/heroes\/hero-1\/shop\/skins\/([^/?]+)\?region=VN$/.exec(path)
    if (shopPath && init?.method === "PUT") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>
      saves.push({ path, body })
      const saved = { skinKey: shopPath[1], ...body } as SkinAcquisition
      shop = { ...shop, skins: [...shop.skins.filter((row) => row.skinKey !== shopPath[1]), saved] }
      return Response.json(saved)
    }
    if (path.startsWith("/admin/heroes/hero-1/shop")) return Response.json(shop)
    const batch = /^\/admin\/media\/assets\/batch\?ids=([^&]+)$/.exec(path)
    if (batch)
      return Response.json({
        items: batch[1].split(",").map((id) => ({
          id,
          semanticType: "HERO_SKIN_ART",
          state: "ACTIVE",
          version: 1,
          currentVersionId: `version-${id}`,
          versions: [{ id: `version-${id}`, url: `/media/${id}.webp` }],
          provenance: [],
        })),
      })
    const asset = /^\/admin\/media\/assets\/([^/?]+)$/.exec(path)
    if (asset)
      return Response.json({
        id: asset[1],
        semanticType: "HERO_SKIN_ART",
        state: "ACTIVE",
        version: 1,
        currentVersionId: `version-${asset[1]}`,
        currentUrl: `/media/${asset[1]}.webp`,
        provenance: [],
      })
    throw new Error(`Unexpected fixture request: ${path}`)
  }
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  Object.defineProperty(dom.window, "matchMedia", {
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  let restoreGlobals = () => {}
  restoreGlobals = installWindow(dom.window, {
    fetch: dispatchFetch,
  })
  const { createRoot } = await import("react-dom/client")
  const { verifySession, logout } = await import("../src/app/auth/session")
  const { HeroSkinsView } = await import("../src/features/publishing/components/skins/hero-skins-view")
  const { PatchCaptureProvider } = await import("../src/features/publishing/api/use-patch-captures")
  const root = createRoot(dom.window.document.getElementById("root")!)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  await verifySession()
  const body = (
    <HeroSkinsView skins={skins} locale="vi-VN" heroId="hero-1" canWrite={options.canWrite ?? true} busy={false} />
  )
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: options.captures ? (
          <PatchCaptureProvider value={options.captures as PatchCaptureWorkspace}>{body}</PatchCaptureProvider>
        ) : (
          body
        ),
      },
    ],
    { initialEntries: [options.url ?? "/hero/hero-1?tab=skins"] },
  )
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>,
    ),
  )
  const { document } = dom.window
  const click = async (node: Element | null | undefined) => {
    assert.ok(node, "Nothing to click")
    await act(async () => (node as HTMLElement).click())
  }

  const button = (label: string) =>
    [...document.querySelectorAll("button")].find(
      (node) => node.getAttribute("aria-label") === label || node.textContent?.trim() === label,
    )
  const heading = () => document.querySelector("h4")?.textContent
  const priceInput = () => document.querySelector<HTMLInputElement>('input[type="number"]')
  const type = async (input: HTMLInputElement, value: string) =>
    act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(input, value)
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    })
  const openPrice = async () => {
    await waitFor(() => !!button("Chỉnh sửa cách nhận và giá"), "The stored value reads first, with a pencil")
    await click(button("Chỉnh sửa cách nhận và giá"))
  }
  const press = async (node: Element, key: string) =>
    act(async () => {
      node.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true }))
    })
  return {
    document,
    router,
    requests,
    saves,
    click,
    waitFor,
    button,
    heading,
    priceInput,
    openPrice,
    type,
    press,
    close: async () => {
      await act(async () => root.unmount())
      client.clear()
      await logout()
      dom.window.close()
      restoreGlobals()
    },
  }
}

test("skins read like the public page: one stage, a rail, arrows, and no skin head anywhere", async () => {
  const ui = await view()
  try {
    await ui.waitFor(() => ui.heading() === "Trang phục A")
    const rail = ui.document.querySelector('[aria-label="Chọn trang phục"]')!
    assert.equal(rail.querySelectorAll("button").length, 3)
    assert.equal(ui.button("Xem Trang phục A")?.getAttribute("aria-current"), "true")

    await ui.click(ui.button("Trang phục sau"))
    await ui.waitFor(() => ui.heading() === "Trang phục B")
    assert.equal(new URLSearchParams(ui.router.state.location.search).get("skin"), "b")

    await ui.press(ui.button("Trang phục sau")!, "ArrowRight")
    await ui.waitFor(() => ui.heading() === "Trang phục C")
    await ui.press(ui.button("Trang phục sau")!, "ArrowRight")
    await ui.waitFor(() => ui.heading() === "Trang phục A", "The arrows wrap around like the public page")

    await ui.waitFor(() => ui.requests.some((path) => path.endsWith("/a-art")))
    assert.deepEqual(
      ui.requests.filter((path) => path.includes("-head")),
      [],
      "A skin head is neither shown nor counted in the credit line",
    )
  } finally {
    await ui.close()
  }
})

test("opening the tab reads all its images in one request and each image finds its own", async () => {
  const originals = skins.map((one) => ({ ...one }))
  const id = (skinIndex: number, role: number) =>
    `00000000-0000-4000-8000-${String(skinIndex * 10 + role).padStart(12, "0")}`
  skins.forEach((one, skinIndex) => {
    one.artAssetId = id(skinIndex, 1)
    one.portraitAssetId = id(skinIndex, 2)
  })
  const ui = await view()
  try {
    await ui.waitFor(() => !!ui.document.querySelector(`img[src="/media/${id(0, 1)}.webp"]`))
    await ui.waitFor(() => !!ui.document.querySelector(`img[src="/media/${id(2, 2)}.webp"]`))

    const reads = ui.requests.filter((path) => path.startsWith("/admin/media/assets"))
    assert.equal(reads.length, 1, reads.join("\n"))
    assert.deepEqual(
      new Set(new URLSearchParams(reads[0].split("?")[1]).get("ids")!.split(",")),
      new Set(skins.flatMap((one) => [one.artAssetId, one.portraitAssetId])),
    )
  } finally {
    skins.forEach((one, skinIndex) => Object.assign(one, originals[skinIndex]))
    await ui.close()
  }
})

test("a skin without a portrait says the Wiki is drawing its old head instead", async () => {
  const original = skins[1].portraitAssetId
  skins[1].portraitAssetId = null
  const ui = await view({ url: "/hero/hero-1?tab=skins&skin=b" })
  try {
    await ui.waitFor(() => ui.heading() === "Trang phục B")
    assert.match(ui.document.body.textContent!, /Thiếu chân dung, Wiki đang dùng ảnh head cũ/)
  } finally {
    skins[1].portraitAssetId = original
    await ui.close()
  }
})

test("arrow keys belong to the form while the editor is in it", async () => {
  const ui = await view()
  try {
    await ui.openPrice()
    await ui.waitFor(() => !!ui.priceInput())
    await ui.press(ui.priceInput()!, "ArrowRight")
    assert.equal(ui.heading(), "Trang phục A")
  } finally {
    await ui.close()
  }
})

test("the form is on the tab, keeps unsaved work across skins and saves what was typed", async () => {
  const ui = await view()
  try {
    await ui.openPrice()
    await ui.waitFor(() => ui.priceInput()?.value === "39")
    assert.equal((ui.button("Lưu") as HTMLButtonElement).disabled, true, "Nothing to save yet")
    await ui.type(ui.priceInput()!, "120")
    assert.equal((ui.button("Lưu") as HTMLButtonElement).disabled, false)

    await ui.click(ui.button("Xem Trang phục C (chưa rõ cách nhận)"))
    await ui.waitFor(() => ui.heading() === "Trang phục C")
    assert.ok(ui.button("Xem Trang phục A (chưa lưu)"), "The rail says which skin holds unsaved work")
    await ui.click(ui.button("Xem Trang phục A (chưa lưu)"))
    await ui.waitFor(() => ui.priceInput()?.value === "120")

    await ui.click(ui.button("Lưu"))
    await ui.waitFor(() => ui.saves.length === 1)
    assert.equal(ui.saves[0].path, "/admin/heroes/hero-1/shop/skins/a?region=VN")
    assert.equal(ui.saves[0].body.method, "VOUCHER")
    assert.equal(ui.saves[0].body.voucherPrice, 120)
    assert.equal(ui.saves[0].body.capturedOn, "2026-09-16")
    await ui.waitFor(() => !!ui.button("Xem Trang phục A"), "Saving clears the unsaved mark")
  } finally {
    await ui.close()
  }
})

test("typing a value back to what is stored leaves nothing unsaved", async () => {
  const ui = await view()
  try {
    await ui.openPrice()
    await ui.waitFor(() => ui.priceInput()?.value === "39")
    await ui.type(ui.priceInput()!, "40")
    await ui.waitFor(() => !!ui.button("Xem Trang phục A (chưa lưu)"))
    await ui.type(ui.priceInput()!, "39")
    await ui.waitFor(() => !!ui.button("Xem Trang phục A"))
  } finally {
    await ui.close()
  }
})

test("the main button saves and moves on, or only moves on when nothing changed", async () => {
  const ui = await view()
  try {
    await ui.openPrice()
    await ui.waitFor(() => ui.priceInput()?.value === "39")
    await ui.click(ui.button("Sang tiếp"))
    await ui.waitFor(() => ui.heading() === "Trang phục B")
    assert.equal(ui.saves.length, 0)

    await ui.type(ui.priceInput()!, "75")
    await ui.click(ui.button("Lưu và sang tiếp"))
    await ui.waitFor(() => ui.heading() === "Trang phục C")
    assert.equal(ui.saves[0].path, "/admin/heroes/hero-1/shop/skins/b?region=VN")
    assert.equal(ui.saves[0].body.voucherPrice, 75)
    assert.equal(ui.button("Sang tiếp"), undefined, "The last skin has nothing to move on to")
  } finally {
    await ui.close()
  }
})

test("a form shows only what its method uses and clears the other method's value when saved", async () => {
  const ui = await view()
  try {
    await ui.openPrice()
    await ui.waitFor(() => !!ui.priceInput())
    await ui.click(ui.button("Sự kiện"))
    assert.equal(ui.priceInput(), null)
    const event = ui.document.querySelectorAll<HTMLInputElement>(
      'form input:not([type="date"]):not([type="checkbox"])',
    )[0]
    await ui.type(event, "Đấu trường")
    await ui.click(ui.button("Lưu"))
    await ui.waitFor(() => ui.saves.length === 1)
    assert.equal(ui.saves[0].body.method, "EVENT")
    assert.equal(ui.saves[0].body.eventName, "Đấu trường")
    assert.equal(ui.saves[0].body.voucherPrice, null)
  } finally {
    await ui.close()
  }
})

test("the summary filters the rail to what still needs an editor", async () => {
  const ui = await view()
  try {
    await ui.waitFor(() => !!ui.button("Xem Trang phục B (cần xem lại)"))
    const rail = () => ui.document.querySelectorAll('[aria-label="Chọn trang phục"] button')
    const filters = ui.document.querySelector('[aria-label="Lọc trang phục theo việc cần làm"]')!
    await ui.click([...filters.querySelectorAll("button")].find((node) => node.textContent?.startsWith("Chưa rõ")))
    await ui.waitFor(() => ui.heading() === "Trang phục C")
    assert.equal(rail().length, 0, "One skin needs no rail")
    await ui.click([...filters.querySelectorAll("button")].find((node) => node.textContent?.startsWith("Cần xem lại")))
    await ui.waitFor(() => ui.heading() === "Trang phục B")

    await ui.openPrice()
    const checkbox = ui.document.querySelector<HTMLInputElement>('form input[type="checkbox"]')!
    await ui.click(checkbox)
    await ui.click(ui.button("Lưu"))
    await ui.waitFor(() => rail().length === 3, "Finishing the last skin of a filter returns to all of them")
  } finally {
    await ui.close()
  }
})

test("the shop card sits beside the form: a price compares itself and fills the form on request", async () => {
  const selected: (string | undefined)[] = []
  const revealed: (string | undefined)[] = []
  const groups: CaptureGroup[] = [
    {
      key: "skins",
      label: "Trang phục",
      title: "Trang phục",
      shop: true,
      images: [card("a", "39 quân huy"), card("b", "1.200 quân huy, đang giảm còn 900")],
    },
  ]
  const ui = await view({
    captures: {
      open: true,
      groups,
      patchCode: "2026",
      select: (_key, id) => selected.push(id),
      reveal: (_key, id) => revealed.push(id),
    },
  })
  try {
    const compare = () => ui.document.querySelector('[aria-label="Đối chiếu với ảnh cửa hàng"]')
    await ui.waitFor(() => /Khớp/.test(compare()?.textContent ?? ""), "39 on the card matches the saved 39")
    assert.equal(selected.at(-1), "card-a", "An open panel follows the skin")
    const before = selected.length

    await ui.click(ui.button("Xem Trang phục B (cần xem lại)"))
    await ui.waitFor(() => selected.at(-1) === "card-b")
    assert.equal(selected.length, before + 1, "Moving to a skin moves the picture once")
    assert.doesNotMatch(compare()!.textContent!, /Khớp/)
    await ui.click(ui.button("Điền theo ảnh"))
    assert.equal(ui.priceInput()?.value, "1200")
    await ui.waitFor(() => /Khớp/.test(compare()?.textContent ?? ""))

    await ui.click(compare()!.querySelector("button"))
    assert.equal(revealed.at(-1), "card-b", "The card opens in the panel")

    await ui.click(ui.button("Xem Trang phục C (chưa rõ cách nhận)"))
    await ui.waitFor(() => /chưa có trang phục này/.test(ui.document.body.textContent!))
    assert.equal(selected.at(-1), "card-b", "With no card of its own the panel is not sent somewhere misleading")
  } finally {
    await ui.close()
  }
})

test("an editor without the right to write reads the value without a form", async () => {
  const ui = await view({ canWrite: false })
  try {
    await ui.waitFor(() => /39 quân huy/.test(ui.document.body.textContent!))
    assert.equal(ui.document.querySelector("form"), null)
  } finally {
    await ui.close()
  }
})

test("a link to one skin opens on it", async () => {
  const ui = await view({ url: "/hero/hero-1?tab=skins&skin=c" })
  try {
    await ui.waitFor(() => ui.heading() === "Trang phục C")
  } finally {
    await ui.close()
  }
})
