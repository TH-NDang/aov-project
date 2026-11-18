import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import { act } from "react"
import { cleanTraits, suggestTraits, withTraitDetail } from "../src/features/publishing/model/assessment/hero-traits"
import { draftHeroNotes } from "../src/features/publishing/model/assessment/hero-notes-draft"
import type { HeroRankingReading } from "../src/features/publishing/api/publishing-api"
import type { Content, Skill, Trait } from "../src/features/publishing/api/types"
import { createWindow, installWindow } from "./fixtures/dom"

const skill = (
  skillKey: string,
  kind: Skill["kind"],
  name: string,
  description: string,
  source: Record<string, unknown> = {},
): Skill => ({
  skillKey,
  kind,
  formKey: null,
  displayOrder: Number(skillKey.replace(/\D/g, "") || 0),
  iconAssetId: null,
  translations: [{ locale: "vi-VN", name, description }],
  effects: [{ effectType: "SOURCE_SNAPSHOT", metadata: source }],
})

const kit: Skill[] = [
  skill(
    "passive",
    "PASSIVE",
    "Lưỡi hái",
    "Cường hóa đánh thường kế tiếp gây thêm sát thương chuẩn bằng 5% máu tối đa của mục tiêu.",
  ),
  skill("skill-1", "ACTIVE", "Xung phong", "Lướt tới vị trí chỉ định, gây 200 sát thương vật lý.", {
    tags: ["Dịch chuyển", "Vật lý"],
    cooldown: { value: 6 },
  }),
  skill(
    "skill-2",
    "ACTIVE",
    "Địa chấn",
    "Đập xuống đất, gây 150 sát thương phép và làm choáng kẻ địch trong phạm vi 1 giây. Bản thân miễn nhiễm hiệu ứng choáng khi tung chiêu.",
  ),
  // No Vietnamese text: the reading rules have nothing to read.
  { ...skill("skill-3", "ACTIVE", "", ""), translations: [{ locale: "en-US", name: "Rage", description: "Stuns." }] },
]

test("traits are suggested from the Vietnamese skill text and tags, with the skills and the sentence that says so", () => {
  const suggestions = suggestTraits(kit)
  const codes = suggestions.map((suggestion) => suggestion.code)

  assert.deepEqual(codes, ["TRUE_DAMAGE", "PERCENT_HP_DAMAGE", "DASH", "HARD_CC"], "Kept in the fixed trait order")
  const dash = suggestions.find((suggestion) => suggestion.code === "DASH")!
  assert.deepEqual(dash.skillKeys, ["skill-1"])
  assert.equal(dash.detail, "Xung phong (hồi chiêu 6 giây)")
  assert.match(dash.evidence!.text, /Dịch chuyển/, "A tag the game put on the skill is the evidence")
  const control = suggestions.find((suggestion) => suggestion.code === "HARD_CC")!
  assert.deepEqual(control.skillKeys, ["skill-2"], "“cường hóa đánh” is not a petrify and an immunity is no stun")
  assert.equal(control.detail, "Địa chấn (choáng 1 giây, diện rộng)")
  assert.match(suggestions[0]!.evidence!.text, /sát thương chuẩn/)
})

test("a suggested detail writes part of a second with a decimal point, as game numbers are written", () => {
  // The game writes part of a second with a decimal point, like every number in its skill text.
  const [control] = suggestTraits([
    skill("skill-1", "ACTIVE", "Hào hoa", "Gây 100 sát thương vật lý và làm choáng nạn nhân trong 0.75 giây."),
  ]).filter((suggestion) => suggestion.code === "HARD_CC")

  assert.equal(control!.detail, "Hào hoa (choáng 0.75 giây)")
})

test("saved traits keep the fixed order, skills that still exist and written details only", () => {
  const traits = cleanTraits(
    [
      { code: "HARD_CC", skillKeys: ["skill-9", "skill-2"], translations: [{ locale: "vi-VN", detail: "  Choáng  " }] },
      { code: "TRUE_DAMAGE", skillKeys: ["passive"], translations: [{ locale: "en-US", detail: " " }] },
    ],
    kit,
  )

  assert.deepEqual(traits, [
    { code: "TRUE_DAMAGE", skillKeys: ["passive"], translations: [] },
    { code: "HARD_CC", skillKeys: ["skill-2"], translations: [{ locale: "vi-VN", detail: "Choáng" }] },
  ])
  const translated = withTraitDetail(traits[1]!, "en-US", "Stun")
  assert.deepEqual(
    translated.translations.map((text) => text.locale),
    ["vi-VN", "en-US"],
    "Another language keeps the Vietnamese detail",
  )
  assert.deepEqual(withTraitDetail(translated, "vi-VN", "").translations, [{ locale: "en-US", detail: "Stun" }])
})

