import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Search } from "lucide-react"
import { AovNavIcon } from "@/app/aov-nav-icon"
import { matchesQuery } from "@/lib/text"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { cn } from "@aov/ui/lib/utils"
import { backendRequest } from "@/app/auth/session"
import { useSession } from "@/app/auth/auth-gate"
import { toast } from "sonner"
import { WarehouseChangeHistory } from "../warehouse/warehouse-change-history"
import { changeDomain, useCatalogChanges } from "../warehouse/catalog-changes"
import { useWarehouseCatalog } from "../warehouse/warehouse-api"
import { warehouseName, type WarehouseKind } from "../warehouse/warehouse-types"
import { PatchAdditionalEditor } from "./patch-additional-notes"
import { useIsWide } from "@/hooks/use-media-query"
import { errorMessage } from "@/lib/api/errors"
import { useReferenceCatalog } from "../terminology/catalog"
import { HeroAsset } from "./hero-asset"
import { PatchChangeEditor, compactControl } from "./patch-change-editor"
import { createPublishingApi } from "./publishing-api"
import type { Revision } from "./types"
import { InfiniteScroll } from "@/components/infinite-scroll"
import { useRevealedRows } from "@aov/ui/hooks/use-revealed-rows"

const api = createPublishingApi(backendRequest)

/** The latest published revision of the ruleset is the snapshot whose keys patch notes refer to. */
export function latestPublished(revisions: Revision[] | undefined, rulesetId: string) {
  return [...(revisions ?? [])]
    .filter((revision) => revision.state === "PUBLISHED" && revision.rulesetId === rulesetId)
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") || b.revisionNo - a.revisionNo)[0]
}

export function useHeroReference(heroId: string, rulesetId: string) {
  const revisions = useQuery({
    queryKey: ["publishing-revisions", heroId],
    queryFn: () => api.revisions(heroId),
    enabled: !!heroId,
    staleTime: 30000,
  })
  const anchor = latestPublished(revisions.data, rulesetId)
  const preview = useQuery({
    queryKey: ["publishing-preview", heroId, anchor?.id ?? ""],
    queryFn: () => api.read(heroId, anchor!.id),
    enabled: !!anchor,
    staleTime: 60000,
  })
  return {
    revision: anchor ?? null,
    content: preview.data?.content ?? null,
    pending: revisions.isPending || (!!anchor && preview.isPending),
    error: revisions.error ?? preview.error,
  }
}

export interface RecordPatchNotesProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variantId: string
  patchLabel: string
  rulesetId: string
  locale: string
  heroId?: string
  defaultSourceUrl?: string
  /** Heroes that already have a change set in this patch. */
  recordedHeroIds?: Set<string>
  onSaved?: (heroId: string) => void
  initialDomain?: PatchNoteDomain
  onDomainSaved?: (domain: PatchNoteDomain) => void
  published?: boolean
}

export const patchNoteDomains = {
  heroes: "Tướng",
  items: "Trang bị",
  enchantments: "Phù hiệu",
  arcana: "Ngọc",
  spells: "Phụ trợ",
  general: "Ghi chú khác",
} as const
export type PatchNoteDomain = keyof typeof patchNoteDomains
export const noteDomainKeys = Object.keys(patchNoteDomains) as PatchNoteDomain[]
export function PatchNoteIcon({ domain }: { domain: PatchNoteDomain }) {
  return <AovNavIcon name={domain === "general" ? "page" : domain} className="size-4" />
}

export function RecordPatchNotesSheet(props: RecordPatchNotesProps) {
  const wide = useIsWide()
  const domain = props.heroId ? "heroes" : (props.initialDomain ?? "heroes")
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={wide ? "w-[min(640px,94vw)] sm:max-w-none" : "max-h-[90dvh] rounded-t-2xl"}
      >
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <PatchNoteIcon domain={domain} />{" "}
            {domain === "general" ? "Ghi chú khác" : `Ghi thay đổi · ${patchNoteDomains[domain]}`}
          </SheetTitle>
          <SheetDescription>
            {props.patchLabel} · {props.locale}
          </SheetDescription>
        </SheetHeader>
        {props.open &&
          (props.heroId ? <RecordPatchNotesBody key={props.heroId} {...props} /> : <PatchNoteComposer {...props} />)}
      </SheetContent>
    </Sheet>
  )
}

