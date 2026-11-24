import assert from "node:assert/strict"
import { test } from "node:test"
import {
  createEntityIndex,
  parseRichText,
  type EntityKind,
  type EntityReference,
  type RichTextNode,
  type RichTextOptions,
} from "@aov/ui/lib/entity-rich-text"
import { nameRule } from "@aov/ui/lib/reference-names"

type Extra = { short?: string; aliases?: string[]; teamIds?: string[] }

function entity(kind: EntityKind, id: string, name: string, { short, aliases = [], teamIds }: Extra = {}) {
  const reference: EntityReference = {
    id,
    kind,
    autoMatch: true,
    teamIds,
    translations: [{ locale: "vi-VN", name, aliases, description: "", shortNames: short ? [short] : undefined }],
  }
  return reference
}

const records = [
  entity("circuit", "rpl", "RoV Pro League", { short: "RPL" }),
  entity("circuit", "aic", "Arena of Valor International Championship", { short: "AIC" }),
  entity("circuit", "aog", "Đấu Trường Danh Vọng", { short: "AOG" }),
  entity("competition", "rpl-summer", "RoV Pro League 2026 Summer", { aliases: ["RPL 2026 Summer"] }),
  entity("competition", "aic-2026", "Arena of Valor International Championship 2026", { aliases: ["AIC 2026"] }),
  entity("organization", "garena-lq", "Garena Liên Quân Mobile", { short: "Liên Quân Mobile" }),
  entity("team", "box", "Box Gaming", { short: "BOX", aliases: ["box gaming vn"] }),
  entity("team", "flash", "Team Flash", { short: "FL" }),
  entity("team", "friends", "Friends"),
  entity("team", "angel", "Angel"),
  entity("team", "symbiotes", "TheSymbiotes"),
  entity("team", "hanoi", "Hà Nội"),
  entity("team", "lion-1", "Lion Esports", { short: "LIO" }),
  entity("team", "lion-2", "Lions Gaming", { short: "LIO" }),
  entity("player", "kaisa", "Kaisa", { teamIds: ["box"] }),
  entity("player", "bang", "Bâng", { teamIds: ["box"] }),
  entity("player", "top", "Top", { teamIds: ["flash"] }),
  entity("player", "nam", "Nam", { teamIds: ["flash"] }),
  entity("player", "red-1", "Reddit", { teamIds: ["box"] }),
  entity("player", "red-2", "Reddit", { teamIds: ["flash"] }),
  entity("player", "zuka-player", "Zuka", { teamIds: ["box"] }),
  entity("person", "tony", "Tony Bình", { teamIds: [] }),
  entity("hero", "zuka", "Zuka"),
  entity("hero", "tel", "Tel'Annas"),
  entity("hero", "max", "Max"),
  entity("item", "truy-hon", "Kiếm truy hồn"),
  entity("enchantment", "san-nha", "Sân nhà"),
]
const index = createEntityIndex(records, "vi-VN", "vi-VN", { scope: "all" })

function parse(text: string, options: RichTextOptions = {}) {
  return parseRichText(text, index, { markup: "references", firstOccurrenceOnly: true, ...options })
}

/** The links of a text, as `label=id`. */
const links = (text: string, options?: RichTextOptions) =>
  parse(text, options).flatMap((node) => (node.type === "reference" ? [`${node.label}=${node.entity.id}`] : []))

const plain = (nodes: RichTextNode[]) =>
  nodes.map((node) => (node.type === "text" ? node.text : node.type === "reference" ? node.label : "")).join("")

test("the introduction of a circuit links the other circuit it speaks of", () => {
  const text =
    "RoV Thailand Esports Premier League (TEPL) là giải hạng hai của Liên Quân Mobile tại Thái Lan, dưới RoV Pro League. Đội đứng đầu được dự vòng thăng hạng lên RoV Pro League."

  assert.deepEqual(links(text), ["RoV Pro League=rpl"])
  assert.equal(plain(parse(text)), text)
})

test("the longest name wins over the shorter one it opens with", () => {
  assert.deepEqual(links("Chung kết RoV Pro League 2026 Summer diễn ra."), ["RoV Pro League 2026 Summer=rpl-summer"])
})

test("a short name with its season is the season, and alone it is the circuit", () => {
  assert.deepEqual(links("Sau AIC 2026 là AIC 2027."), ["AIC 2026=aic-2026", "AIC=aic"])
})

test("a name inside a longer word is not that name", () => {
  assert.deepEqual(links("AICx, xAIC và AIC2026 không phải là tên."), [])
})

