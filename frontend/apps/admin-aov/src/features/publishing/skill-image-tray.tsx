import { ImageIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { cn } from "@aov/ui/lib/utils"
import { HeroAsset } from "./hero-asset"
import { skillSlot } from "./hero-skills"
import type { SkillImage } from "./skill-artwork"
import { MAX_STATE_ICONS, stateIconsOf } from "./skill-state-icons"
import type { Skill } from "./types"

const slotName = (slot: number) => (slot === 0 ? "Nội tại" : `Chiêu ${slot}`)

/**
 * Library pictures no skill of the draft uses yet, grouped by slot with the chosen skill's slot first. Each picture
 * can become that skill's icon, one of its state icons, or a new variant of its own slot.
 */
export function SkillImageTray({
  images,
  selected,
  selectedName,
  disabled = false,
  onUseAsIcon,
  onAddState,
  onCreateVariant,
}: {
  images: readonly SkillImage[]
  selected?: Skill
  selectedName: string
  disabled?: boolean
  onUseAsIcon: (image: SkillImage) => void
  onAddState: (image: SkillImage) => void
  onCreateVariant: (image: SkillImage) => void
}) {
  if (!images.length) return null
  const current = selected ? skillSlot(selected) : null
  const slots = [...new Set(images.map((image) => image.sourceSlot))].sort(
    (a, b) => Number(b === current) - Number(a === current) || a - b,
  )
  const full = !selected || stateIconsOf(selected).length >= MAX_STATE_ICONS

  return (
    <section aria-label="Ảnh chưa gắn" className="space-y-3 rounded-xl border border-dashed p-3">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <ImageIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="type-label">Ảnh chưa gắn</h3>
        <span className="type-meta rounded-full bg-muted px-2 tabular-nums">{images.length}</span>
        <p className="type-meta basis-full">
          Ảnh trong thư viện của tướng chưa thuộc chiêu nào. Bấm một ảnh để gắn vào chiêu đang chọn hoặc tạo biến thể.
        </p>
      </header>
      {slots.map((slot) => (
        <div key={slot} className="space-y-1.5">
          <p className={cn("type-meta", slot === current && "text-foreground")}>
            {slotName(slot)}
            {slot === current && " · cùng ô với chiêu đang chọn"}
          </p>
          <ul className="flex flex-wrap gap-1">
            {images
              .filter((image) => image.sourceSlot === slot)
              .map((image) => (
                <li key={image.id}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild disabled={disabled}>
                      <button
                        type="button"
                        aria-label={`${slotName(slot)} · ảnh ${image.variantNo} · chọn cách gắn`}
                        title={image.label || image.sourceFilename}
                        className="flex w-16 flex-col items-center gap-1 rounded-lg px-1 pt-1.5 pb-1 outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      >
                        <HeroAsset id={image.assetId} className="size-11 rounded-full" frameAspectRatio={1} />
                        <span className="type-meta">Ảnh {image.variantNo}</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-72">
                      <DropdownMenuLabel className="type-meta truncate">
                        {selected ? `Chiêu đang chọn: ${selectedName}` : "Chưa chọn chiêu"}
                      </DropdownMenuLabel>
                      <DropdownMenuItem disabled={!selected} onSelect={() => onUseAsIcon(image)}>
                        Dùng làm ảnh chính
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={full} onSelect={() => onAddState(image)}>
                        Thêm làm ảnh theo trạng thái
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => onCreateVariant(image)}>
                        Tạo biến thể mới của {slotName(slot)}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
