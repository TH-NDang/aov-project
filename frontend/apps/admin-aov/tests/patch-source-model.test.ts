import assert from "node:assert/strict"
import { test } from "node:test"
import {
  marketSourceUrl,
  preferredSourceUrl,
  sourceFromPost,
  sourceProblem,
  sourcesToSave,
} from "../src/features/publishing/model/patch-changes/patch-source-model"

test("a watched post becomes a link named by its market, and a test server says so", () => {
  assert.deepEqual(sourceFromPost({ url: "https://rov.in.th/a", region: "TH", channel: "OFFICIAL" }), {
    url: "https://rov.in.th/a",
    label: "Thái Lan",
    locale: "th-TH",
    region: "TH",
  })
  assert.deepEqual(sourceFromPost({ url: "https://aov.id/a", region: "ID", channel: "EXPERIMENTAL" }), {
    url: "https://aov.id/a",
    label: "Indonesia · Thử nghiệm",
    locale: null,
    region: "ID",
  })
})

test("a link needs a label and a web address, and the same address is written once", () => {
  const first = { url: "https://lienquan.garena.vn/a", label: "Tiếng Việt", locale: "vi-VN" }
  const again = { url: " https://lienquan.garena.vn/a ", label: "Bản khác", locale: null }
  assert.equal(sourceProblem(first, [first, again]), null)
  assert.match(sourceProblem(again, [first, again]) ?? "", /đã có ở trên/)
  assert.match(sourceProblem({ ...first, label: " " }, [first]) ?? "", /Ghi nhãn/)
  assert.match(sourceProblem({ ...first, url: "ftp://lienquan.garena.vn" }, [first]) ?? "", /http\(s\)/)
  assert.deepEqual(sourcesToSave([{ ...again, locale: "" }]), [
    { url: "https://lienquan.garena.vn/a", label: "Bản khác", locale: null, region: null },
  ])
})

test("an item recorded by hand starts from the link in the language being written", () => {
  const sources = [
    { url: "https://rov.in.th/a", label: "Thái Lan", locale: "th-TH" },
    { url: "https://lienquan.garena.vn/a", label: "Tiếng Việt", locale: "vi-VN" },
  ]
  assert.equal(preferredSourceUrl(sources, "vi-VN"), "https://lienquan.garena.vn/a")
  assert.equal(preferredSourceUrl(sources, "en"), "https://rov.in.th/a")
  assert.equal(preferredSourceUrl([], "vi-VN"), null)
})

test("a market's release cites the first page that market published", () => {
  const sources = [
    { url: "https://moba.garena.tw/a", label: "更新公告", locale: "zh-TW", region: "TW" },
    { url: "https://lienquan.garena.vn/b", label: "Quy trình", locale: "vi-VN", region: "VN" },
    { url: "https://lienquan.garena.vn/a", label: "Chi tiết", locale: "vi-VN", region: "VN" },
  ]
  assert.equal(marketSourceUrl(sources, "VN"), "https://lienquan.garena.vn/b")
  assert.equal(marketSourceUrl(sources, "ID"), null)
})
