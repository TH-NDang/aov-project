import { useState } from "react"
import { Badge } from "@aov/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aov/ui/components/card"
import type { Hero } from "@/lib/api/types"
import { CopyButton } from "@/components/copy-button"
import { ImageLightbox, type LightboxImage } from "@/components/image-lightbox"
import { MediaImage } from "@/components/media-image"

interface MediaSlot {
  role: string
  label: string
  description: string
  path: string | null
  aspect: string
}

export function HeroMediaTab({ hero }: { hero: Hero }) {
  const [lightbox, setLightbox] = useState<number | null>(null)
  const slots: MediaSlot[] = [
    { role: "HEAD", label: "Head", description: "Ảnh nhỏ / icon", path: hero.head, aspect: "aspect-square" },
    {
      role: "HEAD",
      label: "Icon danh sách",
      description: "Dùng ở danh sách tướng",
      path: hero.listHead,
      aspect: "aspect-square",
    },
    {
      role: "PORTRAIT",
      label: "Portrait",
      description: "Ảnh chính cho thẻ chọn tướng",
      path: hero.portrait,
      aspect: "aspect-[278/436]",
    },
    { role: "SPLASH", label: "Cover", description: "Ảnh lớn có bối cảnh", path: hero.cover, aspect: "aspect-video" },
    ...hero.portraitAlternates.map((path, index) => ({
      role: "PORTRAIT",
      label: `Portrait bản khác ${index + 1}`,
      description: "Bản trước đó, giữ để đối chiếu",
      path,
      aspect: "aspect-[278/436]",
    })),
  ]
  const images: LightboxImage[] = slots
    .filter((slot) => slot.path)
    .map((slot) => ({
      path: slot.path!,
      title: `${hero.name} · ${slot.label}`,
      subtitle: `${slot.role} · ${slot.description}`,
    }))

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
      {slots.map((slot) => (
        <Card key={slot.label} className="gap-3 overflow-hidden py-0">
          <button
            type="button"
            disabled={!slot.path}
            onClick={() => setLightbox(images.findIndex((image) => image.path === slot.path))}
            className="flex h-56 items-center justify-center bg-muted/40 p-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <MediaImage
              path={slot.path}
              alt={slot.label}
              className={`max-h-full max-w-full rounded-md object-contain ${slot.aspect}`}
              fallbackClassName="size-24 rounded-md"
            />
          </button>
          <CardHeader className="px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              {slot.label}{" "}
              <Badge variant="outline" className="font-mono text-[10px]">
                {slot.role}
              </Badge>
            </CardTitle>
            <CardDescription>{slot.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-1 px-4 pb-4 text-xs">
            {slot.path ? (
              <>
                <code className="min-w-0 flex-1 truncate font-mono text-muted-foreground">{slot.path}</code>
                <CopyButton value={slot.path} label="Sao chép đường dẫn" />
              </>
            ) : (
              <span className="text-muted-foreground">Chưa có ảnh</span>
            )}
          </CardContent>
        </Card>
      ))}
      <ImageLightbox images={images} index={lightbox} onIndexChange={setLightbox} />
    </div>
  )
}