test("an accented letter beside a name is a part of its word", () => {
  assert.deepEqual(links("BOXđ, ờBOX"), [])
})

test("a name is found whichever way its accents are encoded", () => {
  assert.equal(links("Đấu Trường Danh Vọng".normalize("NFD")).length, 1)
})

test("another accent is another name", () => {
  assert.deepEqual(links("Box Gaming có Bang, không phải Băng."), ["Box Gaming=box"])
  assert.deepEqual(links("Box Gaming có Bâng."), ["Box Gaming=box", "Bâng=bang"])
})

test("a long name is found in any letter case", () => {
  assert.deepEqual(links("Giải đấu trường danh vọng trở lại."), ["đấu trường danh vọng=aog"])
})

test("a typographic apostrophe or dash does not hide a name", () => {
  assert.deepEqual(links("Cấm Tel’Annas ngay."), ["Tel’Annas=tel"])
})

test("a short name counts only in its own capitals", () => {
  assert.deepEqual(links("Vé dự Aic, aic hay AIC?"), ["AIC=aic"])
})

test("a short name two records share links neither", () => {
  assert.deepEqual(links("LIO thắng."), [])
})

test("a short name in a heading written in capitals stays plain", () => {
  assert.deepEqual(links("BOX VÔ ĐỊCH MÙA GIẢI"), [])
  assert.deepEqual(links("AIC VS RPL"), ["AIC=aic", "RPL=rpl"])
})

test("a short name of two letters stays plain", () => {
  assert.deepEqual(links("FL thắng trận này."), [])
})

test("capitals every text uses are no short names", () => {
  assert.equal(nameRule("team", "MVP", "short"), "introduced")
  assert.equal(nameRule("team", "BOX", "short"), "code")
})

test("the game's own name never opens the organization that uses it as its short name", () => {
  assert.deepEqual(links("Giải hạng hai của Liên Quân Mobile tại Thái Lan."), [])
  assert.deepEqual(links("Garena Liên Quân Mobile công bố lịch."), ["Garena Liên Quân Mobile=garena-lq"])
})

test("only the first occurrence in a paragraph links, under whichever name", () => {
  assert.deepEqual(links("RoV Pro League (RPL) mở màn. RPL kết thúc, rồi RoV Pro League trở lại."), [
    "RoV Pro League=rpl",
  ])
})

test("each paragraph links a name again", () => {
  assert.deepEqual(links("RPL mở màn.\n\nRPL kết thúc."), ["RPL=rpl", "RPL=rpl"])
})

test("a line break alone does not end a paragraph", () => {
  assert.deepEqual(links("RPL mở màn.\nRPL kết thúc."), ["RPL=rpl"])
})

test("a page does not link to itself, nor to a shorter name inside its own", () => {
  const exclude = new Set(["competition:rpl-summer"])

  assert.deepEqual(links("RoV Pro League 2026 Summer là mùa hè của RPL.", { exclude }), ["RPL=rpl"])
})

test("a reference made on purpose to the page itself reads as its words", () => {
  const nodes = parse("Theo <ref=circuit:rpl>giải này</ref>.", { exclude: new Set(["circuit:rpl"]) })

  assert.equal(plain(nodes), "Theo giải này.")
  assert.ok(nodes.every((node) => node.type === "text"))
})

test("nothing inside a reference made on purpose links once more", () => {
  assert.deepEqual(links("<ref=team:box>đội vô địch AIC 2026</ref> ăn mừng, BOX lên ngôi."), [
    "đội vô địch AIC 2026=box",
  ])
})

test("nothing inside an address of another site links", () => {
  assert.deepEqual(links("Xem https://example.com/AIC/BOX, www.RPL.com và mail AIC@example.com hay AIC.com."), [])
})

test("the address of one of our pages reads as that page", () => {
  const resolveAddress = (address: string) =>
    address === "https://athahub.com/stream/pages/rov-pro-league-2" ? "circuit:rpl" : undefined

  assert.deepEqual(links("Xem (https://athahub.com/stream/pages/rov-pro-league-2).", { resolveAddress }), [
    "RoV Pro League=rpl",
  ])
  assert.equal(
    plain(parse("Xem https://athahub.com/stream/pages/khac.", { resolveAddress })),
    "Xem https://athahub.com/stream/pages/khac.",
  )
})

test("a one-word name that is a common word needs the word that says what it is", () => {
  assert.deepEqual(links("Friends và Angel đi chơi."), [])
  assert.deepEqual(links("Trận giữa đội Friends và đội tuyển Angel."), ["Friends=friends", "Angel=angel"])
})