function PatchNoteComposer(props: RecordPatchNotesProps) {
  const capabilities = useSession().actor?.capabilities ?? []
  const domain = props.initialDomain ?? "heroes"
  const saved = () => {
    props.onDomainSaved?.(domain)
    toast.success("Đã lưu ghi chú cho patch.")
    props.onOpenChange(false)
  }
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6">
      {domain === "general" ? (
        <PatchAdditionalEditor variantId={props.variantId} locale={props.locale} onSaved={saved} />
      ) : domain === "heroes" ? (
        <RecordPatchNotesBody
          {...props}
          onSaved={(id) => {
            props.onSaved?.(id)
            props.onDomainSaved?.("heroes")
          }}
        />
      ) : !props.published ? (
        <p className="type-meta">Xuất bản patch trước khi xác nhận thay đổi trong kho.</p>
      ) : !capabilities.includes(`${changeDomain[domain].toLowerCase()}:publish`) ? (
        <p className="type-meta">Cần quyền xuất bản của nhóm này để xác nhận thay đổi.</p>
      ) : (
        <WarehouseNoteChoice key={domain} kind={domain} {...props} onRecorded={saved} />
      )}
    </div>
  )
}

function WarehouseNoteChoice({
  kind,
  rulesetId,
  locale,
  variantId,
  defaultSourceUrl,
  onRecorded,
}: RecordPatchNotesProps & { kind: WarehouseKind; onRecorded: () => void }) {
  const catalog = useWarehouseCatalog(kind, rulesetId, locale)
  const changes = useCatalogChanges(kind, rulesetId, locale)
  const [owner, setOwner] = useState("")
  const options = useMemo(() => {
    const entries = new Map(
      (catalog.data ?? []).map((row) => [
        row.id,
        {
          id: row.id,
          name: warehouseName(row, locale),
          code: row.code,
          iconAssetId: row.content.iconAssetId,
        },
      ]),
    )
    return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name, locale))
  }, [catalog.data, locale])
  const recorded = new Set(
    changes.data?.filter((row) => row.patchVariantId === variantId && row.confirmed).map((row) => row.ownerId),
  )
  const single = options.length === 1 && changes.isSuccess && !recorded.has(options[0].id)
  const selected = single ? options[0] : options.find((row) => row.id === owner)
  if (catalog.isPending)
    return (
      <p role="status" className="type-meta">
        Đang tải danh mục…
      </p>
    )
  if (catalog.isError)
    return (
      <p role="alert">
        {errorMessage(catalog.error)}{" "}
        <Button size="sm" variant="ghost" onClick={() => void catalog.refetch()}>
          Thử lại
        </Button>
      </p>
    )
  if (!options.length) return <p className="type-meta">Chưa có hồ sơ trong nhóm này.</p>
  if (!selected) return <NoteEntryPicker domain={kind} entries={options} recorded={recorded} onChoose={setOwner} />
  return (
    <>
      <div className="flex items-center gap-2 border-b pb-3">
        <EntryImage domain={kind} entry={selected} />
        <strong className="type-section-title min-w-0 flex-1 break-words">{selected.name}</strong>
        {!single && (
          <Button variant="ghost" size="sm" onClick={() => setOwner("")}>
            Đổi mục
          </Button>
        )}
      </div>
      <WarehouseChangeHistory
        key={selected.id}
        kind={kind}
        entryId={selected.id}
        rulesetId={rulesetId}
        locale={locale}
        patchContext={{ variantId, sourceUrl: defaultSourceUrl, onSaved: onRecorded }}
      />
    </>
  )
}

function RecordPatchNotesBody({
  onOpenChange,
  variantId,
  rulesetId,
  locale,
  heroId: fixedHeroId,
  defaultSourceUrl,
  recordedHeroIds,
  onSaved,
}: RecordPatchNotesProps) {
  const [chosen, setChosen] = useState(fixedHeroId ?? "")
  const reference = useHeroReference(chosen, rulesetId)
  return (
    <div className={fixedHeroId ? "min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6" : "space-y-4"}>
      {!chosen ? (
        <HeroChoice locale={locale} recorded={recordedHeroIds} onChoose={setChosen} />
      ) : (
        <>
          <ChosenHero
            heroId={chosen}
            locale={locale}
            note={
              reference.revision
                ? `Chọn chỉ số và kỹ năng theo bản #${reference.revision.revisionNo} đã xuất bản.`
                : "Tướng chưa có bản đã xuất bản; ghi mã chỉ số và kỹ năng thủ công."
            }
            onChange={fixedHeroId ? undefined : () => setChosen("")}
          />
          {reference.error ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(reference.error)}
            </p>
          ) : reference.pending ? (
            <p role="status" className="text-sm text-muted-foreground">
              Đang tải dữ liệu tướng…
            </p>
          ) : (
            <PatchChangeEditor
              source="PATCH_NOTES"
              heroId={chosen}
              variantId={variantId}
              locale={locale}
              reference={reference.content}
              defaultSourceUrl={defaultSourceUrl}
              onCancel={() => onOpenChange(false)}
              onSaved={() => {
                onSaved?.(chosen)
                onOpenChange(false)
              }}
            />
          )}
        </>
      )}
    </div>
  )
}

