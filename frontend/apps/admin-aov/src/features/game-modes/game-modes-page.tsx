import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router"
import { Download, ImageIcon, Plus } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@aov/ui/components/dialog"
import { Input } from "@aov/ui/components/input"
import { useSession } from "@/app/auth/auth-gate"
import { Page, PageHeader } from "@/components/page-header"
import { errorMessage } from "@/lib/api/errors"
import { RESOURCES_BASE } from "@/lib/media"
import { gameModeApi, gameModeKeys, uploadModeImage, type AdminSummary, type ModeGroup } from "./game-mode-api"
import { modeContentFromManifest, MODES_MANIFEST, type ModeManifestEntry } from "./game-mode-import"

const GROUP_LABEL: Record<ModeGroup, string> = { PVP: "PVP", ENTERTAINMENT: "Giải trí" }

/** Every game mode with its draft and publication state; new modes start here. */
export function GameModesPage() {
  const actor = useSession().actor
  const canWrite = actor?.capabilities.includes("gamemode:write") ?? false
  const canPublish = actor?.capabilities.includes("gamemode:publish") ?? false
  const modes = useQuery({ queryKey: gameModeKeys.list, queryFn: ({ signal }) => gameModeApi.list(signal) })
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)

  return (
    <Page>
      <PageHeader
        title="Chế độ chơi"
        description="Danh mục chế độ trên Wiki: ảnh, thời lượng, tình trạng mở, luật chơi và cẩm nang chi tiết."
        actions={
          <>
            <Button variant="outline" disabled={!canWrite} onClick={() => setImporting(true)}>
              <Download /> Nhập từ resources
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
          Chưa có chế độ nào. Dùng “Nhập từ resources” để tạo 26 chế độ từ ảnh sảnh đã thu thập.
        </p>
      ) : (
        (["PVP", "ENTERTAINMENT", null] as const).map((group) => {
          const rows = modes.data.filter((mode) => mode.group === group)
          if (!rows.length) return null
          return (
            <section key={group ?? "none"} className="grid gap-2">
              <h2 className="type-section-title">{group ? GROUP_LABEL[group] : "Chưa chọn nhóm"}</h2>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((mode) => (
                  <ModeRow key={mode.id} mode={mode} />
                ))}
              </div>
            </section>
          )
        })
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

function ModeRow({ mode }: { mode: AdminSummary }) {
  return (
    <Link
      to={`/game-modes/${mode.id}`}
      className="flex items-center gap-3 rounded-lg border bg-card p-2 transition-colors hover:border-primary"
    >
      <span className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {mode.art ? (
          <img src={mode.art.url} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <ImageIcon className="size-5 text-muted-foreground" aria-label="Chưa có ảnh" />
        )}
      </span>
      <span className="grid min-w-0 gap-1">
        <strong className="truncate">{mode.name}</strong>
        <span className="type-meta truncate">
          {mode.code}
          {mode.order != null && ` · thứ tự ${mode.order}`}
        </span>
        <span className="flex flex-wrap gap-1">
          {mode.published ? (
            <Badge variant="secondary">Đã xuất bản</Badge>
          ) : (
            <Badge variant="outline">Chưa xuất bản</Badge>
          )}
          {mode.draft && <Badge>Có nháp</Badge>}
          {mode.guideKind === "AUTO_CHESS" && (
            <Badge variant="outline">{mode.guide?.published ? "Cẩm nang đã xuất bản" : "Cẩm nang chưa xuất bản"}</Badge>
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
            <select
              className="h-9 rounded-md border bg-transparent px-3"
              value={group}
              onChange={(event) => setGroup(event.target.value as ModeGroup)}
            >
              <option value="PVP">PVP</option>
              <option value="ENTERTAINMENT">Chế độ giải trí</option>
            </select>
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
 * Creates the modes of the lobby manifest that do not exist yet, uploading their cleaned art. Only works while the
 * dev server serves `resources/` under /__resources/.
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
      const response = await fetch(`${RESOURCES_BASE}${MODES_MANIFEST}`)
      if (!response.ok) throw new Error("Không đọc được che-do.json. Chạy Admin bằng pnpm dev để có /__resources/.")
      const { modes } = (await response.json()) as { modes: ModeManifestEntry[] }
      const say = (line: string) => setLog((current) => [...current, line])
      for (const entry of modes) {
        if (existing.has(entry.code)) {
          say(`Bỏ qua ${entry.name}: đã có.`)
          continue
        }
        let artAssetId: string | null = null
        if (entry.art) {
          const image = await fetch(`${RESOURCES_BASE}che-do-choi/${entry.art}`)
          if (image.ok) {
            const blob = await image.blob()
            artAssetId = await uploadModeImage(
              new File([blob], `${entry.code}.png`, { type: blob.type || "image/png" }),
              "GAME_MODE_ART",
              {
                type: "GAME_CLIENT",
                label: "Ảnh sảnh chọn chế độ trong Liên Quân Mobile",
                note: `${entry.artNote ?? ""} resources/Lien-Quan-v3/che-do-choi/${entry.art}`.trim(),
              },
            )
          } else say(`${entry.name}: không đọc được ảnh ${entry.art}.`)
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
  })
  return (
    <Dialog open={open} onOpenChange={(next) => !run.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nhập chế độ từ resources</DialogTitle>
        </DialogHeader>
        <p className="type-body">
          Đọc che-do-choi/che-do.json (26 chế độ từ ảnh sảnh), tải ảnh đã gỡ giao diện vào kho ảnh với credit Garena /
          Liên Quân Mobile và tạo bản nháp cho chế độ chưa có. Chế độ đã có được giữ nguyên.
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