test("a team named after a place is the place, unless it is called a team", () => {
  assert.equal(nameRule("team", "Hà Nội"), "introduced")
  assert.deepEqual(links("Chung kết diễn ra tại Hà Nội, có đội Hà Nội."), ["Hà Nội=hanoi"])
})

test("a team named with everyday words needs to be called a team", () => {
  assert.equal(nameRule("team", "First Blood"), "introduced")
  assert.equal(nameRule("team", "Team Secret"), "written")
  assert.equal(nameRule("team", "ONE Team"), "written")
})

test("a one-word name no ordinary word looks like stands for itself", () => {
  assert.deepEqual(links("TheSymbiotes giành vé."), ["TheSymbiotes=symbiotes"])
})

test("another name of a team counts when each of its words has a capital", () => {
  assert.deepEqual(links("Box Gaming VN và box gaming vn"), ["Box Gaming VN=box"])
})

test("a player's name links beside a team of theirs, wherever the paragraph names it", () => {
  assert.deepEqual(links("Kaisa giành MVP cho Box Gaming."), ["Kaisa=kaisa", "Box Gaming=box"])
  assert.deepEqual(links("Kaisa giành MVP cho Team Flash."), ["Team Flash=flash"])
})

test("a player's name links after the word that says who they are", () => {
  assert.deepEqual(links("Theo tuyển thủ Kaisa, trận này dễ."), ["Kaisa=kaisa"])
  assert.deepEqual(links("Bình luận cùng BLV Tony Bình."), ["Tony Bình=tony"])
})

test("a nickname that is an everyday word stays plain even beside the team", () => {
  assert.deepEqual(links("Top 3 gọi tên Team Flash."), ["Team Flash=flash"])
  assert.deepEqual(links("Team Flash có tuyển thủ Top."), ["Team Flash=flash", "Top=top"])
})

test("a nickname that is a part of a longer name stays plain", () => {
  assert.deepEqual(links("Team Flash đại diện Việt Nam."), ["Team Flash=flash"])
})

test("a nickname two players share links the one whose team is named", () => {
  assert.deepEqual(links("Reddit rời Box Gaming."), ["Reddit=red-1", "Box Gaming=box"])
  assert.deepEqual(links("Reddit gặp lại Box Gaming và Team Flash."), ["Box Gaming=box", "Team Flash=flash"])
})

test("on a team's own page its players need no team beside them", () => {
  assert.deepEqual(links("Kaisa là đội trưởng.", { exclude: new Set(["team:box"]) }), ["Kaisa=kaisa"])
})

test("a hero and a player with one name are told apart by the word before it, or stay plain", () => {
  assert.deepEqual(links("Cấm Zuka ở lượt đầu."), ["Zuka=zuka"])
  assert.deepEqual(links("Tuyển thủ Zuka lên ngôi."), ["Zuka=zuka-player"])
  assert.deepEqual(links("Box Gaming cấm Zuka."), ["Box Gaming=box"])
  assert.deepEqual(links("Box Gaming cấm tướng Zuka."), ["Box Gaming=box", "Zuka=zuka"])
})

test("a hero whose name is a common name needs to be called a hero", () => {
  assert.deepEqual(links("Max nói về tướng Max."), ["Max=max"])
  assert.equal(nameRule("hero", "Max"), "introduced")
})

test("a game entry of two common words needs its kind before it, a longer one does not", () => {
  assert.deepEqual(links("Sân nhà của họ có Kiếm truy hồn và phù hiệu sân nhà."), [
    "Kiếm truy hồn=truy-hon",
    "sân nhà=san-nha",
  ])
})

test("names that are only digits, or open with a sign, never link by themselves", () => {
  assert.equal(nameRule("team", "659"), "never")
  assert.equal(nameRule("player", "¥umiko"), "never")
  assert.equal(nameRule("player", "W"), "never")
})

test("other markup stays as typed in text written by hand", () => {
  const text = "<b>RPL</b> và <color=#ff0000>AIC</color>"

  assert.equal(plain(parse(text)), text)
  assert.deepEqual(links(text), ["RPL=rpl", "AIC=aic"])
})

test("at most the allowed number of references is made over all paragraphs", () => {
  assert.equal(links("RPL\n\nAIC\n\nAOG", { maxReferences: 2 }).length, 2)
})

test("game text never takes the names of competitions and people", () => {
  const game = createEntityIndex(records, "vi-VN", "vi-VN")
  const found = parseRichText("RPL, Box Gaming và Zuka", game).flatMap((node) =>
    node.type === "reference" ? [node.entity.id] : [],
  )

  assert.deepEqual(found, ["zuka"])
})
