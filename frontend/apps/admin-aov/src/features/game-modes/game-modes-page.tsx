import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router"
import { BookOpen, Download, ImageIcon, Plus, Search } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@aov/ui/components/dialog"
import { Input } from "@aov/ui/components/input"
import { useSession } from "@/app/auth/auth-gate"
import { Page, PageHeader } from "@/components/page-header"
import { errorMessage } from "@/lib/api/errors"
import { fetchSourceFile, openSourceCollection } from "../files/source-collection-files"
import { gameModeApi, gameModeKeys, uploadModeImage, type AdminSummary, type ModeGroup } from "./game-mode-api"
import { importedImageSource, modeContentFromManifest, MODES_SOURCE, type ModeManifestEntry } from "./game-mode-import"
import { normalize } from "@/lib/text"
import { NativeSelect } from "@/components/native-select"

const GROUP_LABEL: Record<ModeGroup, string> = { PVP: "PVP", ENTERTAINMENT: "Giải trí" }

type Filter = "all" | "published" | "unpublished" | "draft" | "no-art"

const FILTERS: { key: Filter; label: string; test: (mode: AdminSummary) => boolean }[] = [
  { key: "all", label: "Tất cả", test: () => true },
  { key: "published", label: "Đã xuất bản", test: (mode) => !!mode.published },
  { key: "unpublished", label: "Chưa xuất bản", test: (mode) => !mode.published },
  { key: "draft", label: "Có nháp", test: (mode) => !!mode.draft },
  { key: "no-art", label: "Thiếu ảnh", test: (mode) => !mode.art },
]

/** Every game mode with its draft and publication state; new modes start here. */
export function GameModesPage() {
  const actor = useSession().actor
  const canWrite = actor?.capabilities.includes("gamemode:write") ?? false
  const canPublish = actor?.capabilities.includes("gamemode:publish") ?? false
  const modes = useQuery({ queryKey: gameModeKeys.list, queryFn: ({ signal }) => gameModeApi.list(signal) })
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")
  const visible = useMemo(() => {
    const test = FILTERS.find((item) => item.key === filter)!.test
    const needle = normalize(search.trim())
    return (modes.data ?? []).filter(
      (mode) => test(mode) && (!needle || normalize(`${mode.name} ${mode.code}`).includes(needle)),
    )
  }, [modes.data, filter, search])

  return (
    <Page>
      <PageHeader
        title="Chế độ chơi"
        description="Danh mục chế độ trên Wiki: ảnh, thời lượng, tình trạng mở, luật chơi và cẩm nang chi tiết."
        actions={
          <>
            <Button variant="outline" disabled={!canWrite} onClick={() => setImporting(true)}>
              <Download /> Nhập từ tệp nguồn
            </Button>
            <Button disabled={!canWrite} onClick={() => setCreating(true)}>
              <Plus /> Thêm chế độ
            </Button>
          </>
        }
      />
      {!canWrite && (
        <p className="type-meta">
          Cần quyền gamemode:write để sửa. Realm cũ: chạy backend/wiki-service/scripts/sync-gamemode-roles.ps1 rồi đăng
          nhập lại.
        </p>
      )}
      {modes.isPending ? (
        <p className="type-body text-muted-foreground">Đang tải…</p>
      ) : modes.isError ? (
        <p className="type-body text-destructive">{errorMessage(modes.error)}</p>
      ) : modes.data.length === 0 ? (
        <p className="type-body text-muted-foreground">
          Chưa có chế độ nào. Dùng “Nhập từ tệp nguồn” để tạo 26 chế độ từ ảnh sảnh đã thu thập.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-56 flex-1 basis-64 sm:max-w-80">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Tìm tên hoặc mã…"
                aria-label="Tìm chế độ"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Lọc theo trạng thái">
              {FILTERS.map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  size="sm"
                  variant={filter === item.key ? "secondary" : "ghost"}
                  aria-pressed={filter === item.key}
                  onClick={() => setFilter(item.key)}
                >
                  {item.label}
                  <span className="type-meta">{modes.data.filter(item.test).length}</span>
                </Button>
              ))}
            </div>
          </div>
          {visible.length === 0 && <p className="type-body text-muted-foreground">Không có chế độ nào khớp bộ lọc.</p>}
          {(["PVP", "ENTERTAINMENT", null] as const).map((group) => {
            const rows = visible.filter((mode) => mode.group === group)
            if (!rows.length) return null
            return (
              <section key={group ?? "none"} className="grid gap-2">
                <h2 className="type-section-title">
                  {group ? GROUP_LABEL[group] : "Chưa chọn nhóm"} <span className="type-meta">{rows.length}</span>
                </h2>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {rows.map((mode) => (
                    <ModeRow key={mode.id} mode={mode} />
                  ))}
                </div>
              </section>
            )
          })}
        </>
      )}
      <CreateModeDialog open={creating} onOpenChange={setCreating} />
      <ImportModesDialog
        open={importing}
        onOpenChange={setImporting}
        existing={new Set(modes.data?.map((mode) => mode.code))}
        canPublish={canPublish}
      />
    </Page>
  )
}

