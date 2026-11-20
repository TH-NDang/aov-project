import { useState, type ReactNode } from "react"
import { BadgeCheck, ExternalLink, Flag, Minus, Pencil, Plus, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Switch } from "@aov/ui/components/switch"
import { Textarea } from "@aov/ui/components/textarea"
import { cn } from "@aov/ui/lib/utils"
import { errorMessage } from "@/lib/api/errors"
import { useSourceUrl } from "../files/source-links"
import type { Build } from "./builds-api"
import {
  PANEL,
  confirmBodyOf,
  draftOf,
  missingParts,
  panelImageStyle,
  reviewBodyOf,
  type BuildDraft,
} from "./builds-model"
import { ReferenceIcon, ReferencePicker, referenceName, type BuildReferences } from "./build-references"
import { useReviewBuild } from "./use-builds"
import { BuildEnchantmentSet } from "./build-enchantment-set"

/**
 * One part of the build. The label sits beside the icons when the card is wide and above them when it is not, so the
 * icons always stay on one line instead of falling into a column.
 */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 @min-[40rem]/build:grid-cols-[5rem_minmax(0,1fr)] @min-[40rem]/build:items-center">
      <span className="type-label text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  )
}

/** The game shows the three primary enchantments joined, then the two secondary ones apart. */
function EnchantmentRow({
  ids,
  children,
}: {
  ids: (string | null)[]
  children: (id: string | null, slot: number) => ReactNode
}) {
  return (
    <>
      {ids.slice(0, 3).map((id, index) => (
        <span key={index} className="contents">
          {children(id, index + 1)}
        </span>
      ))}
      <span className="mx-1 h-8 w-px bg-border" aria-hidden="true" />
      {ids.slice(3).map((id, index) => (
        <span key={index + 3} className="contents">
          {children(id, index + 4)}
        </span>
      ))}
    </>
  )
}

function Loadout({ build, references }: { build: Build; references: BuildReferences }) {
  const draft = draftOf(build)
  const spell = references.lookup("spell", build.spellId)
  return (
    <div className="grid gap-3">
      <Row label="Trang bị">
        {draft.items.map((id, index) => (
          <ReferenceIcon key={index} kind="item" id={id} references={references} />
        ))}
      </Row>
      <Row label="Phù hiệu">
        <EnchantmentRow ids={draft.enchantments}>
          {(id) => <ReferenceIcon kind="enchantment" id={id} references={references} round />}
        </EnchantmentRow>
      </Row>
      <Row label="Ngọc">
        {build.arcana.length ? (
          build.arcana.map((entry) => (
            <span key={entry.arcanaId} className="inline-flex items-center gap-1">
              <ReferenceIcon kind="arcana" id={entry.arcanaId} references={references} className="size-8" round />
              <span className="type-meta tabular-nums">×{entry.quantity}</span>
            </span>
          ))
        ) : (
          <span className="type-body text-muted-foreground">Chưa có bảng ngọc</span>
        )}
      </Row>
      <Row label="Phụ trợ">
        <ReferenceIcon kind="spell" id={build.spellId} references={references} round />
        <span className="type-body">{build.spellId ? referenceName(spell) : "Chưa xác định"}</span>
      </Row>
    </div>
  )
}

