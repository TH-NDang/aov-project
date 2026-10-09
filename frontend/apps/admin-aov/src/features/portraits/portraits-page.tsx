import { useEffect, useMemo, useRef, useState } from "react"
import { Search, X } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@aov/ui/components/alert-dialog"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@aov/ui/components/input-group"
import { Skeleton } from "@aov/ui/components/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@aov/ui/components/toggle-group"
import { cn } from "@aov/ui/lib/utils"
import type { Hero, PortraitOwner, PortraitSource, Skin } from "@/lib/api/types"
import { HeroPicker } from "@/components/hero-picker"
import { MasterDetail } from "@/components/master-detail"
import { MediaImage } from "@/components/media-image"
import { PageHeader } from "@/components/page-header"
import { useSearchParam } from "@/hooks/use-search-param"
import {
  matchesPortraitFilter,
  nameFromFigma,
  ownerLabel,
  PORTRAIT_FILTER_LABEL,
  type PortraitFilter,
} from "@/lib/domain/portraits"
import { usePortraits } from "@/lib/queries"
import { formatNumber, matchesQuery } from "@/lib/text"
import { useHeroIndex } from "@/lib/use-wiki-index"
import { PortraitAssignPanel } from "./portrait-assign-panel"

const PAGE = 60
const FILTERS = Object.keys(PORTRAIT_FILTER_LABEL) as PortraitFilter[]

export interface PortraitRow {
  source: PortraitSource
  owner: PortraitOwner | undefined
  hero: Hero | undefined
  skin: Skin | undefined
  title: string
  ownerText: string
}