/** The single state an editor acts on: what readers see now, and whether a draft is waiting. */
function modeState(mode: AdminSummary): { label: string; tone: "live" | "draft" | "none" } {
  if (mode.published && mode.draft) return { label: "Đã xuất bản · có nháp mới", tone: "draft" }
  if (mode.published) return { label: "Đã xuất bản", tone: "live" }
  if (mode.draft) return { label: "Nháp, chưa xuất bản", tone: "draft" }
  return { label: "Chưa có nội dung", tone: "none" }
}

const TONE_CLASS = {
  live: "bg-(--aov-success-soft) text-(--aov-success)",
  draft: "bg-(--aov-warning-soft) text-(--aov-warning)",
  none: "bg-muted text-muted-foreground",
} as const

function ModeRow({ mode }: { mode: AdminSummary }) {
  const state = modeState(mode)
  return (
    <Link
      to={`/game-modes/${mode.id}`}
      className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-3 rounded-lg border bg-card p-2 transition-colors hover:border-primary"
    >
      <span className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-md bg-muted">
        {mode.art ? (
          <img src={mode.art.url} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <span className="type-meta flex flex-col items-center gap-1 text-(--aov-warning)">
            <ImageIcon className="size-5" aria-hidden="true" />
            Thiếu ảnh
          </span>
        )}
      </span>
      <span className="grid min-w-0 gap-1">
        <strong className="type-body truncate">{mode.name}</strong>
        <span className="type-meta truncate">
          {mode.code}
          {mode.order != null && ` · thứ tự ${mode.order}`}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={`type-meta rounded-full px-2 py-0.5 ${TONE_CLASS[state.tone]}`}>{state.label}</span>
          {mode.guideKind === "AUTO_CHESS" && (
            <span className="type-meta inline-flex items-center gap-1 text-muted-foreground">
              <BookOpen className="size-3.5" aria-hidden="true" />
              {mode.guide?.published ? "Cẩm nang đã xuất bản" : "Cẩm nang nháp"}
            </span>
          )}
        </span>
      </span>
    </Link>
  )
}

function CreateModeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const client = useQueryClient()
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [group, setGroup] = useState<ModeGroup>("ENTERTAINMENT")
  const create = useMutation({
    mutationFn: () => gameModeApi.create({ code: code.trim(), name: name.trim(), group }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: gameModeKeys.all })
      onOpenChange(false)
      setCode("")
      setName("")
    },
    meta: { silent: true },
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm chế độ</DialogTitle>
        </DialogHeader>
        <form
          id="create-mode"
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            create.mutate()
          }}
        >
          <label className="grid gap-1">
            <span className="type-label">Tên</span>
            <Input value={name} required maxLength={120} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="type-label">Mã (slug)</span>
            <Input
              value={code}
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder="vi-du-che-do"
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <label className="grid gap-1">
            <span className="type-label">Nhóm</span>
            <NativeSelect value={group} onChange={(event) => setGroup(event.target.value as ModeGroup)}>
              <option value="PVP">PVP</option>
              <option value="ENTERTAINMENT">Chế độ giải trí</option>
            </NativeSelect>
          </label>
          {create.isError && <p className="type-body text-destructive">{errorMessage(create.error)}</p>}
        </form>
        <DialogFooter>
          <Button type="submit" form="create-mode" disabled={create.isPending}>
            Tạo bản nháp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Creates the modes of the lobby manifest that do not exist yet, uploading their cleaned art. The manifest and the art
 * come from the `sanh-che-do` source collection through presigned links (ADR-030), so a built Admin can run it too.
 */
