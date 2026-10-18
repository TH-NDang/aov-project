import { cn } from "@aov/ui/lib/utils"
import { HeroAsset } from "../publishing/hero-content"
import type { MediaRole } from "../publishing/types"

const ratios: Record<MediaRole, number> = { HEAD: 1, PORTRAIT: 2 / 3, SPLASH: 16 / 9 }
const widths = {
  header: { HEAD: "w-12", PORTRAIT: "w-8", SPLASH: "w-20" },
  row: { HEAD: "w-14 sm:w-16", PORTRAIT: "w-10 sm:w-12", SPLASH: "w-20 sm:w-28" },
  switcher: { HEAD: "w-14", PORTRAIT: "w-9", SPLASH: "w-24" },
  related: { HEAD: "w-16", PORTRAIT: "w-12", SPLASH: "w-20" },
  detail: { HEAD: "w-full", PORTRAIT: "w-full", SPLASH: "w-full" },
} satisfies Record<string, Record<MediaRole, string>>

/** Keep each media role recognizable while displaying the complete original image. */
export function CharacterMediaImage({
  id,
  alt,
  role,
  size,
  preview = false,
}: {
  id?: string | null
  alt: string
  role: MediaRole
  size: keyof typeof widths
  preview?: boolean
}) {
  const image = (
    <HeroAsset
      key={id ?? "missing"}
      id={id}
      alt={alt}
      preview={preview}
      frameAspectRatio={ratios[role]}
      className={cn("mx-auto shrink-0 rounded-lg", widths[size][role])}
    />
  )
  return size === "detail" ? (
    <div className="mx-auto w-full" style={{ maxWidth: `calc(var(--character-preview-height) * ${ratios[role]})` }}>
      {image}
    </div>
  ) : (
    image
  )
}
