import assert from "node:assert/strict"
import { test } from "node:test"
import {
  classifyPatchVideo,
  releaseInstant,
  suggestPatchVideos,
} from "../src/features/publishing/model/setup/patch-video-model"

const release = Date.parse("2026-11-17T00:00:00+07:00")
const heroes = [
  { id: "yan", names: ["Yan"] },
  { id: "kil", names: ["Kil'Groth", "Kilgroth"] },
  { id: "dirak", names: ["Dirak"] },
]
const video = (title: string, publishedAt: string, extra: Partial<{ shortForm: boolean }> = {}) => ({
  id: title,
  title,
  publishedAt,
  durationSeconds: 600,
  broadcast: null,
  shortForm: false,
  ...extra,
})

test("a test-server video before the release is a preview", () => {
  const guess = classifyPatchVideo(video("Yan Và Dirak Tăng Và Giảm Tại MCTN", "2026-11-08T11:00:00Z"), release, heroes)
  assert.equal(guess?.purpose, "PATCH_PREVIEW")
  assert.equal(guess?.side, "before")
})

test("the official summary near the release is an overview, a later review is a review", () => {
  assert.equal(
    classifyPatchVideo(video("Cập Nhật Chính Thức 17/11", "2026-11-17T03:00:00Z"), release, heroes)?.purpose,
    "PATCH_OVERVIEW",
  )
  assert.equal(
    classifyPatchVideo(video("Review Phiên Bản Mới Thực Tế Không Chém Gió", "2026-11-19T12:00:00Z"), release, heroes)
      ?.purpose,
    "PATCH_REVIEW",
  )
})

test("a hero video after the release names the hero, the longest name first", () => {
  const guess = classifyPatchVideo(
    video("PHIÊN BẢN MỚI: Kil'Groth Được Buff Mạnh", "2026-11-18T10:00:00Z"),
    release,
    heroes,
  )
  assert.equal(guess?.purpose, "PATCH_CHANGE")
  assert.equal(guess?.heroId, "kil")
  assert.equal(guess?.side, "after")
})

test("shorts, videos outside the window and titles that say nothing are left out", () => {
  assert.equal(
    classifyPatchVideo(video("Yan MCTN #tng", "2026-11-10T00:00:00Z", { shortForm: true }), release, heroes),
    null,
  )
  assert.equal(classifyPatchVideo(video("Cập Nhật Chính Thức", "2026-10-01T00:00:00Z"), release, heroes), null)
  assert.equal(classifyPatchVideo(video("Top 5 Trang Phục Đẹp", "2026-11-18T00:00:00Z"), release, heroes), null)
  const next = Date.parse("2026-11-26T00:00:00+07:00")
  assert.equal(classifyPatchVideo(video("Review Phiên Bản Mới", "2026-11-27T00:00:00Z"), release, heroes, next), null)
})

test("the channel's own name, skins and videos about many heroes do not make a guess", () => {
  assert.equal(
    classifyPatchVideo(
      video("Liên Quân Top 5 Tướng Khắc Chế Veera | Trải Nghiệm Game", "2026-11-19T03:00:00Z"),
      release,
      heroes,
    ),
    null,
  )
  assert.equal(
    classifyPatchVideo(
      video("PHIÊN BẢN MỚI: Nâng Cấp Skin Dirak Bị Hoãn | TNG", "2026-11-20T03:00:00Z"),
      release,
      heroes,
    ),
    null,
  )
  const many = classifyPatchVideo(
    video("PHIÊN BẢN MỚI: 11 Chỉnh Sửa Tướng, Dirak 4 Nút | TNG", "2026-11-17T09:00:00Z"),
    release,
    heroes,
  )
  assert.equal(many?.purpose, "PATCH_OVERVIEW")
  assert.equal(
    classifyPatchVideo(
      video("PHIÊN BẢN MỚI: Đồ Mới Buff Gián Tiếp Yan Và Dirak", "2026-11-20T03:00:00Z"),
      release,
      heroes,
    ),
    null,
  )
  assert.equal(
    classifyPatchVideo(video("Liên Quân Review Chê 8 Trang Phục Mới", "2026-11-20T03:00:00Z"), release, heroes),
    null,
  )
  assert.equal(
    classifyPatchVideo(
      video("Yan Buff Khủng Dọn Đường Cho Skin Mới Sắp Ra Mắt?", "2026-11-12T03:00:00Z"),
      release,
      heroes,
    ),
    null,
  )
})