const ranking: HeroRankingReading = {
  snapshot: {
    code: "vn-2026-11-11",
    regionCode: "VN",
    modeCode: "RANKED_ELITE",
    modeLabel: "Đấu hạng Tinh anh",
    periodLabel: null,
    capturedAt: "2026-11-11T05:00:00Z",
    sourceTimeZone: "Asia/Ho_Chi_Minh",
    heroes: 128,
  },
  entry: {
    heroId: "h",
    heroCode: "test",
    tier: "T1",
    winRate: 51.2,
    pickRate: 3,
    banRate: 1,
    figures: [
      { metric: "DAMAGE_DEALT", value: 98000, rank: 3, of: 128 },
      { metric: "KILLS", value: 1.2, rank: 120, of: 128 },
      { metric: "ASSISTS", value: 4, rank: 60, of: 128 },
    ],
    counters: [],
  },
}

test("the notes draft names its sources and leaves out points that do not fit the hero's role", () => {
  const notes = draftHeroNotes({
    traits: [
      {
        code: "HARD_CC",
        skillKeys: ["skill-2"],
        translations: [{ locale: "vi-VN", detail: "Địa chấn (choáng 1 giây)" }],
      },
      { code: "SELF_HEAL", skillKeys: ["passive"], translations: [] },
    ],
    skills: kit,
    roles: ["SUPPORT"],
    ranking,
    survivability: { value: 3, maximum: 10 },
  })

  const strengths = notes.strengths!.split("\n")
  assert.equal(
    strengths[0],
    "Gây nhiều sát thương: 98000 sát thương gây ra mỗi trận, hạng 3/128 ở Đấu hạng Tinh anh ngày 11/11/2026.",
  )
  assert.ok(strengths.includes("Khống chế cứng: Địa chấn (choáng 1 giây)."))
  assert.doesNotMatch(notes.weaknesses!, /Ít hạ gục/, "Few kills is not a weakness of a support")
  assert.match(notes.weaknesses!, /Không có kỹ năng lướt/)
  assert.match(notes.weaknesses!, /Thanh Sinh tồn của game chỉ 3\/10/)
  assert.doesNotMatch(notes.weaknesses!, /lá chắn, hồi máu/, "The hero heals itself")
  assert.equal(notes.counterTips, "Trang bị giảm hồi máu cắt bớt lượng hồi từ Lưỡi hái.")
})

test("the notes draft writes decimal figures with a point and no thousands separator, as the game does", () => {
  const notes = draftHeroNotes({
    traits: [],
    skills: kit,
    roles: ["MAGE"],
    ranking: {
      ...ranking,
      entry: { ...ranking.entry!, figures: [{ metric: "KILLS", value: 1.254, rank: 120, of: 128 }] },
    },
    survivability: { value: 3.5, maximum: 10 },
  })

  assert.match(notes.weaknesses!, /^Ít hạ gục: 1\.25 lần hạ gục mỗi trận,/m)
  assert.match(notes.weaknesses!, /Thanh Sinh tồn của game chỉ 3\.5\/10\./)
})

test("without a confirmed snapshot the draft uses the traits alone", () => {
  const notes = draftHeroNotes({ traits: [], skills: kit, roles: ["MAGE"], ranking: { snapshot: null, entry: null } })

  assert.equal(notes.strengths, null)
  assert.equal(notes.counterTips, null)
  assert.equal(notes.weaknesses!.split("\n").length, 3)
})

