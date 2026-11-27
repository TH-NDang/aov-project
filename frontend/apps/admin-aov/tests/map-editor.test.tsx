import assert from "node:assert/strict"
import { before, test } from "node:test"
import type { MapContent } from "@aov/ui/lib/battle-map"
import type { AdminMap } from "../src/features/game-modes/game-mode-api"
import { emptyMap, emptyObject } from "../src/features/game-modes/map/map-edit-model"
import { button, click, QuietResizeObserver, render, waitFor, withDom } from "./fixtures/dom"
import { fakeBackend, json } from "./fixtures/network"
import { sessionRoutes, signIn } from "./fixtures/session"

const content: MapContent = {
  ...emptyMap(),
  objects: [
    {
      ...emptyObject("STRUCTURE"),
      code: "tru-ngoai",
      name: "Trụ ngoài",
      positions: [{ key: "xanh-caesar", side: "BLUE", label: "Đường Caesar", x: 4.2, y: 40 }],
    },
  ],
  tempo: [
    { seconds: 240, phase: "Giữa trận", steps: ["Trụ hết giáp"], callouts: [] },
    { seconds: 0, phase: "Đầu trận", steps: ["Vào trận"], callouts: [] },
  ],
  terrain: [
    {
      kind: "WALL",
      outline: [
        { x: 20, y: 70 },
        { x: 26, y: 70 },
        { x: 23, y: 78 },
      ],
    },
  ],
}
const revision = {
  id: "rev-1",
  revisionNo: 1,
  state: "DRAFT" as const,
  version: 3,
  createdAt: "2026-11-27T00:00:00Z",
  updatedAt: "2026-11-27T00:00:00Z",
}
const map: AdminMap = {
  modeId: "mode-1",
  modeCode: "5v5",
  revision,
  hasPublished: false,
  content,
  missingFields: [],
  images: {},
}

const backend = fakeBackend(sessionRoutes({ capabilities: ["gamemode:write", "gamemode:publish"] }), (request) => {
  if (request.pathname === "/admin/game-modes/mode-1/map") return json(map)
  if (request.method === "PUT" && request.pathname === "/admin/game-modes/mode-1/map/drafts/rev-1") {
    const body = request.body as { content: MapContent }
    return json({ ...map, content: body.content, revision: { ...revision, version: 4 } })
  }
  return undefined
})
withDom({
  url: "http://localhost/game-modes/mode-1/map",
  globals: () => ({ fetch: backend.fetch, ResizeObserver: QuietResizeObserver }),
})
before(signIn)

async function openEditor() {
  const { MemoryRouter, Route, Routes } = await import("react-router")
  const { MapEditorPage } = await import("../src/features/game-modes/map/map-editor-page")
  await render(
    <MemoryRouter initialEntries={["/game-modes/mode-1/map"]}>
      <Routes>
        <Route path="/game-modes/:modeId/map" element={<MapEditorPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const saves = () => backend.requests.filter((request) => request.method === "PUT")

test("a place mirrored to the other side is saved with its own key, and the timeline in time order", async () => {
  await openEditor()
  await click(await waitFor(() => button("Thêm điểm đối xứng với vị trí 1")))
  await click(button("Lưu nháp"))

  const saved = await waitFor(() => backend.requests.find((request) => request.method === "PUT"))
  const body = saved.body as { expectedVersion: number; content: MapContent }
  assert.equal(body.expectedVersion, 3)
  assert.deepEqual(body.content.objects[0]!.positions[1], {
    key: "do-rong",
    side: "RED",
    label: "Đường Rồng",
    x: 95.8,
    y: 60,
  })
  assert.deepEqual(
    body.content.tempo.map((moment) => moment.seconds),
    [0, 240],
  )
  await waitFor(() => document.body.textContent?.includes("Đã lưu nháp."))
})

test("a wall mirrored on the terrain tab is saved right after the original", async () => {
  const before = saves().length
  await openEditor()
  await click(await waitFor(() => button("Địa hình")))
  await click(await waitFor(() => button("Tạo hình đối xứng ở phe kia")))
  await click(button("Lưu nháp"))

  const saved = await waitFor(() => saves()[before])
  const body = saved.body as { content: MapContent }
  assert.deepEqual(body.content.terrain, [
    content.terrain[0],
    {
      kind: "WALL",
      outline: [
        { x: 80, y: 30 },
        { x: 74, y: 30 },
        { x: 77, y: 22 },
      ],
    },
  ])
})
