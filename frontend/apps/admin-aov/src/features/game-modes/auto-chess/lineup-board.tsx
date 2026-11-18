import { useState } from "react"
import { Button } from "@aov/ui/components/button"
import type { GuideContent, GuideLineup } from "../game-mode-api"
import { COST_COLOR } from "./guide-model"
import { Thumb } from "./guide-fields"

const BOARD_ROWS = [
  ["FRONT", "Hàng trước"],
  ["MIDDLE", "Hàng giữa"],
  ["BACK", "Hàng sau"],
] as const

const BOARD_COLUMNS = [1, 2, 3, 4, 5, 6, 7]

type BoardRow = (typeof BOARD_ROWS)[number][0]

type LineupMember = GuideLineup["units"][number]

const cellKey = (member: LineupMember) => (member.row && member.column ? `${member.row}-${member.column}` : null)

/**
 * The lineup on the game's board: three rows of seven cells, the front row on top toward the opponent. Pick a unit,
 * then a cell; a placed unit's cell takes the picked unit and sends its own unit to the picked one's old place.
 */
export function BoardEditor({
  lineup,
  units,
  image,
  update,
}: {
  lineup: GuideLineup
  units: Map<string, GuideContent["units"][number]>
  image: (assetId?: string | null) => string | undefined
  update: (next: GuideLineup) => void
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const placed = new Map<string, LineupMember>()
  for (const member of lineup.units) {
    const key = cellKey(member)
    if (key && !placed.has(key)) placed.set(key, member)
  }
  const bench = lineup.units.filter((member) => {
    const key = cellKey(member)
    return !key || placed.get(key) !== member
  })
  const pickedMember = lineup.units.find((member) => member.unitCode === picked)

  function place(code: string, cell: { row: BoardRow; column: number } | null) {
    const mover = lineup.units.find((member) => member.unitCode === code)
    if (!mover) return
    const occupant = cell ? placed.get(`${cell.row}-${cell.column}`) : undefined
    update({
      ...lineup,
      units: lineup.units.map((member) =>
        member === mover
          ? { ...member, row: cell?.row ?? null, column: cell?.column ?? null }
          : member === occupant && occupant !== mover
            ? { ...member, row: mover.row ?? null, column: mover.column ?? null }
            : member,
      ),
    })
    setPicked(null)
  }

  return (
    <div className="grid gap-3">
      <div className="grid w-full max-w-md gap-1">
        <span className="type-meta text-center">↑ Phía đối thủ</span>
        <div className="grid gap-1 rounded-lg border bg-muted/40 p-2">
          {BOARD_ROWS.map(([row, label]) => (
            <div key={row} className="grid grid-cols-7 gap-1" role="row" aria-label={label}>
              {BOARD_COLUMNS.map((column) => {
                const member = placed.get(`${row}-${column}`)
                const unit = member ? units.get(member.unitCode) : undefined
                const src = image(unit?.portraitAssetId)
                return (
                  <button
                    key={column}
                    type="button"
                    aria-label={`${label}, ô ${column}${unit ? `: ${unit.name}` : ""}`}
                    title={unit ? unit.name : `${label}, ô ${column}`}
                    disabled={!member && !picked && !bench.length}
                    onClick={() => {
                      if (member && picked !== member.unitCode && !picked) return setPicked(member.unitCode)
                      if (member && picked === member.unitCode) return setPicked(null)
                      const code = picked ?? bench[0]?.unitCode
                      if (code) place(code, { row, column })
                    }}
                    className={`relative aspect-square rounded-md border transition-colors ${
                      member
                        ? picked === member.unitCode
                          ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                          : ""
                        : picked
                          ? "border-dashed border-primary bg-primary/10"
                          : "border-dashed bg-background/60 hover:border-foreground/40"
                    }`}
                  >
                    {unit &&
                      (src ? (
                        <img
                          src={src}
                          alt=""
                          className="size-full rounded-md border-2 object-cover"
                          style={{ borderColor: COST_COLOR[unit.cost] }}
                        />
                      ) : (
                        <span className="type-meta grid size-full place-items-center">{unit.name.slice(0, 3)}</span>
                      ))}
                    {member?.carry && (
                      <span className="type-label absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-primary px-1 text-primary-foreground">
                        M
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="type-label">Chưa xếp chỗ</span>
        {bench.map((member) => {
          const unit = units.get(member.unitCode)
          return (
            <button
              key={member.unitCode}
              type="button"
              title={unit?.name ?? member.unitCode}
              aria-pressed={picked === member.unitCode}
              onClick={() => setPicked(picked === member.unitCode ? null : member.unitCode)}
              className={`rounded-md p-0.5 ${picked === member.unitCode ? "ring-2 ring-primary" : "opacity-80 hover:opacity-100"}`}
            >
              <Thumb src={image(unit?.portraitAssetId)} color={unit ? COST_COLOR[unit.cost] : undefined} />
            </button>
          )
        })}
        {!bench.length && <span className="type-meta">Mọi quân đã có chỗ.</span>}
        {pickedMember && cellKey(pickedMember) && (
          <Button type="button" variant="outline" size="sm" onClick={() => place(pickedMember.unitCode, null)}>
            Bỏ {units.get(pickedMember.unitCode)?.name ?? pickedMember.unitCode} khỏi bàn
          </Button>
        )}
      </div>
    </div>
  )
}
