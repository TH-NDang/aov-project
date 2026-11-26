import { useState } from "react"
import type { Reference, Selection } from "@aov/community-contracts"
import { Plus } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { cn } from "@aov/ui/lib/utils"
import { heroKeys } from "../../model/series-rules"
import { ReferenceIcon, chosenTile } from "./loadout-fields"

const NONE: Selection = { id: null, name: null }

/**
 * The spells a player may take, as pictures with their names. A press records one, a press on the recorded one takes it
 * off again; a spell the catalogue does not have is written by its name and stands among the others.
 */
export function SpellPicker({
  label,
  value,
  spells,
  onPick,
}: {
  label: string
  value: Selection | null | undefined
  spells: Reference[]
  onPick: (spell: Selection) => void
}) {
  const own = new Set(heroKeys(value))
  const isOwn = (spell: Selection) => heroKeys(spell).some((key) => own.has(key))
  const written = own.size > 0 && !spells.some(isOwn) ? value : null
  const tile = (key: string, name: string, pressed: boolean, reference: Reference | undefined, pick: Selection) => (
    <button
      key={key}
      type="button"
      data-spell={reference?.code}
      aria-pressed={pressed}
      title={pressed ? `${name}: bấm để bỏ` : name}
      onClick={() => onPick(pressed ? NONE : pick)}
      className={cn(
        "flex min-w-0 flex-col items-center gap-1 rounded-md px-0.5 py-1.5 text-center text-xs leading-4 focus-visible:outline-2 focus-visible:outline-ring",
        pressed ? chosenTile : "hover:bg-muted",
      )}
    >
      <ReferenceIcon reference={reference} name={name} size={40} />
      <span className="line-clamp-2">{name}</span>
    </button>
  )
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-1" role="group" aria-label={label}>
        {spells.map((spell) => tile(spell.id, spell.name, isOwn(spell), spell, { id: spell.id, name: spell.name }))}
        {written && tile("written", written.name || "Chưa rõ tên", true, undefined, written)}
      </div>
      <WrittenName onPick={(name) => onPick({ id: null, name })} />
    </div>
  )
}

/** A name written by hand, for what the catalogue does not have. */
function WrittenName({ onPick }: { onPick: (name: string) => void }) {
  const [name, setName] = useState<string | null>(null)
  if (name === null)
    return (
      <Button
        type="button"
        size="xs"
        variant="ghost"
        className="-ml-2 text-muted-foreground"
        onClick={() => setName("")}
      >
        <Plus aria-hidden /> Tên khác
      </Button>
    )
  const typed = name.trim()
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (!typed) return
        onPick(typed)
        setName(null)
      }}
    >
      <Input
        autoFocus
        value={name}
        maxLength={100}
        className="h-8 min-w-0 flex-1"
        aria-label="Tên phụ trợ"
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return
          event.stopPropagation()
          setName(null)
        }}
      />
      <Button type="submit" size="sm" variant="outline" disabled={!typed}>
        Ghi
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setName(null)}>
        Hủy
      </Button>
    </form>
  )
}
