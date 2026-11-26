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

test("a card keeps an item's stats and the whole of what it does, with the heading of each line apart", () => {
  assert.deepEqual(
    describeEntry(
      "+10% Giảm hồi chiêu\n+200 Giáp\n+800 Máu tối đa\n+5 Hồi máu\n+1 Khác\n\nNội tại duy nhất – Sức mạnh: gây thêm\nDòng sau\n\nHồi chiêu: 60 giây.",
    ),
    {
      stats: ["+10% Giảm hồi chiêu", "+200 Giáp", "+800 Máu tối đa", "+5 Hồi máu", "+1 Khác"],
      text: [
        [
          { label: "Nội tại duy nhất – Sức mạnh", body: "gây thêm" },
          { label: null, body: "Dòng sau" },
        ],
        [{ label: "Hồi chiêu", body: "60 giây." }],
      ],
    },
  )
  assert.deepEqual(describeEntry("Chuyển 16% máu đã mất thành sát thương. Hồi chiêu: 60 giây."), {
    stats: [],
    text: [[{ label: null, body: "Chuyển 16% máu đã mất thành sát thương. Hồi chiêu: 60 giây." }]],
  })
  assert.deepEqual(describeEntry("<b>+1.6</b> Công phép"), { stats: ["+1.6 Công phép"], text: [] })
  assert.deepEqual(describeEntry(""), { stats: [], text: [] })
  assert.deepEqual(describeEntry(null), { stats: [], text: [] })
})
