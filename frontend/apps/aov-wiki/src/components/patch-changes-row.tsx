import { Link } from "react-router"
import { changeKindIcon, changeKindIcons } from "@aov/ui/components/change-kind-icons"
import { useWikiContext, wikiText } from "../context/wiki-context"
import { WikiImage } from "./wiki-image"

export type ChangedSubject = {
  id: string
  name: string
  kind?: string
  image?: string
  href?: string
  open?: (button: HTMLButtonElement) => void
}
const labels: Record<string, [string, string]> = {
  ADDED: ["Mới", "New"],
  REMOVED: ["Đã gỡ", "Removed"],
  BUFF: ["Tăng sức mạnh", "Buff"],
  NERF: ["Giảm sức mạnh", "Nerf"],
  REWORK: ["Làm lại", "Rework"],
  FIX: ["Sửa lỗi", "Fix"],
  ADJUSTMENT: ["Điều chỉnh", "Adjustment"],
  BALANCE: ["Cân bằng", "Balance"],
  UPDATED: ["Cập nhật", "Updated"],
}

export function patchChangeLabel(kind: string, locale: string) {
  return wikiText(locale, ...(labels[kind] ?? labels.UPDATED))
}
/** A change kind as readers see it: its drawn mark and its name. */
export function ChangeKindLabel({ kind, size = 18 }: { kind: string; size?: number }) {
  const { locale } = useWikiContext()
  const Art = changeKindIcon(kind) ?? changeKindIcons.UPDATED
  return (
    <span className="inline-flex items-center gap-1">
      <Art size={size} className="shrink-0" />
      {patchChangeLabel(kind, locale)}
    </span>
  )
}

export function PatchChangesRow({
  entries,
  failed = false,
  retry,
}: {
  entries: ChangedSubject[]
  failed?: boolean
  retry?: () => void
}) {
  const { locale, patchVariantId, seasonId, options, href } = useWikiContext()
  if (!entries.length && !failed) return null
  const notes = options?.patches.find((patch) => (patchVariantId ? patch.id === patchVariantId : patch.isCurrent))?.code
  const title =
    seasonId && !patchVariantId
      ? wikiText(locale, "Thay đổi trong mùa", "Changed this season")
      : wikiText(locale, "Thay đổi tại patch", "Changed this patch")
  return (
    <section className="mb-4 min-w-0" aria-label={title}>
      <h2 className="mb-2 flex items-center gap-2 type-section-title">
        {title}
        {entries.length > 0 && <span className="type-meta">{entries.length}</span>}
        {notes && (
          <Link to={href(`/updates/${notes}`)} className="ml-auto type-meta font-normal text-primary hover:underline">
            {wikiText(locale, "Xem ghi chú đầy đủ", "See full notes")}
          </Link>
        )}
      </h2>
      {entries.length > 0 && (
        <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden sm:[scrollbar-width:thin]">
          {entries.map((e) => {
            const label = (
              <>
                {e.image && (
                  <span className="size-7 shrink-0 rounded-md">
                    <WikiImage src={e.image} alt="" />
                  </span>
                )}
                {e.name}
                {e.kind && (
                  <span className="type-meta">
                    <ChangeKindLabel kind={e.kind} />
                  </span>
                )}
              </>
            )
            const style =
              "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-[color-mix(in_srgb,var(--aov-wiki-gold)_22%,transparent)] bg-[var(--aov-wiki-panel)] px-2 py-1.5 text-sm hover:border-primary focus-visible:ring-2"
            return e.href ? (
              <Link key={e.id} to={e.href} className={style}>
                {label}
              </Link>
            ) : !e.open ? (
              <span
                key={e.id}
                className="inline-flex shrink-0 items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
              >
                {label}
              </span>
            ) : (
              <button key={e.id} type="button" className={style} onClick={(event) => e.open?.(event.currentTarget)}>
                {label}
              </button>
            )
          })}
        </div>
      )}
      {failed && (
        <p role="status" className="type-meta">
          {wikiText(locale, "Chưa tải được hết ghi nhận thay đổi.", "Some patch changes could not be loaded.")}{" "}
          <button type="button" className="underline" onClick={retry}>
            {wikiText(locale, "Thử lại", "Retry")}
          </button>
        </p>
      )}
    </section>
  )
}
