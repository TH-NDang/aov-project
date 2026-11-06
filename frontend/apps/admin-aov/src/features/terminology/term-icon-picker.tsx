import { Input } from "@aov/ui/components/input"
import {
  defaultTermGlyph,
  gameplayIconNames,
  gameplayIcons,
  glyphIcon,
  termGlyphName,
} from "@aov/ui/components/gameplay-icons"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import { cn } from "@aov/ui/lib/utils"

/** A term's icon, seen rather than typed: pick a silhouette, or give the address of a picture of its own. */
export function TermIconPicker({
  entity,
  onChange,
}: {
  entity: Pick<EntityReference, "id" | "icon">
  onChange: (icon: string | null) => void
}) {
  const current = termGlyphName(entity)
  const standard = defaultTermGlyph(entity.id)
  const picture = entity.icon && !entity.icon.startsWith("glyph:") ? entity.icon : ""
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="type-label">Biểu tượng</span>
        {entity.icon && (
          <button
            type="button"
            className="type-meta underline underline-offset-2 hover:text-foreground"
            onClick={() => onChange(null)}
          >
            Dùng mặc định
          </button>
        )}
      </div>
      <div
        role="group"
        aria-label="Chọn biểu tượng"
        className="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-1"
      >
        {gameplayIconNames.map((name) => {
          const Icon = gameplayIcons[name]
          const chosen = current === name
          return (
            <button
              key={name}
              type="button"
              aria-pressed={chosen}
              aria-label={`Biểu tượng ${name}`}
              title={standard === name ? `${name} (mặc định)` : name}
              className={cn(
                "grid size-10 place-items-center rounded-md border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                chosen && "border-primary bg-primary/10 text-foreground",
              )}
              onClick={() => onChange(standard === name ? null : glyphIcon(name))}
            >
              <Icon size={22} />
            </button>
          )
        })}
      </div>
      <label className="grid gap-1.5">
        <span className="type-meta">Hoặc địa chỉ ảnh riêng</span>
        <Input value={picture} onChange={(event) => onChange(event.target.value || null)} />
      </label>
    </div>
  )
}