function ImportModesDialog({
  open,
  onOpenChange,
  existing,
  canPublish,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  existing: Set<string>
  canPublish: boolean
}) {
  const client = useQueryClient()
  const [publish, setPublish] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const run = useMutation({
    mutationFn: async () => {
      const source = await openSourceCollection(MODES_SOURCE.collection)
      const { modes } = await source.json<{ modes: ModeManifestEntry[] }>(MODES_SOURCE.manifest)
      const say = (line: string) => setLog((current) => [...current, line])
      // Links last ten minutes, which covers the art of every new mode in one run.
      const arts = await source.links(
        modes.flatMap((entry) => (!existing.has(entry.code) && entry.art ? [entry.art] : [])),
      )
      for (const entry of modes) {
        if (existing.has(entry.code)) {
          say(`Bỏ qua ${entry.name}: đã có.`)
          continue
        }
        let artAssetId: string | null = null
        const artSource = importedImageSource(entry.artSource)
        if (entry.art && !artSource) say(`${entry.name}: ảnh chưa có nguồn trong che-do.json, chưa tải.`)
        else if (entry.art && artSource) {
          const link = arts.get(entry.art)
          const image = link ? await fetchSourceFile(link) : null
          if (image?.ok) {
            const blob = await image.blob()
            artAssetId = await uploadModeImage(
              new File([blob], `${entry.code}.png`, { type: blob.type || "image/png" }),
              "GAME_MODE_ART",
              artSource,
            )
          } else say(`${entry.name}: bộ tệp nguồn ${MODES_SOURCE.collection} chưa có ảnh ${entry.art}, chưa tải.`)
        }
        const created = await gameModeApi.create({
          code: entry.code,
          name: entry.name,
          group: entry.group,
          content: modeContentFromManifest(entry, artAssetId),
        })
        if (publish && canPublish) {
          await gameModeApi.publish(
            created.id,
            created.revision.id,
            created.revision.version,
            "Nhập từ ảnh sảnh 08/11/2026",
          )
          say(`Đã tạo và xuất bản ${entry.name}.`)
        } else say(`Đã tạo nháp ${entry.name}.`)
      }
    },
    onSettled: () => void client.invalidateQueries({ queryKey: gameModeKeys.all }),
    meta: { silent: true },
  })
  return (
    <Dialog open={open} onOpenChange={(next) => !run.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nhập chế độ từ tệp nguồn</DialogTitle>
        </DialogHeader>
        <p className="type-body">
          Đọc che-do.json của bộ tệp nguồn sanh-che-do (26 chế độ từ ảnh sảnh), tải ảnh đã gỡ giao diện vào kho ảnh với
          ghi công Garena / Liên Quân Mobile và nguồn riêng của từng ảnh (ảnh sảnh gốc, bước xử lý), rồi tạo bản nháp
          cho chế độ chưa có. Chế độ đã có được giữ nguyên.
        </p>
        {canPublish && (
          <label className="type-body flex items-center gap-2">
            <input type="checkbox" checked={publish} onChange={(event) => setPublish(event.target.checked)} />
            Xuất bản luôn sau khi tạo
          </label>
        )}
        {log.length > 0 && (
          <ul className="type-meta grid max-h-60 gap-0.5 overflow-y-auto rounded-md border p-2">
            {log.map((line, at) => (
              <li key={at}>{line}</li>
            ))}
          </ul>
        )}
        {run.isError && <p className="type-body text-destructive">{errorMessage(run.error)}</p>}
        <DialogFooter>
          <Button disabled={run.isPending} onClick={() => run.mutate()}>
            {run.isPending ? "Đang nhập…" : run.isSuccess ? "Nhập lại phần còn thiếu" : "Bắt đầu nhập"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
