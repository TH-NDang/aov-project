import type { Category, Glyph, MapObject } from "@aov/ui/lib/battle-map"
import { MapGlyph } from "@aov/ui/components/battle-map-glyph"
import { GLYPH_LABEL, GLYPHS } from "./map-edit-model"

/** Each kind keeps a colour so a long list reads at a glance, like the markers on the Wiki. */
export const CATEGORY_COLOR: Record<Category, string> = {
  STRUCTURE: "var(--aov-info)",
  MINION: "var(--muted-foreground)",
  MONSTER: "var(--aov-success)",
  EPIC: "var(--aov-game-gold)",
  MECHANIC: "var(--foreground)",
}

/** The object's uploaded icon, or the Wiki's drawn symbol while it has none. */
export function ObjectThumb({ object, src, size = "sm" }: { object: MapObject; src?: string; size?: "sm" | "lg" }) {
  const box = size === "lg" ? "size-16" : "size-8"
  return (
    <span
      className={`inline-grid ${box} shrink-0 place-items-center overflow-hidden rounded-full border-2 bg-muted`}
      style={{ borderColor: CATEGORY_COLOR[object.category], color: CATEGORY_COLOR[object.category] }}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <MapGlyph glyph={object.glyph} size={size === "lg" ? 34 : 18} />
      )}
    </span>
  )
}

/** The drawn symbols to pick from; the Wiki shows the chosen one until an icon is uploaded. */
export function GlyphPicker({ value, onChange }: { value?: Glyph | null; onChange: (glyph: Glyph) => void }) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Ký hiệu">
      {GLYPHS.map((glyph) => (
        <button
          key={glyph}
          type="button"
          title={GLYPH_LABEL[glyph]}
          aria-label={GLYPH_LABEL[glyph]}
          aria-pressed={glyph === value}
          onClick={() => onChange(glyph)}
          className={`grid size-9 place-items-center rounded-md border transition-colors ${
            glyph === value
              ? "border-primary bg-primary/15 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MapGlyph glyph={glyph} size={20} />
        </button>
      ))}
    </div>
  )
}
