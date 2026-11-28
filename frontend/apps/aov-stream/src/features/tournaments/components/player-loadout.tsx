import type { Catalog, Participant } from "@aov/community-contracts"
import { useStreamLocale } from "../../../components/stream-locale"
import { mainEnchantment, type BuildView } from "../../../lib/build-view"
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

/**
 * The items a player ended with, the build itself first and what was bought for protection after it, with a faint
 * place for each slot nobody could read. A few words stand for items nobody recorded.
 */
export function LoadoutItems({ catalog, build }: { catalog: Catalog; build: BuildView | null }) {
  const { text } = useStreamLocale()
  const { end = [], unread = 0 } = build ?? {}
  const blank = !(end.length || unread)
  return (
    <span className="tn-build" data-blank={blank || undefined}>
      {end.map((built, index) => (
        <BuildItem key={index} catalog={catalog} built={built} />
      ))}
      {Array.from({ length: unread }, (_, index) => (
        <span key={`unread-${index}`} className="tn-build-place" title={text("Chưa rõ", "Not known")} />
      ))}
      {blank && (build ? text("Không có trang bị", "No items") : text("Chưa rõ trang bị", "Items not known"))}
    </span>
  )
}
