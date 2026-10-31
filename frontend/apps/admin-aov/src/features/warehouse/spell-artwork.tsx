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
  compact = false,
}: {
  iconAssetId: string | null
  states?: SpellContent["states"]
  defaultStateKey?: string | null
  name: string
  locale: string
  preview?: boolean
  compact?: boolean
}) {
  const [selectedKey, setSelectedKey] = useState(defaultStateKey ?? states[0]?.key)
  if (states.length < 2) {
    return (
      <HeroAsset
        id={iconAssetId}
        alt={name}
        frameAspectRatio={1}
        preview={preview}
        className={cn("shrink-0 rounded-full border bg-transparent", compact ? "size-10" : "size-16")}
      />
    )
  }
  const index = Math.max(
    0,
    states.findIndex((state) => state.key === selectedKey),
  )
  const selected = states[index]
  const next = states[(index + 1) % states.length]
  const selectedName = warehouseText(selected.translations, locale)?.name || selected.key
  const nextName = warehouseText(next.translations, locale)?.name || next.key
  return (
    <div
      className={cn("max-w-full shrink-0", compact ? "w-20 space-y-0.5" : "w-24 space-y-1.5")}
      role="group"
      aria-label="Các trạng thái phụ trợ"
    >
      <div className={cn("relative mx-auto", compact ? "size-12" : "size-20")}>
        <div className="absolute top-0 right-0 opacity-75">
          <HeroAsset
            id={next.iconAssetId}
            alt={nextName}
            frameAspectRatio={1}
            preview={preview}
            className={cn("rounded-full border-2 border-background bg-card", compact ? "size-8" : "size-12")}
          />
        </div>
        <div className="absolute bottom-1 left-0">
          <HeroAsset
            id={selected.iconAssetId}
            alt={selectedName}
            frameAspectRatio={1}
            preview={preview}
            className={cn("rounded-full border-2 border-background bg-card", compact ? "size-10" : "size-14")}
          />
        </div>
        <button
          type="button"
          aria-label={`Chuyển sang ${nextName}`}
          title={`Chuyển sang ${nextName}`}
          onClick={() => setSelectedKey(next.key)}
          className={cn(
            "absolute right-0 bottom-0 z-20 grid cursor-pointer place-items-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            compact ? "size-6" : "size-8",
          )}
        >
          <ArrowLeftRight aria-hidden className={compact ? "size-3" : "size-3.5"} />
        </button>
      </div>
      <span
        aria-live="polite"
        title={selectedName}
        className={cn(
          "block text-center text-muted-foreground",
          compact ? "truncate text-xs leading-3" : "min-h-8 text-xs leading-4",
        )}
      >
        {selectedName}
      </span>
    </div>
  )
}
