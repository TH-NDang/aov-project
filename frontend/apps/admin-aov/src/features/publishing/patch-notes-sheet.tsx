import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Search } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { cn } from "@aov/ui/lib/utils"
import { backendRequest } from "@/app/auth/session"
import { useIsWide } from "@/hooks/use-media-query"
import { errorMessage } from "@/lib/api/errors"
import { useReferenceCatalog } from "../terminology/catalog"
import { HeroAsset } from "./hero-asset"
import { PatchChangeEditor, compactControl } from "./patch-change-editor"
import { createPublishingApi } from "./publishing-api"
import type { Revision } from "./types"

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
}

export function RecordPatchNotesSheet(props: RecordPatchNotesProps) {
  const wide = useIsWide()
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={wide ? "w-[640px] sm:max-w-[640px]" : "max-h-[90dvh] rounded-t-2xl"}
      >
        <SheetHeader className="border-b">
          <SheetTitle>Ghi thay đổi từ ghi chú cập nhật</SheetTitle>
          <SheetDescription>
            {props.patchLabel} · Ghi lại đúng các con số trong ghi chú chính thức. Không cần dữ liệu của patch này.
          </SheetDescription>
        </SheetHeader>
        {props.open && <RecordPatchNotesBody key={props.heroId ?? ""} {...props} />}
      </SheetContent>
    </Sheet>
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
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6">
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
  const [query, setQuery] = useState("")
  const needle = query.trim().toLocaleLowerCase("vi")
  const matches = heroes.filter((hero) => !needle || hero.name.toLocaleLowerCase("vi").includes(needle))
  return (
    <div className="space-y-3">
      <label className="relative block">
        <span className="sr-only">Tìm tướng</span>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus
          className={cn(compactControl, "pl-8")}
          placeholder="Tìm tướng trong ghi chú cập nhật…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" aria-label="Chọn tướng">
        {matches.slice(0, 60).map((hero) => {
          const taken = recorded?.has(hero.id) ?? false
          return (
            <li key={hero.id}>
              <button
                type="button"
                disabled={taken}
                onClick={() => onChoose(hero.id)}
                className="flex w-full items-center gap-2 rounded-lg border p-1.5 text-left text-sm hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <HeroAsset id={hero.iconAssetId} alt="" className="size-8 shrink-0 rounded-md" frameAspectRatio={1} />
                <span className="min-w-0">
                  <span className="block truncate">{hero.name}</span>
                  {taken && <span className="block text-[11px] text-muted-foreground">Đã ghi ở patch này</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {!matches.length && <p className="text-sm text-muted-foreground">Không tìm thấy tướng phù hợp.</p>}
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