function Editor({
  build,
  references,
  saving,
  error,
  onCancel,
  onSave,
}: {
  build: Build
  references: BuildReferences
  saving: boolean
  error: string | null
  onCancel: () => void
  onSave: (draft: BuildDraft) => void
}) {
  const [draft, setDraft] = useState(() => draftOf(build))
  const missing = missingParts(draft)
  const set = (change: Partial<BuildDraft>) => setDraft((current) => ({ ...current, ...change }))
  const at = <T,>(list: T[], index: number, value: T) =>
    list.map((entry, position) => (position === index ? value : entry))
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        onSave(draft)
      }}
    >
      <Row label="Trang bị">
        {draft.items.map((id, index) => (
          <ReferencePicker
            key={index}
            kind="item"
            value={id}
            references={references}
            label={`Trang bị ô ${index + 1}`}
            onChange={(value) => set({ items: at(draft.items, index, value) })}
          />
        ))}
      </Row>
      {/* The set is built on the game's set screen, which only offers what the game allows in each slot. */}
      <div className="grid gap-1.5">
        <span className="type-label text-muted-foreground">Phù hiệu</span>
        <BuildEnchantmentSet value={draft.enchantments} onChange={(enchantments) => set({ enchantments })} />
      </div>
      <Row label="Ngọc">
        {draft.arcana.map((entry, index) => (
          <span key={index} className="inline-flex items-center gap-1 rounded-md border px-1">
            <ReferencePicker
              kind="arcana"
              value={entry.arcanaId}
              references={references}
              label={`Ngọc ${index + 1}`}
              round
              filter={references.onArcanaPage}
              onChange={(value) => set({ arcana: at(draft.arcana, index, { ...entry, arcanaId: value }) })}
            />
            <Input
              type="number"
              min={1}
              max={10}
              value={entry.quantity}
              aria-label={`Số lượng ngọc ${index + 1}`}
              className="h-8 w-14"
              onChange={(event) =>
                set({
                  arcana: at(draft.arcana, index, {
                    ...entry,
                    quantity: Math.min(10, Math.max(1, Number(event.target.value) || 1)),
                  }),
                })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Bỏ ngọc ${index + 1}`}
              onClick={() => set({ arcana: draft.arcana.filter((_, position) => position !== index) })}
            >
              <Minus className="size-4" />
            </Button>
          </span>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => set({ arcana: [...draft.arcana, { arcanaId: null, quantity: 10 }] })}
        >
          <Plus className="size-4" /> Thêm ngọc
        </Button>
      </Row>
      <Row label="Phụ trợ">
        <ReferencePicker
          kind="spell"
          value={draft.spellId}
          references={references}
          label="Phụ trợ"
          round
          onChange={(spellId) => set({ spellId })}
        />
      </Row>
      <label className="grid gap-1.5">
        <span className="type-label text-muted-foreground">Ghi chú</span>
        <Textarea value={draft.note} rows={2} onChange={(event) => set({ note: event.target.value })} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 type-body">
          <Switch
            checked={!draft.needsReview}
            disabled={missing.length > 0 && draft.needsReview}
            onCheckedChange={(reviewed) => set({ needsReview: !reviewed })}
          />
          Đã duyệt
        </label>
        {missing.length > 0 && (
          <span className="type-meta text-muted-foreground">Còn thiếu {missing.join(", ")} nên vẫn chờ duyệt.</span>
        )}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="size-4" /> Hủy
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Đang lưu…" : "Lưu bộ"}
          </Button>
        </div>
      </div>
      {error && <p className="type-body text-destructive">{error}</p>}
    </form>
  )
}

/** The part of the screenshot with the build, cropped from the full image, which opens on its own when clicked. */
function Evidence({ imageId, label }: { imageId: string | null; label: string }) {
  const link = useSourceUrl(imageId)
  const [broken, setBroken] = useState(false)
  if (!imageId || !link.url || link.failed || broken)
    return (
      <div
        className="grid place-items-center rounded-md bg-muted type-meta text-muted-foreground"
        style={{ aspectRatio: `${PANEL.width} / ${PANEL.height}` }}
      >
        {!imageId ? "Không có ảnh" : link.failed || broken ? "Không mở được ảnh gốc" : ""}
      </div>
    )
  const url = link.url
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group relative block overflow-hidden rounded-md bg-muted"
      style={{ aspectRatio: `${PANEL.width} / ${PANEL.height}` }}
      aria-label={`Mở ảnh gốc của ${label}`}
    >
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute max-w-none"
        style={panelImageStyle()}
        onError={() => {
          // An expired link is renewed and the picture loads again; a fresh one that fails is a broken picture.
          if (!link.retry()) setBroken(true)
        }}
      />
      <span className="absolute right-1.5 bottom-1.5 inline-flex items-center gap-1 rounded bg-background/85 px-1.5 py-0.5 type-meta opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <ExternalLink className="size-3.5" /> Ảnh gốc
      </span>
    </a>
  )
}

export function BuildCard({
  captureId,
  build,
  sameAs,
  references,
  canWrite,
}: {
  captureId: string
  build: Build
  sameAs: number | undefined
  references: BuildReferences
  canWrite: boolean
}) {
  const review = useReviewBuild(captureId)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const label = `bộ ${build.position}`
  const save = (body: Parameters<typeof review.mutate>[0]["body"], after?: () => void) => {
    setError(null)
    review.mutate(
      { buildId: build.id, body },
      { onSuccess: () => after?.(), onError: (failure) => setError(errorMessage(failure)) },
    )
  }
  // The card lays itself out by its own width, not the window's: beside the hero list it is often narrow even on a
  // large screen. The heading runs across the top; below it the build reads on the left and the screenshot part it
  // came from sits on the right, so the two can be compared at a glance.
  return (
    <article
      className={cn(
        "@container/build grid gap-3 rounded-lg border p-3",
        build.needsReview && "border-[var(--aov-warning)]",
      )}
      aria-label={`Bộ ${build.position}`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="type-section-title">Bộ {build.position}</h3>
        {build.needsReview ? (
          <span className="inline-flex items-center gap-1 type-meta text-[var(--aov-warning)]">
            <Flag className="size-3.5" /> Chờ duyệt
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 type-meta text-[var(--aov-success)]">
            <BadgeCheck className="size-3.5" /> {build.reviewedAt ? "Đã duyệt" : "Đọc chắc từ ảnh"}
          </span>
        )}
        {sameAs !== undefined && <span className="type-meta text-muted-foreground">Giống hệt bộ {sameAs}</span>}
        {!editing && (
          <div className="ml-auto flex gap-2">
            {build.needsReview && missingParts(draftOf(build)).length === 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canWrite || review.isPending}
                onClick={() => save(confirmBodyOf(build))}
              >
                <BadgeCheck className="size-4" /> Xác nhận bộ
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canWrite}
              onClick={() => {
                setError(null)
                setEditing(true)
              }}
            >
              <Pencil className="size-4" /> Sửa
            </Button>
          </div>
        )}
      </header>
      <div className="grid gap-4 @min-[28rem]/build:grid-cols-[minmax(0,1fr)_clamp(11rem,38%,20rem)]">
        <div className="grid min-w-0 content-start gap-3">
          {editing ? (
            <Editor
              key={build.version}
              build={build}
              references={references}
              saving={review.isPending}
              error={error}
              onCancel={() => setEditing(false)}
              onSave={(draft) => save(reviewBodyOf(build, draft), () => setEditing(false))}
            />
          ) : (
            <>
              <Loadout build={build} references={references} />
              {build.note && <p className="type-body text-muted-foreground">{build.note}</p>}
              {error && <p className="type-body text-destructive">{error}</p>}
            </>
          )}
        </div>
        <div className="w-full max-w-xs justify-self-center @min-[28rem]/build:max-w-none">
          <Evidence imageId={build.imageId} label={label} />
        </div>
      </div>
    </article>
  )
}
