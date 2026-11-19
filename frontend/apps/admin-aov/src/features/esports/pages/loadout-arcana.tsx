import { useMemo, useState } from "react"
import type { ArcanaAllocation, Catalog, Loadout } from "@aov/community-contracts"
import { X } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import {
  ARCANA_COLORS,
  ARCANA_PAGE_TIER,
  STONES_PER_COLOR,
  arcanaStatus,
  isArcanaColor,
  removeRecordedStone,
  stonesOf,
  type ArcanaColor,
} from "../model/loadout"
import { ArcanaColumn } from "./loadout-arcana-column"
import { LoadoutSection, type Change, type ObservedAtControl } from "./loadout-section"

/**
 * The arcana page: one column per colour, each stone a button carrying its picture and the stat a broadcast prints.
 * One click fills the colour, so the common page (one kind per colour) takes three clicks.
 */
export function ArcanaEditor({
  value,
  catalog,
  observedAt,
  onChange,
}: {
  value: Loadout<ArcanaAllocation>
  catalog: Catalog
  observedAt?: ObservedAtControl
  onChange: Change<Loadout<ArcanaAllocation>>
}) {
  // Where the three columns do not fit side by side, one colour is shown at a time.
  const [colorShown, setColorShown] = useState<ArcanaColor>("RED")
  const byId = useMemo(() => new Map(catalog.arcana.map((stone) => [stone.id, stone])), [catalog.arcana])
  const total = value.entries.reduce((sum, entry) => sum + entry.count, 0)
  const uncoloured = value.entries.filter((entry) => !isArcanaColor(entry.color))

  return (
    <LoadoutSection
      part="arcana"
      title="Bảng ngọc"
      label="bảng ngọc"
      status={arcanaStatus(value.entries, value.status)}
      progress={`${total}/${STONES_PER_COLOR * 3}`}
      recorded={`${value.entries.length} loại ngọc`}
      hiddenText="Video không hiện bảng ngọc của tuyển thủ này; không xem đây là bảng trống."
      value={value}
      observedAt={observedAt}
      onChange={onChange}
    >
      <p className="text-xs text-muted-foreground">
        Chỉ có ngọc cấp III. Bấm một loại ngọc để lấy hết số viên còn trống của màu đó.
      </p>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 @lg:hidden" role="group" aria-label="Màu ngọc">
        {ARCANA_COLORS.map((color) => (
          <button
            key={color.code}
            type="button"
            data-arcana={color.code}
            aria-pressed={colorShown === color.code}
            onClick={() => setColorShown(color.code)}
            className={cn(
              "flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-semibold",
              colorShown === color.code ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            <span className="size-2 rounded-full bg-[var(--arcana)]" aria-hidden="true" />
            {color.label}
            <span className="esp-num font-normal">
              {stonesOf(value.entries, color.code)}/{STONES_PER_COLOR}
            </span>
          </button>
        ))}
      </div>
      <div className="grid gap-2 @lg:grid-cols-3">
        {ARCANA_COLORS.map((color) => (
          <ArcanaColumn
            key={color.code}
            color={color.code}
            label={color.label}
            className={colorShown === color.code ? undefined : "hidden @lg:block"}
            value={value}
            byId={byId}
            options={catalog.arcana.filter((stone) => stone.color === color.code && stone.tier === ARCANA_PAGE_TIER)}
            onChange={onChange}
          />
        ))}
      </div>
      {uncoloured.length > 0 && (
        <ul className="space-y-1 rounded-lg border p-1.5" aria-label="Ngọc chưa rõ màu">
          {uncoloured.map((entry, index) => (
            <li key={index} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate">
                {entry.selection.name || "Loại ngọc chưa rõ"} ×{entry.count} · chưa rõ màu
              </span>
              <button
                type="button"
                className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                aria-label={`Bỏ ${entry.selection.name || "loại ngọc chưa rõ"}`}
                onClick={() => onChange((loadout) => removeRecordedStone(loadout, entry))}
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </LoadoutSection>
  )
}
