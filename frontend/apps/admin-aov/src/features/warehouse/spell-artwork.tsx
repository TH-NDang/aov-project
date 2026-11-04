import { useState } from "react"
import { ArrowLeftRight } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { HeroAsset } from "../publishing/hero-content"
import { warehouseText, type SpellContent } from "./warehouse-types"

export function SpellArtwork({
  iconAssetId,
  states = [],
  defaultStateKey,
  name,
  locale,
  preview = false,
  card = false,
}: {
  iconAssetId: string | null
  states?: SpellContent["states"]
  defaultStateKey?: string | null
  name: string
  locale: string
  preview?: boolean
  card?: boolean
}) {
  const [selectedKey, setSelectedKey] = useState(defaultStateKey ?? states[0]?.key)
  const index = Math.max(
    0,
    states.findIndex((state) => state.key === selectedKey),
  )
  const selected = states.length > 1 ? states[index] : undefined
  const next = selected && states[(index + 1) % states.length]
  const selectedName = (selected && warehouseText(selected.translations, locale)?.name) || name
  const nextName = next && (warehouseText(next.translations, locale)?.name || next.key)
  return (
    <div
      className={cn("min-w-0", card ? "w-full space-y-1.5" : selected && "w-20 space-y-0.5")}
      role={selected && "group"}
      aria-label={selected && "Các trạng thái phụ trợ"}
    >
      <div className={cn("grid place-items-center", card && "h-16")}>
        {selected && next ? (
          <div className="relative size-12">
            <div className="absolute top-0 right-0 opacity-75">
              <HeroAsset
                id={next.iconAssetId}
                alt={nextName}
                frameAspectRatio={1}
                preview={preview}
                className="size-8 rounded-full border-2 border-background bg-card"
              />
            </div>
            <div className="absolute bottom-1 left-0">
              <HeroAsset
                id={selected.iconAssetId}
                alt={selectedName}
                frameAspectRatio={1}
                preview={preview}
                className="size-10 rounded-full border-2 border-background bg-card"
              />
            </div>
            <button
              type="button"
              aria-label={`Chuyển sang ${nextName}`}
              title={`Chuyển sang ${nextName}`}
              onClick={() => setSelectedKey(next.key)}
              className="absolute right-0 bottom-0 z-20 grid size-6 cursor-pointer place-items-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ArrowLeftRight aria-hidden className="size-3" />
            </button>
          </div>
        ) : (
          <HeroAsset
            id={iconAssetId}
            alt={name}
            frameAspectRatio={1}
            preview={preview}
            className="size-10 shrink-0 rounded-full border bg-transparent"
          />
        )}
      </div>
      {(card || selected) && (
        <span
          aria-live={selected && "polite"}
          title={selectedName}
          className={cn(
            "block truncate text-center text-xs",
            card ? "leading-4 font-semibold" : "leading-3 text-muted-foreground",
          )}
        >
          {selectedName}
        </span>
      )}
    </div>
  )
}
