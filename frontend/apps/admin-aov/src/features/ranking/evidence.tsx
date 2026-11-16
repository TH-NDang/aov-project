import { useState } from "react"
import { ImageOff } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { useSourceUrl } from "../files/source-links"
import type { RankingImage, RankingSource } from "./ranking-api"

interface Area {
  x: number
  y: number
  width: number
  height: number
}

/** Grows an area by `pad` pixels on each side, clamped to the screenshot. */
export function around(box: Area, image: { width: number; height: number }, padX: number, padY = padX): Area {
  const x = Math.max(0, box.x - padX)
  const y = Math.max(0, box.y - padY)
  return {
    x,
    y,
    width: Math.min(image.width, box.x + box.width + padX) - x,
    height: Math.min(image.height, box.y + box.height + padY) - y,
  }
}

/** The whole list row a value sits in, from the hero's portrait to the last column, so the name and value read together. */
export function rowArea(box: Area, image: { width: number; height: number }): Area {
  const band = around(box, image, 0, box.height < 100 ? 18 : 6)
  return { x: 120, y: band.y, width: Math.min(image.width, 2240) - 120, height: band.height }
}

/** The portrait, name and role at the start of the value's row. */
export function nameArea(box: Area, image: { width: number; height: number }): Area {
  const band = box.height < 100 ? around(box, image, 0, 12) : box
  return { x: 135, y: band.y, width: Math.min(image.width, 640) - 135, height: band.height }
}

/**
 * Shows one area of a screenshot at the width of its box, with the value's own box outlined. The screenshot is drawn
 * once at full size and moved, so every crop of the same page shares one download.
 */
export function EvidenceCrop({
  image,
  area,
  highlight,
  className,
  label,
}: {
  image: RankingImage
  area: Area
  highlight?: RankingSource | null
  className?: string
  label: string
}) {
  const link = useSourceUrl(image.imageId)
  const [broken, setBroken] = useState(false)
  if (link.failed || broken)
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border border-dashed px-3 py-4 type-meta text-muted-foreground",
          className,
        )}
      >
        <ImageOff className="size-4 shrink-0" />
        Không mở được ảnh gốc {image.fileName} trong Tệp nguồn.
      </div>
    )
  const percent = (value: number, of: number) => `${(value / of) * 100}%`
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("relative max-w-full overflow-hidden rounded-md bg-muted", className)}
      style={{ aspectRatio: `${area.width} / ${area.height}` }}
    >
      {link.url && (
        <img
          src={link.url}
          alt=""
          draggable={false}
          onError={() => {
            // An expired link is renewed and the picture loads again; a fresh one that fails is a broken picture.
            if (!link.retry()) setBroken(true)
          }}
          className="pointer-events-none absolute max-w-none select-none"
          style={{
            width: percent(image.width, area.width),
            left: percent(-area.x, area.width),
            top: percent(-area.y, area.height),
          }}
        />
      )}
      {highlight && (
        <span
          aria-hidden
          className="absolute rounded-sm outline-2 outline-[var(--aov-accent)] outline-offset-1"
          style={{
            left: percent(highlight.x - area.x, area.width),
            top: percent(highlight.y - area.y, area.height),
            width: percent(highlight.width, area.width),
            height: percent(highlight.height, area.height),
          }}
        />
      )}
    </div>
  )
}
