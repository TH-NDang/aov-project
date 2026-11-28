import type { Catalog, Participant, Selection } from "@aov/community-contracts"
import { mainEnchantment, type BuildView, type BuiltItem, type LineupRecord, type PathStep } from "./build-view.ts"
import { clock, findReference, present, referenceName, UNKNOWN_REFERENCE } from "./tournament-model.ts"

type Say = (vi: string, en: string) => string

/** The highest tier of an item; one below it that was given up was held on the way to another. */
const TOP_TIER = 3

/** What a reader who cannot see the pictures of a seat hears: the spell, the main enchantment and the items. */
export function loadoutWords(seat: Participant, catalog: Catalog, build: BuildView | null, text: Say): string {
  const name = (kind: "spells" | "enchantments" | "items", selection: Selection) =>
    referenceName(catalog, kind, selection, text(...UNKNOWN_REFERENCE))
  const items = (label: string, list: BuiltItem[] = []) =>
    list.length > 0 && `${label}: ${list.map((built) => name("items", built.item)).join(", ")}`
  const main = mainEnchantment(seat)
  const end = build?.end ?? []
  const said = [
    present(seat.spell) && `${text("Phụ trợ", "Spell")}: ${name("spells", seat.spell)}`,
    main && `${text("Phù hiệu", "Enchantment")}: ${name("enchantments", main.selection)}`,
    items(
      text("Trang bị", "Items"),
      end.filter((built) => !built.protective),
    ),
    items(
      text("Bảo hộ", "Protective"),
      end.filter((built) => built.protective),
    ),
    items(
      text("Đã bán", "Sold"),
      build?.path.filter((step) => step.fate === "SOLD"),
    ),
  ].filter(Boolean)
  return said.length ? `${said.join(". ")}.` : ""
}

/** What a line of the path says beside an item: its tier, what became of it, and what it came from. */
export type PathNotes = { tier: string | null; fate: string | null; lineage: string | null }

export function pathNotes(step: PathStep, catalog: Catalog, text: Say): PathNotes {
  const name = (item: Selection) => referenceName(catalog, "items", item, text(...UNKNOWN_REFERENCE))
  const and = (names: string[]) => names.join(text(" và ", " and "))
  const tier = findReference(catalog, "items", step.item)?.tier
  const { next, atSeconds } = step
  const minutes = next?.atSeconds != null && atSeconds != null ? Math.round((next.atSeconds - atSeconds) / 60) : 0
  let fate: string | null = null
  if (step.fate === "UPGRADED" && next)
    fate =
      minutes > 0
        ? text(`giữ ${minutes} phút, lên ${name(next.item)}`, `held ${minutes} min, then built into ${name(next.item)}`)
        : text(`lên ${name(next.item)}`, `built into ${name(next.item)}`)
  else if (step.fate === "SOLD" && next)
    fate =
      next.atSeconds != null
        ? text(
            `bán lúc ${clock(next.atSeconds)} lấy ${name(next.item)}`,
            `sold at ${clock(next.atSeconds)} for ${name(next.item)}`,
          )
        : text(`bán để lấy ${name(next.item)}`, `sold for ${name(next.item)}`)
  else if (step.fate === "SOLD") fate = text("bán trước khi hết ván", "sold before the end")
  const parts = step.from.map(({ item, atSeconds: bought }) =>
    bought == null
      ? name(item)
      : text(`${name(item)} mua lúc ${clock(bought)}`, `${name(item)} bought at ${clock(bought)}`),
  )
  const lineage = [
    parts.length > 0 && text(`từ ${and(parts)}`, `from ${and(parts)}`),
    step.replaces.length > 0 &&
      text(
        `thay ${and(step.replaces.map(({ item }) => name(item)))}`,
        `in place of ${and(step.replaces.map(({ item }) => name(item)))}`,
      ),
  ].filter((words): words is string => !!words)
  return {
    tier: step.fate !== "HELD" && tier != null && tier < TOP_TIER ? text(`Cấp ${tier}`, `Tier ${tier}`) : null,
    fate,
    lineage: lineage.length ? lineage.join(", ") : null,
  }
}

/** What nobody recorded of a game, in one sentence; null where every kind of thing is recorded for somebody. */
function lackingWords({ players, items, spells, enchantments }: LineupRecord, text: Say, at: number | null) {
  const kinds = [
    !items && at == null && text("trang bị", "items"),
    !spells && text("phụ trợ", "spells"),
    !enchantments && text("phù hiệu", "enchantments"),
  ].filter((kind): kind is string => !!kind)
  const list = [kinds.slice(0, -1).join(", "), kinds.at(-1)].filter(Boolean).join(text(" và ", " and "))
  if (!players)
    return list
      ? text(
          `Ván này chưa ghi ai chơi tướng nào, cũng chưa ghi ${list}.`,
          `Who played which hero is not recorded for this game, nor are the ${list}.`,
        )
      : text("Ván này chưa ghi ai chơi tướng nào.", "Who played which hero is not recorded for this game.")
  return list ? text(`Ván này chưa ghi ${list}.`, `The ${list} of this game are not recorded yet.`) : null
}

/** When the items of a game were seen and how many of its players they were written down for; null without any. */
function itemWords({ items, built, atEnd, unread }: LineupRecord, text: Say, at: number | null) {
  const faint = `${unread ? text("; ô mờ là chưa rõ", "; a faint slot is not known") : ""}.`
  const seen = atEnd
    ? text("lúc ván kết thúc", "when the game ended")
    : text("ở lần cuối nguồn cho thấy", "the last time the source showed them")
  if (at != null)
    return items
      ? text(`Trang bị nhìn thấy lần cuối tính đến ${clock(at)}`, `Items as last seen by ${clock(at)}`) + faint
      : text(`Chưa thấy trang bị của ai tính đến ${clock(at)}.`, `Nobody's items were seen by ${clock(at)}.`)
  if (built === items) return null
  if (!built) return text(`Trang bị ${seen}, không kể món cấp 1`, `Items held ${seen}, tier 1 left out`) + faint
  return (
    text(
      `${built} người có ghi các món đã lên, ${items - built} người chỉ có trang bị ${seen}`,
      `The items built are recorded for ${built} of ${items} players, for the others those held ${seen}`,
    ) + faint
  )
}

/**
 * How complete the record of a game is, in the few sentences a reader needs; none where nothing is missing. `at` is the
 * second of the game the record was counted at.
 */
export function recordWords(record: LineupRecord, text: Say, at: number | null = null): string[] {
  return [
    lackingWords(record, text, at),
    itemWords(record, text, at),
    record.enchantments > 0 &&
      record.mainOnly &&
      text("Mỗi người mới ghi phù hiệu chính.", "Only the main enchantment of each player is recorded."),
  ].filter((words): words is string => !!words)
}
