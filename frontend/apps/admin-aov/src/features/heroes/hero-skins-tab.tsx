import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@aov/ui/components/input-group"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { ToggleGroup, ToggleGroupItem } from "@aov/ui/components/toggle-group"
import { cn } from "@aov/ui/lib/utils"
import type { Hero, Skin } from "@/lib/api/types"
import { MediaImage } from "@/components/media-image"
import { useSearchParam } from "@/hooks/use-search-param"
import { useBadges } from "@/lib/queries"
import { matchesQuery } from "@/lib/text"
import { useHeroIndex } from "@/lib/use-wiki-index"
import { SkinEditor } from "@/features/skins/skin-editor"

type SkinFilter = "all" | "missing" | "portraitOnly"

export function SkinCard({
  skin,
  badgeIcon,
  active,
  onSelect,
}: {
  skin: Skin
  badgeIcon?: string
  active?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border bg-card text-left transition-shadow outline-none hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50",
        active && "ring-2 ring-primary",
      )}
    >
      <div className="relative bg-muted/40">
        <MediaImage
          path={skin.portrait}
          alt={skin.name}
          className="aspect-[278/436] w-full object-cover"
          fallbackClassName="aspect-[278/436] w-full"
        />
        {badgeIcon && (
          <MediaImage
            path={badgeIcon}
            className="absolute bottom-1.5 left-1/2 h-6 w-auto -translate-x-1/2 drop-shadow"
          />
        )}
        {skin.portraitAlternates.length > 0 && (
          <span className="absolute top-1.5 right-1.5 rounded bg-background/90 px-1 text-[10px] font-medium">
            +{skin.portraitAlternates.length}
          </span>
        )}
        {!skin.head && !skin.cover && !skin.isDefault && (
          <span className="absolute top-1.5 left-1.5 rounded bg-background/90 px-1 text-[10px] font-medium">
            Chỉ portrait
          </span>
        )}
      </div>
      <div className="space-y-0.5 p-2">
        <p className="truncate text-sm font-medium">{skin.name || "Chưa có tên"}</p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">{skin.sourceSkinId}</p>
      </div>
    </button>
  )
}

export function HeroSkinsTab({ hero }: { hero: Hero }) {
  const badges = useBadges()
  const { index } = useHeroIndex()
  const [selectedId, setSelectedId] = useSearchParam("skin")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<SkinFilter>("all")
  const badgeIcons = useMemo(() => new Map((badges.data ?? []).map((badge) => [badge.id, badge.icon])), [badges.data])

  const skins = hero.skins.filter(
    (skin) =>
      matchesQuery(query, skin.name, skin.sourceSkinId, skin.badgeId) &&
      (filter === "all" || (filter === "missing" ? !skin.portrait : !skin.isDefault && !skin.head && !skin.cover)),
  )
  const selected = hero.skins.find((skin) => skin.id === selectedId)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="h-8 w-full sm:w-64">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm trang phục…"
            aria-label="Tìm trang phục"
          />
        </InputGroup>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={filter}
          onValueChange={(value) => value && setFilter(value as SkinFilter)}
        >
          <ToggleGroupItem value="all">Tất cả</ToggleGroupItem>
          <ToggleGroupItem value="missing">Thiếu portrait</ToggleGroupItem>
          <ToggleGroupItem value="portraitOnly">Chỉ portrait</ToggleGroupItem>
        </ToggleGroup>
        <span className="ml-auto text-sm text-muted-foreground">
          {skins.length}/{hero.skins.length} trang phục
        </span>
      </div>

      {skins.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
          {skins.map((skin) => (
            <SkinCard
              key={skin.id}
              skin={skin}
              badgeIcon={skin.badgeId ? badgeIcons.get(skin.badgeId) : undefined}
              active={skin.id === selectedId}
              onSelect={() => setSelectedId(skin.id)}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Không có trang phục phù hợp.
        </p>
      )}

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
          <SheetHeader className="sr-only">
            <SheetTitle>Chỉnh sửa trang phục</SheetTitle>
            <SheetDescription>{selected?.name}</SheetDescription>
          </SheetHeader>
          {selected && (
            <SkinEditor hero={hero} skin={selected} badges={badges.data ?? []} badgeUsage={index?.badgeUsage} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
