import { useState } from "react"
import { ArrowLeftRight } from "lucide-react"
import { HeroAsset } from "../publishing/hero-content"
import { warehouseText, type SpellContent } from "./warehouse-types"

export function SpellArtwork({
  iconAssetId,
  states = [],
  defaultStateKey,
  name,
  locale,
  preview = false,
}: {
  iconAssetId: string | null
  states?: SpellContent["states"]
  defaultStateKey?: string | null
  name: string
  locale: string
  preview?: boolean
}) {
  const [selectedKey, setSelectedKey] = useState(defaultStateKey ?? states[0]?.key)
  if (states.length < 2) {
    return (
      <HeroAsset
        id={iconAssetId}
        alt={name}
        frameAspectRatio={1}
        preview={preview}
        className="size-16 shrink-0 rounded-full border bg-transparent"
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
    <div className="w-24 shrink-0 space-y-1.5" role="group" aria-label="Các trạng thái phụ trợ">
      <div className="relative mx-auto size-20">
        <div className="absolute top-0 right-0 opacity-75">
          <HeroAsset
            id={next.iconAssetId}
            alt={nextName}
            frameAspectRatio={1}
            preview={preview}
            className="size-12 rounded-full border-2 border-background bg-card"
          />
        </div>
        <div className="absolute bottom-1 left-0">
          <HeroAsset
            id={selected.iconAssetId}
            alt={selectedName}
            frameAspectRatio={1}
            preview={preview}
            className="size-14 rounded-full border-2 border-background bg-card"
          />
        </div>
        <button
          type="button"
          aria-label={`Chuyển sang ${nextName}`}
          title={`Chuyển sang ${nextName}`}
          onClick={() => setSelectedKey(next.key)}
          className="absolute right-0 bottom-0 z-20 grid size-8 cursor-pointer place-items-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeftRight aria-hidden className="size-3.5" />
        </button>
      </div>
      <span aria-live="polite" className="block min-h-8 text-center text-[11px] leading-4 text-muted-foreground">
        {selectedName}
      </span>
    </div>
  )
}
