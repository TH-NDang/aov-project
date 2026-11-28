import { ChevronRight } from "lucide-react"
import { changeKindIcons } from "@aov/ui/components/change-kind-icons"
import { HeroAsset } from "../editing/hero-asset"
import type { RecordedChangeSet } from "./patch-change-lines"

interface FixHero {
  name: string
  iconAssetId?: string | null
}

/** The change sets of a patch that only fix bugs: after the balance changes, one short row each. */
export function HeroFixList({
  rows,
  heroById,
  onOpen,
}: {
  rows: RecordedChangeSet[]
  heroById: Map<string, FixHero>
  onOpen: (change: RecordedChangeSet) => void
}) {
  const Icon = changeKindIcons.FIX
  return (
    <section aria-labelledby="hero-fix-list-title" className="space-y-2">
      <h4 id="hero-fix-list-title" className="type-label flex items-center gap-1.5 text-muted-foreground">
        <Icon aria-hidden className="size-4" /> Sửa lỗi và tối ưu
        <span className="tabular-nums">{rows.length}</span>
      </h4>
      <ul className="divide-y rounded-lg border border-dashed bg-muted/20">
        {rows.map((change) => {
          const hero = heroById.get(change.heroId)
          const name = hero?.name ?? change.heroCode
          const notes = change.changes.map((line) => (typeof line.description === "string" ? line.description : ""))
          const text = change.summary || notes.filter(Boolean).join(" · ") || `${change.changes.length} mục sửa lỗi`
          return (
            <li key={change.id}>
              <button
                type="button"
                onClick={() => onOpen(change)}
                aria-label={`Xem sửa lỗi ${name}`}
                className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <HeroAsset id={hero?.iconAssetId} alt="" className="size-7 shrink-0 rounded-md" frameAspectRatio={1} />
                <span className="min-w-0 flex-1">
                  <span className="type-body block">{name}</span>
                  <span className="type-meta block">{text}</span>
                </span>
                <ChevronRight aria-hidden className="mt-1.5 size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
