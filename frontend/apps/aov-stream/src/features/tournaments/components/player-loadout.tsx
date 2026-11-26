import type { Catalog, Participant } from "@aov/community-contracts"
import { useStreamLocale } from "../../../components/stream-locale"
import { mainEnchantment, type BuildView, type BuiltItem } from "../../../lib/build-view"
import { present } from "../../../lib/tournament-model"
import { BuildItem } from "./build-item"
import { ReferenceArt } from "./reference-art"
import "./player-loadout.css"

/** The spell of a player and the main enchantment; an empty place stands for the one nobody saw. */
export function LoadoutKit({ catalog, seat }: { catalog: Catalog; seat: Participant }) {
  const { text } = useStreamLocale()
  const main = mainEnchantment(seat)
  return (
    <span className="tn-loadout-kit">
      {present(seat.spell) ? (
        <ReferenceArt catalog={catalog} kind="spells" selection={seat.spell} />
      ) : (
        <span className="tn-loadout-none" title={text("Chưa rõ phụ trợ", "Spell not known")} />
      )}
      {main ? (
        <ReferenceArt className="tn-loadout-emblem" catalog={catalog} kind="enchantments" selection={main.selection} />
      ) : (
        <span className="tn-loadout-none" title={text("Chưa rõ phù hiệu", "Enchantment not known")} />
      )}
    </span>
  )
}

/** Items that are no part of what a player held to the end, behind the word for what became of them. */
function Aside({ catalog, label, items, gone }: { catalog: Catalog; label: string; items: BuiltItem[]; gone?: true }) {
  if (!items.length) return null
  return (
    <span>
      <small>{label}</small>
      {items.map((built, index) => (
        <BuildItem key={index} catalog={catalog} built={built} gone={gone} />
      ))}
    </span>
  )
}

/**
 * The items of a player: those held to the end, with a faint place for each slot nobody could read, then the ones given
 * up and the ones bought for a moment. A few words stand for items nobody recorded.
 */
export function LoadoutItems({ catalog, build }: { catalog: Catalog; build: BuildView | null }) {
  const { text } = useStreamLocale()
  const { kept = [], replaced = [], situational = [], unread = 0 } = build ?? {}
  const aside = replaced.length + situational.length > 0
  return (
    <>
      <span className="tn-build" data-blank={!(kept.length || unread || aside) || undefined}>
        {kept.map((built, index) => (
          <BuildItem key={index} catalog={catalog} built={built} />
        ))}
        {Array.from({ length: unread }, (_, index) => (
          <span key={`unread-${index}`} className="tn-build-place" title={text("Chưa rõ", "Not known")} />
        ))}
        {!(kept.length || unread || aside) &&
          (build ? text("Không có trang bị", "No items") : text("Chưa rõ trang bị", "Items not known"))}
      </span>
      {aside && (
        <span className="tn-build-more">
          <Aside catalog={catalog} label={text("Đã đổi", "Given up")} items={replaced} gone />
          <Aside catalog={catalog} label={text("Tình huống", "Situational")} items={situational} />
        </span>
      )}
    </>
  )
}
