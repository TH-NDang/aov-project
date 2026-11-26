import assert from "node:assert/strict"
import { test } from "node:test"
import { describeEntry, wikiEntryUrl } from "../src/lib/wiki-links.ts"

test("an entry opens on the Wiki by its code, by its id without one, in the reader's language", () => {
  const wiki = "https://athahub.com/wiki"
  assert.equal(wikiEntryUrl(wiki, "heroes", { id: "h1", code: "airi" }, "vi-VN"), "https://athahub.com/wiki/hero/airi")
  assert.equal(
    wikiEntryUrl(`${wiki}/`, "items", { id: "i1", code: "giay-kien-cuong" }, "en"),
    "https://athahub.com/wiki/warehouse/items/giay-kien-cuong?locale=en",
  )
  assert.equal(
    wikiEntryUrl(wiki, "enchantments", { id: "e 1", code: "" }, "vi-VN"),
    "https://athahub.com/wiki/warehouse/enchantments/e%201",
  )
  assert.equal(
    wikiEntryUrl(wiki, "spells", { id: "s1", code: "toc-bien" }, "vi-VN"),
    `${wiki}/warehouse/spells/toc-bien`,
  )
})

test("an item's card keeps its stats and the first line of what it does; others keep their first line", () => {
  assert.deepEqual(
    describeEntry(
      "+10% Giảm hồi chiêu\n+200 Giáp\n+800 Máu tối đa\n+5 Hồi máu\n+1 Khác\n\nNội tại duy nhất – Sức mạnh: gây thêm\nDòng sau",
    ),
    {
      stats: ["+10% Giảm hồi chiêu", "+200 Giáp", "+800 Máu tối đa", "+5 Hồi máu"],
      line: "Nội tại duy nhất – Sức mạnh: gây thêm",
    },
  )
  assert.deepEqual(describeEntry("Chuyển 16% máu đã mất thành sát thương.\nHồi chiêu: 60 giây."), {
    stats: [],
    line: "Chuyển 16% máu đã mất thành sát thương.",
  })
  assert.deepEqual(describeEntry("<b>+1.6</b> Công phép"), { stats: ["+1.6 Công phép"], line: null })
  assert.deepEqual(describeEntry(""), { stats: [], line: null })
  assert.deepEqual(describeEntry(null), { stats: [], line: null })
})