export function PortraitsPage() {
  const { index } = useHeroIndex()
  const portraits = usePortraits()
  const [tab, setTab] = useSearchParam("tab", "all")
  const [search, setSearch] = useSearchParam("q")
  const [heroFilter, setHeroFilter] = useSearchParam("hero")
  const [selectedFile, setSelectedFile] = useSearchParam("image")
  const [limit, setLimit] = useState(PAGE)
  const [dirty, setDirty] = useState(false)
  const [pendingFile, setPendingFile] = useState<string | null | undefined>(undefined)
  const sentinel = useRef<HTMLDivElement>(null)
  const filter = (FILTERS.includes(tab as PortraitFilter) ? tab : "all") as PortraitFilter

  const rows = useMemo<PortraitRow[] | undefined>(() => {
    if (!index || !portraits.data) return undefined
    return portraits.data.map((source) => {
      const owner = index.owners.get(source.file)
      const hero = owner ? index.heroById.get(owner.heroId) : index.heroByName.get(source.hero)
      const skin = owner?.skinId ? hero?.skins.find((candidate) => candidate.id === owner.skinId) : undefined
      return {
        source,
        owner,
        hero,
        skin,
        title: owner
          ? skin
            ? skin.name || "Chưa có tên"
            : (hero?.name ?? source.hero)
          : nameFromFigma(source.figmaName),
        ownerText: ownerLabel(index.heroes, owner),
      }
    })
  }, [index, portraits.data])

  const counts = useMemo(() => {
    const result = Object.fromEntries(FILTERS.map((key) => [key, 0])) as Record<PortraitFilter, number>
    for (const row of rows ?? [])
      for (const key of FILTERS) if (matchesPortraitFilter(key, row.owner, row.skin)) result[key]++
    return result
  }, [rows])

  const filtered = useMemo(
    () =>
      (rows ?? []).filter(
        (row) =>
          matchesPortraitFilter(filter, row.owner, row.skin) &&
          (!heroFilter || row.hero?.id === heroFilter) &&
          matchesQuery(search, row.title, row.ownerText, row.source.figmaName, row.source.file),
      ),
    [rows, filter, heroFilter, search],
  )

  useEffect(() => setLimit(PAGE), [filter, heroFilter, search])

  useEffect(() => {
    const node = sentinel.current
    if (!node) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setLimit((current) => current + PAGE)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [filtered.length, limit])

  const selected = rows?.find((row) => row.source.file === selectedFile)

  const select = (file: string | null) => {
    if (dirty && file !== selectedFile) {
      setPendingFile(file)
      return
    }
    setSelectedFile(file)
  }

  const nextAfter = (file: string) => {
    const position = filtered.findIndex((row) => row.source.file === file)
    return filtered[position + 1]?.source.file ?? filtered[position - 1]?.source.file ?? null
  }

  return (
    <>
      <MasterDetail
        detail={
          selected && index ? (
            <PortraitAssignPanel
              key={`${selected.source.file}:${selected.owner?.heroId}:${selected.owner?.skinId}:${selected.owner?.role}`}
              row={selected}
              index={index}
              onDirtyChange={setDirty}
              onSaved={(next) => {
                setDirty(false)
                setSelectedFile(next ? nextAfter(selected.source.file) : selected.source.file)
              }}
            />
          ) : null
        }
        detailTitle="Chuyển ảnh"
        onCloseDetail={() => select(null)}
      >
        <div className="flex flex-col gap-4 p-4 md:p-6">
          <PageHeader
            title="Portrait"
            description="Chọn ảnh → chọn nơi nhận → kiểm tra tên → lưu. Có thể thêm trang phục mới chỉ có portrait."
          />
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={filter}
            onValueChange={(value) => value && setTab(value)}
            spacing={1}
            aria-label="Nhóm ảnh"
            className="flex-wrap justify-start"
          >
            {FILTERS.map((key) => (
              <ToggleGroupItem key={key} value={key} className="flex-none">
                {PORTRAIT_FILTER_LABEL[key]}
                <Badge
                  variant={key === "unmatched" && counts.unmatched > 0 ? "destructive" : "secondary"}
                  className="h-5 px-1.5 tabular-nums"
                >
                  {rows ? formatNumber(counts[key]) : "…"}
                </Badge>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="flex flex-wrap items-center gap-2">
            <InputGroup className="h-8 w-full sm:w-80">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tên tướng, trang phục, tên Figma, file…"
                aria-label="Tìm ảnh"
              />
              {search && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton size="icon-xs" onClick={() => setSearch(null)} aria-label="Xoá tìm kiếm">
                    <X />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
            <HeroPicker
              heroes={index?.heroes ?? []}
              value={heroFilter || null}
              onChange={(heroId) => setHeroFilter(heroId)}
              placeholder="Tất cả tướng"
              allowClear
              size="sm"
              className="w-full sm:w-56"
            />
            <span className="ml-auto text-sm text-muted-foreground" aria-live="polite">
              {formatNumber(filtered.length)} ảnh · hiện {formatNumber(Math.min(limit, filtered.length))}
            </span>
          </div>

          {!rows ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
              {Array.from({ length: 18 }, (_, key) => (
                <Skeleton key={key} className="aspect-[278/500] w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              Không có ảnh phù hợp với bộ lọc hiện tại.
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
              {filtered.slice(0, limit).map((row) => (
                <PortraitCard
                  key={row.source.file}
                  row={row}
                  active={row.source.file === selectedFile}
                  onSelect={() => select(row.source.file)}
                />
              ))}
            </div>
          )}
          {filtered.length > limit && (
            <div ref={sentinel} className="flex justify-center py-2">
              <Button variant="outline" onClick={() => setLimit((current) => current + PAGE)}>
                Xem thêm ảnh
              </Button>
            </div>
          )}
        </div>
      </MasterDetail>

      <AlertDialog open={pendingFile !== undefined} onOpenChange={(open) => !open && setPendingFile(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bỏ thay đổi chưa lưu?</AlertDialogTitle>
            <AlertDialogDescription>
              Ảnh đang chọn có thay đổi chưa lưu. Chuyển sang ảnh khác sẽ bỏ các thay đổi này.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ở lại</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDirty(false)
                setSelectedFile(pendingFile ?? null)
                setPendingFile(undefined)
              }}
            >
              Bỏ thay đổi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function PortraitCard({ row, active, onSelect }: { row: PortraitRow; active: boolean; onSelect: () => void }) {
  const state = !row.owner ? "Chưa khớp" : row.owner.role === "primary" ? "Ảnh chính" : "Bản khác"
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border bg-card text-left transition-shadow outline-none hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50",
        active && "ring-2 ring-primary",
      )}
    >
      <div className="relative bg-muted/40">
        <MediaImage
          path={row.source.file}
          alt={row.title}
          className="aspect-[278/436] w-full object-cover"
          fallbackClassName="aspect-[278/436] w-full"
        />
        <Badge
          variant={!row.owner ? "destructive" : row.owner.role === "primary" ? "secondary" : "outline"}
          className={cn("absolute top-1.5 left-1.5", row.owner?.role === "alternate" && "bg-background/90")}
        >
          {state}
        </Badge>
        {row.skin && !row.skin.head && !row.skin.cover && (
          <Badge variant="outline" className="absolute right-1.5 bottom-1.5 bg-background/90">
            Chỉ portrait
          </Badge>
        )}
      </div>
      <div className="space-y-0.5 p-2">
        <p className="truncate text-sm font-medium">{row.title}</p>
        <p className="truncate text-xs text-muted-foreground">Đang ở: {row.ownerText}</p>
        <p className="truncate text-[11px] text-muted-foreground/80">{row.source.figmaName}</p>
      </div>
    </button>
  )
}