test("a day-only release starts at midnight on the market's clock", () => {
  assert.equal(releaseInstant({ effectiveAt: null, effectiveOn: "2026-11-26" }, 7), Date.parse("2026-11-25T17:00:00Z"))
  assert.equal(
    releaseInstant({ effectiveAt: "2026-09-28T20:30:00Z", effectiveOn: null }, 7),
    Date.parse("2026-09-28T20:30:00Z"),
  )
})

test("a hero video without a version lead still names the hero's change", () => {
  const heroesPlus = [...heroes, { id: "max", names: ["Max"] }, { id: "astrid", names: ["Astrid"] }]
  const at = "2026-11-19T03:00:00Z"
  assert.equal(
    classifyPatchVideo(video("Chỉnh Sửa Dirak: Nerf Combo, Hết Thời?", at), release, heroesPlus)?.heroId,
    "dirak",
  )
  assert.equal(classifyPatchVideo(video("BUFF MAX: Xạ Thủ Tới Số!", at), release, heroesPlus)?.heroId, "max")
  assert.equal(
    classifyPatchVideo(video("Không Thể Flop, Astrid Bị Nerf Vẫn Top 1 Đấu Sĩ", at), release, heroesPlus)?.heroId,
    "astrid",
  )
  assert.equal(classifyPatchVideo(video("Top 5 Tướng Khắc Chế Yan, Buff Sức Mạnh S4", at), release, heroesPlus), null)
  assert.equal(classifyPatchVideo(video("Yan Bị Chê Yếu Bên VGVD, Phải Buff Gấp?", at), release, heroesPlus), null)
})

test("a review before the release is the live patch's, and a test-server list after it is the next one's", () => {
  assert.equal(
    classifyPatchVideo(
      video("Liên Quân 7 Chỉnh Sửa Tướng Review Phiên Bản Mới: Yan, Dirak... Thực Tế", "2026-11-15T03:00:00Z"),
      release,
      heroes,
    ),
    null,
  )
  assert.equal(
    classifyPatchVideo(
      video("Liên Quân 15 Chỉnh Sửa Tướng: Yan, Dirak Tăng Và Giảm Tại MCTN", "2026-11-19T03:00:00Z"),
      release,
      heroes,
    ),
    null,
  )
  assert.equal(
    classifyPatchVideo(
      video("Liên Quân 7 Chỉnh Sửa Tướng: Yan, Dirak... Bản Cập Nhật Chính Thức", "2026-11-13T03:00:00Z"),
      release,
      heroes,
    )?.purpose,
    "PATCH_OVERVIEW",
  )
  assert.equal(
    classifyPatchVideo(
      video("Liên Quân 20 Chỉnh Sửa Tướng: Yan, Dirak... Chuẩn Bị Cập Nhật S4", "2026-11-05T03:00:00Z"),
      release,
      heroes,
    )?.purpose,
    "PATCH_PREVIEW",
  )
})

test("a hero video before the release is its change when the patch's own list names the hero", () => {
  const videos = [
    video("Liên Quân 8 Chỉnh Sửa Tướng Phiên Bản Mới: Dirak, Kil'Groth... Cập Nhật Bổ Sung", "2026-11-15T03:00:00Z"),
    video("PHIÊN BẢN MỚI: Dirak Buff Gấp, Vì Flop Quá!", "2026-11-14T03:00:00Z"),
    video("PHIÊN BẢN MỚI: Yan Bị Nerf Gấp!", "2026-11-14T05:00:00Z"),
  ]
  const guesses = suggestPatchVideos(videos, release, heroes)
  assert.deepEqual(
    guesses.map((guess) => [guess.purpose, guess.heroId ?? null, guess.side]),
    [
      ["PATCH_CHANGE", "dirak", "before"],
      ["PATCH_OVERVIEW", null, "before"],
    ],
  )
})

test("a short is told by its length, and the window stops at the previous release", () => {
  const short = { ...video("Chỉnh Sửa Dirak buff gấp #dirak #tng", "2026-11-18T03:00:00Z"), durationSeconds: 63 }
  assert.equal(classifyPatchVideo(short, release, heroes), null)
  const clip = { ...video("PHIÊN BẢN MỚI: Dirak Buff Gấp | TNG", "2026-11-18T03:00:00Z"), durationSeconds: 114 }
  assert.equal(classifyPatchVideo(clip, release, heroes)?.heroId, "dirak")
  const previous = Date.parse("2026-11-08T00:00:00+07:00")
  const preview = video("Yan Và Dirak Tăng Và Giảm Tại MCTN", "2026-11-05T11:00:00Z")
  assert.equal(classifyPatchVideo(preview, release, heroes)?.purpose, "PATCH_PREVIEW")
  assert.equal(classifyPatchVideo(preview, release, heroes, null, previous), null)
})
