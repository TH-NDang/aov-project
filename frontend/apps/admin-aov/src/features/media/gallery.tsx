import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Search, X } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@aov/ui/components/input-group"
import { Skeleton } from "@aov/ui/components/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@aov/ui/components/toggle-group"
import { ImageLightbox } from "@/components/image-lightbox"
import { MediaImage } from "@/components/media-image"
import { Page, PageHeader } from "@/components/page-header"
import { useSearchParam } from "@/hooks/use-search-param"
import { formatNumber, matchesQuery } from "@/lib/text"

export interface GalleryRow {
  key: string
  path: string
  title: string
  note: string
  group: string
  tag?: ReactNode
  meta?: ReactNode
}

interface GalleryProps {
  title: string
  description: string
  rows: GalleryRow[] | undefined
  groups: { value: string; label: string }[]
  searchPlaceholder: string
}

const PAGE = 72

/** Searchable, filterable image grid with a keyboard-navigable lightbox. */
export function Gallery({ title, description, rows, groups, searchPlaceholder }: GalleryProps) {
  const [search, setSearch] = useSearchParam("q")
  const [group, setGroup] = useSearchParam("group", "all")
  const [limit, setLimit] = useState(PAGE)
  const [open, setOpen] = useState<number | null>(null)
  const sentinel = useRef<HTMLDivElement>(null)

  const counts = useMemo(() => {
    const result = new Map<string, number>()
    for (const row of rows ?? []) result.set(row.group, (result.get(row.group) ?? 0) + 1)
    return result
  }, [rows])

  const filtered = useMemo(
    () =>
      (rows ?? []).filter(
        (row) => (group === "all" || row.group === group) && matchesQuery(search, row.title, row.note, row.path),
      ),
    [rows, group, search],
  )

  useEffect(() => setLimit(PAGE), [group, search])
  useEffect(() => {
    const node = sentinel.current
    if (!node) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setLimit((current) => current + PAGE)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [filtered.length, limit])

  return (
    <Page>
      <PageHeader title={title} description={description} />
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="h-8 w-full sm:w-80">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
          {search && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="icon-xs" onClick={() => setSearch(null)} aria-label="Xoá tìm kiếm">
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={1}
          value={group}
          onValueChange={(value) => value && setGroup(value)}
          className="flex-wrap"
        >
          <ToggleGroupItem value="all">
            Tất cả{" "}
            <Badge variant="secondary" className="h-5 px-1.5">
              {formatNumber(rows?.length ?? 0)}
            </Badge>
          </ToggleGroupItem>
          {groups.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value}>
              {option.label}{" "}
              <Badge variant="secondary" className="h-5 px-1.5">
                {formatNumber(counts.get(option.value) ?? 0)}
              </Badge>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <span className="ml-auto text-sm text-muted-foreground" aria-live="polite">
          {formatNumber(filtered.length)} ảnh · hiện {formatNumber(Math.min(limit, filtered.length))}
        </span>
      </div>

      {!rows ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
          {Array.from({ length: 12 }, (_, key) => (
            <Skeleton key={key} className="h-52 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Không có ảnh phù hợp.
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
          {filtered.slice(0, limit).map((row, position) => (
            <button
              key={row.key}
              type="button"
              onClick={() => setOpen(position)}
              className="group flex flex-col overflow-hidden rounded-lg border bg-card text-left transition-shadow outline-none hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <div className="relative flex h-36 items-center justify-center bg-muted/40 p-2">
                <MediaImage
                  path={row.path}
                  alt={row.title}
                  className="max-h-full max-w-full object-contain"
                  fallbackClassName="size-16 rounded-md"
                />
                {row.tag && <div className="absolute top-1.5 right-1.5">{row.tag}</div>}
              </div>
              <div className="space-y-0.5 p-2.5">
                <p className="truncate text-sm font-medium capitalize">{row.title}</p>
                <p className="truncate text-xs text-muted-foreground">{row.note}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {filtered.length > limit && (
        <div ref={sentinel} className="flex justify-center">
          <Button variant="outline" onClick={() => setLimit((current) => current + PAGE)}>
            Xem thêm
          </Button>
        </div>
      )}
      <ImageLightbox
        images={filtered.map((row) => ({ path: row.path, title: row.title, subtitle: row.note, meta: row.meta }))}
        index={open}
        onIndexChange={setOpen}
      />
    </Page>
  )
}
