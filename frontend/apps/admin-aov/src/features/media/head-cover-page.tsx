import { useMemo } from "react"
import { useHeroes } from "@/lib/queries"
import { Gallery, type GalleryRow } from "./gallery"

const GROUPS = [
  { value: "hero-head", label: "Head tướng" },
  { value: "hero-cover", label: "Cover tướng" },
  { value: "skin-head", label: "Head trang phục" },
  { value: "skin-cover", label: "Cover trang phục" },
  { value: "list-head", label: "Icon danh sách" },
]

export function HeadCoverPage() {
  const heroes = useHeroes()
  const rows = useMemo<GalleryRow[] | undefined>(() => {
    if (!heroes.data) return undefined
    const result: GalleryRow[] = []
    for (const hero of heroes.data) {
      if (hero.head)
        result.push({
          key: `${hero.id}:head`,
          path: hero.head,
          title: hero.name,
          note: "Head tướng",
          group: "hero-head",
        })
      if (hero.cover)
        result.push({
          key: `${hero.id}:cover`,
          path: hero.cover,
          title: hero.name,
          note: "Cover tướng",
          group: "hero-cover",
        })
      if (hero.listHead)
        result.push({
          key: `${hero.id}:list`,
          path: hero.listHead,
          title: hero.name,
          note: "Icon danh sách tướng",
          group: "list-head",
        })
      for (const skin of hero.skins) {
        if (skin.isDefault) continue
        const title = `${hero.name} / ${skin.name || "Chưa có tên"}`
        if (skin.head)
          result.push({ key: `${skin.id}:head`, path: skin.head, title, note: "Head trang phục", group: "skin-head" })
        if (skin.cover)
          result.push({
            key: `${skin.id}:cover`,
            path: skin.cover,
            title,
            note: "Cover trang phục",
            group: "skin-cover",
          })
      }
    }
    return result
  }, [heroes.data])

  return (
    <Gallery
      title="Head & cover"
      description="Ảnh head, cover của tướng và trang phục, cùng icon danh sách tướng. Bấm ảnh để xem lớn."
      rows={rows}
      groups={GROUPS}
      searchPlaceholder="Tìm tướng, trang phục, file…"
    />
  )
}