async function createView() {
  const dom = createWindow("http://localhost/hero/test")
  let restoreGlobals = () => {}
  restoreGlobals = installWindow(dom.window)
  const { createRoot } = await import("react-dom/client")
  const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query")
  const { HeroEvaluation } = await import("../src/features/publishing/components/assessment/hero-evaluation")
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const root = createRoot(dom.window.document.getElementById("root")!)
  return {
    document: dom.window.document,
    render: (element: (component: typeof HeroEvaluation) => React.ReactElement) =>
      act(async () =>
        root.render(<QueryClientProvider client={client}>{element(HeroEvaluation)}</QueryClientProvider>),
      ),
    close: async () => {
      await act(async () => root.unmount())
      client.clear()
      restoreGlobals()
      dom.window.close()
    },
  }
}

const content = (traits: Trait[]): Content => ({
  PROFILE: {
    translations: [
      {
        locale: "vi-VN",
        name: "Thử",
        title: null,
        summary: null,
        lore: null,
        strengths: "Gây nhiều sát thương.\nKhống chế cứng.",
        weaknesses: null,
        counterTips: null,
      },
    ],
    roles: ["WARRIOR"],
    sources: [],
  },
  OVERVIEW_RATINGS: null,
  COMBAT_STATS: null,
  SKILLS: { skills: kit, sources: [], traits },
  SKINS: null,
  MEDIA_BINDINGS: null,
})

test("the evaluation shows saved traits and written notes, and its pencils wait for a draft", async () => {
  const view = await createView()
  let asked = 0
  try {
    await view.render((HeroEvaluation) => (
      <HeroEvaluation
        heroId="hero"
        content={content([
          { code: "DASH", skillKeys: ["skill-1"], translations: [{ locale: "vi-VN", detail: "Xung phong" }] },
        ])}
        locale="vi-VN"
        editable={false}
        busy={false}
        locked={false}
        onNeedsDraft={() => asked++}
      />
    ))
    const text = view.document.body.textContent ?? ""
    assert.match(text, /Di chuyển/)
    assert.match(text, /Có kỹ năng lướt/)
    assert.match(text, /· Xung phong/, "The skills that give the trait are named")
    const items = [...view.document.querySelectorAll("li")].map((item) => item.textContent)
    assert.ok(items.includes("Gây nhiều sát thương."), "Each line of a note reads as one point")
    assert.match(text, /Điểm yếu.*Chưa viết\./)

    const pencil = view.document.querySelector<HTMLButtonElement>('button[aria-label^="Chỉnh sửa đặc điểm"]')!
    assert.match(pencil.getAttribute("aria-label")!, /tạo bản nháp trước/)
    await act(async () => pencil.click())
    assert.equal(asked, 1, "A published version asks for a draft instead of opening the editor")
  } finally {
    await view.close()
  }
})

test("checking a suggested trait fills in its skills and detail, and only changes enable saving", async () => {
  const view = await createView()
  try {
    await view.render((HeroEvaluation) => (
      <HeroEvaluation
        heroId="hero"
        revision={{
          id: "rev",
          heroId: "hero",
          rulesetId: "r",
          revisionNo: 2,
          state: "DRAFT",
          version: 4,
          cause: "CONTENT_CORRECTION",
          sections: {} as never,
          publicationSequence: null,
          publishedAt: null,
          sourceRevisionId: null,
          effectiveFromPatchVariantId: null,
        }}
        content={content([])}
        locale="vi-VN"
        editable
        busy={false}
        locked={false}
      />
    ))
    assert.match(view.document.body.textContent ?? "", /gợi ý 4 đặc điểm/)
    await act(async () =>
      view.document.querySelector<HTMLButtonElement>('button[aria-label="Chỉnh sửa đặc điểm"]')!.click(),
    )
    const save = () =>
      [...view.document.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.textContent === "Lưu đặc điểm",
      )!
    assert.equal(save().disabled, true, "Nothing changed yet")

    const box = [...view.document.querySelectorAll<HTMLLabelElement>("label")]
      .find((label) => label.textContent?.includes("Khống chế cứng"))!
      .querySelector("input")!
    await act(async () => box.click())
    const detail = [...view.document.querySelectorAll<HTMLInputElement>("input")].find(
      (input) => input.value === "Địa chấn (choáng 1 giây, diện rộng)",
    )
    assert.ok(detail, "The suggested detail is filled in for the editor to check")
    const pressed = view.document.querySelector('[aria-label="Kỹ năng cho Khống chế cứng"] [aria-pressed="true"]')
    assert.match(pressed?.textContent ?? "", /Địa chấn/)
    assert.equal(save().disabled, false)
  } finally {
    await view.close()
  }
})