/** Hero names and head images from the reference catalog, one request for every hero. */
export function useHeroEntries(locale: string) {
  const { catalog } = useReferenceCatalog()
  return useMemo(
    () =>
      (catalog.data ?? [])
        .filter((entry) => entry.kind === "hero")
        .map((entry) => ({
          id: entry.heroId ?? entry.id,
          name:
            entry.translations.find((text) => text.locale === locale)?.name ??
            entry.translations.find((text) => text.locale === "vi-VN")?.name ??
            entry.translations[0]?.name ??
            entry.id,
          iconAssetId: entry.iconAssetId ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "vi")),
    [catalog.data, locale],
  )
}

function HeroChoice({
  locale,
  recorded,
  onChoose,
}: {
  locale: string
  recorded?: Set<string>
  onChoose: (heroId: string) => void
}) {
  const heroes = useHeroEntries(locale)
  return <NoteEntryPicker domain="heroes" entries={heroes} recorded={recorded} onChoose={onChoose} />
}

type NoteEntry = { id: string; name: string; iconAssetId?: string | null; code?: string }
function EntryImage({ entry, domain }: { entry: NoteEntry; domain: Exclude<PatchNoteDomain, "general"> }) {
  if (entry.iconAssetId)
    return <HeroAsset id={entry.iconAssetId} alt="" className="size-9 shrink-0 rounded-md" frameAspectRatio={1} />
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground" aria-hidden>
      <PatchNoteIcon domain={domain} />
    </span>
  )
}

function NoteEntryPicker({
  domain,
  entries,
  recorded,
  onChoose,
}: {
  domain: Exclude<PatchNoteDomain, "general">
  entries: NoteEntry[]
  recorded?: Set<string>
  onChoose: (id: string) => void
}) {
  const [query, setQuery] = useState("")
  const matches = entries.filter((entry) => matchesQuery(query, entry.name, entry.code))
  const revealed = useRevealedRows(matches, query, 24)
  const label = patchNoteDomains[domain].toLocaleLowerCase("vi")
  return (
    <div className="space-y-3">
      <label className="relative block">
        <span className="sr-only">Tìm {label}</span>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus
          className={cn(compactControl, "pl-8")}
          placeholder={`Tìm ${label}…`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.nativeEvent.isComposing &&
              matches.length === 1 &&
              !recorded?.has(matches[0].id)
            ) {
              event.preventDefault()
              onChoose(matches[0].id)
            }
          }}
        />
      </label>
      <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3" aria-label={`Chọn ${label}`}>
        {revealed.rows.map((entry) => {
          const taken = recorded?.has(entry.id) ?? false
          return (
            <li key={entry.id}>
              <button
                type="button"
                disabled={taken}
                onClick={() => onChoose(entry.id)}
                className="flex min-h-11 w-full items-center gap-2 rounded-md p-1.5 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <EntryImage domain={domain} entry={entry} />
                <span className="min-w-0">
                  <span className="block break-words">{entry.name}</span>
                  {taken && <span className="block text-xs text-muted-foreground">Đã ghi ở patch này</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <InfiniteScroll query={revealed.loader} label={`Đang tải thêm ${label}`} />
      {!matches.length && <p className="type-meta">Không tìm thấy {label} phù hợp.</p>}
    </div>
  )
}

function ChosenHero({
  heroId,
  locale,
  note,
  onChange,
}: {
  heroId: string
  locale: string
  note: string
  onChange?: () => void
}) {
  const hero = useHeroEntries(locale).find((entry) => entry.id === heroId)
  return (
    <div className="flex items-center gap-2.5 rounded-lg border bg-muted/20 p-2">
      <HeroAsset id={hero?.iconAssetId} alt="" className="size-9 shrink-0 rounded-md" frameAspectRatio={1} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{hero?.name ?? "Tướng"}</p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      {onChange && (
        <Button type="button" size="sm" variant="ghost" onClick={onChange}>
          <ArrowLeft className="size-4" />
          Đổi tướng
        </Button>
      )}
    </div>
  )
}
