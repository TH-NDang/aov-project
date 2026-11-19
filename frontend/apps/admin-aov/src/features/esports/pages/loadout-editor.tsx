import type { Catalog, Participant } from "@aov/community-contracts"
import { ArcanaEditor } from "./loadout-arcana"
import { EnchantmentsEditor } from "./loadout-enchantments"
import type { Change, ObservedAtControl } from "./loadout-section"

/** Emblems first, then arcana: the order a broadcast shows them and the order of the icons on the scoreboard. */
export function LoadoutEditor({
  participant,
  catalog,
  observedAt,
  onChange,
}: {
  participant: Participant
  catalog: Catalog
  observedAt?: ObservedAtControl
  onChange: Change<Participant>
}) {
  return (
    <div className="@container space-y-5">
      <EnchantmentsEditor
        value={participant.enchantments}
        catalog={catalog}
        observedAt={observedAt}
        onChange={(change) =>
          onChange((current) => {
            const enchantments = change(current.enchantments)
            return enchantments === current.enchantments ? current : { ...current, enchantments }
          })
        }
      />
      <ArcanaEditor
        value={participant.arcana}
        catalog={catalog}
        observedAt={observedAt}
        onChange={(change) =>
          onChange((current) => {
            const arcana = change(current.arcana)
            return arcana === current.arcana ? current : { ...current, arcana }
          })
        }
      />
    </div>
  )
}
