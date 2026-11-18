import { useEffect, useState, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useParams } from "react-router"
import { ArrowDown, ArrowLeft, ArrowUp, Copy, ListPlus, Plus, Trash2, Upload } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { LocalTime } from "@aov/ui/components/local-time"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Textarea } from "@aov/ui/components/textarea"
import { useSession } from "@/app/auth/auth-gate"
import { Page, PageHeader } from "@/components/page-header"
import { errorMessage } from "@/lib/api/errors"
import { gameModeApi, gameModeKeys, uploadModeImage, type AdminMode, type ModeContent } from "./game-mode-api"
import { AVAILABILITY_LABEL, missingLabel } from "./game-mode-import"
import { confirmAction } from "@/components/confirm-dialog"
import { HeroCodePicker, RowMenu } from "./entry-controls"
import { RulesEditor } from "./rules-editor"
import { NativeSelect } from "@/components/native-select"

/** Discarding a draft drops every change saved in it, so it asks first. */
export const confirmDraftDiscard = () =>
  confirmAction({
    title: "Bỏ bản nháp này?",
    description: "Mọi thay đổi đã lưu trong bản nháp sẽ mất. Bản đang xuất bản trên Wiki giữ nguyên.",
    confirmLabel: "Bỏ nháp",
    cancelLabel: "Giữ bản nháp",
  })

export const field = "grid gap-1"

/** Mode editor: one open draft at a time, saved with the version it was read at, then published. */
export function GameModeEditorPage() {
  const { modeId = "" } = useParams()
  const client = useQueryClient()
  const capabilities = useSession().actor?.capabilities ?? []
  const canWrite = capabilities.includes("gamemode:write")
  const canPublish = capabilities.includes("gamemode:publish")
  const mode = useQuery({
    queryKey: gameModeKeys.mode(modeId),
    queryFn: ({ signal }) => gameModeApi.current(modeId, signal),
  })
  const history = useQuery({
    queryKey: gameModeKeys.history(modeId),
    queryFn: ({ signal }) => gameModeApi.history(modeId, signal),
  })
  const [content, setContent] = useState<ModeContent | null>(null)
  const [note, setNote] = useState("")
  const [message, setMessage] = useState("")
  useEffect(() => {
    if (mode.data) setContent(mode.data.content)
  }, [mode.data])

  const apply = (next: AdminMode, text: string) => {
    client.setQueryData(gameModeKeys.mode(modeId), next)
    void client.invalidateQueries({ queryKey: gameModeKeys.list })
    void client.invalidateQueries({ queryKey: gameModeKeys.history(modeId) })
    setMessage(text)
  }
  const action = useMutation({
    mutationFn: async (kind: "save" | "publish" | "discard" | "draft") => {
      const current = mode.data!
      if (kind === "draft") return gameModeApi.createDraft(modeId, note || undefined)
      if (kind === "discard") return gameModeApi.discard(modeId, current.revision.id, current.revision.version)
      let saved = current
      if (content && JSON.stringify(content) !== JSON.stringify(current.content))
        saved = await gameModeApi.update(
          modeId,
          current.revision.id,
          current.revision.version,
          content,
          note || undefined,
        )
      if (kind === "publish")
        return gameModeApi.publish(modeId, saved.revision.id, saved.revision.version, note || undefined)
      return saved
    },
    onSuccess: (result, kind) =>
      apply(
        result,
        { save: "Đã lưu nháp.", publish: "Đã xuất bản lên Wiki.", discard: "Đã bỏ nháp.", draft: "Đã tạo nháp mới." }[
          kind
        ],
      ),
    onError: (error) => setMessage(errorMessage(error)),
    meta: { silent: true },
  })

  if (!mode.data || !content) return <Page>{mode.isError ? errorMessage(mode.error) : "Đang tải…"}</Page>
  const data = mode.data
  const draft = data.revision.state === "DRAFT"
  const editable = draft && canWrite
  const set = (patch: Partial<ModeContent>) => setContent({ ...content, ...patch })
  const art = content.artAssetId ? data.images[content.artAssetId] : undefined

  return (
    <Page>
      <PageHeader
        title={content.name || data.code}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link to="/game-modes" className="inline-flex items-center gap-1">
              <ArrowLeft className="size-4" /> Chế độ chơi
            </Link>
            <span>{data.code}</span>
            <Badge variant={draft ? "default" : "secondary"}>
              {draft ? `Nháp v${data.revision.version}` : "Đã xuất bản"}
            </Badge>
            {data.hasPublished && draft && <Badge variant="outline">Bản công khai giữ nguyên tới khi xuất bản</Badge>}
          </span>
        }
        actions={
          draft ? (
            <>
              <Button
                variant="outline"
                disabled={!canWrite || action.isPending}
                onClick={async () => {
                  if (await confirmDraftDiscard()) action.mutate("discard")
                }}
              >
                Bỏ nháp
              </Button>
              <Button variant="outline" disabled={!editable || action.isPending} onClick={() => action.mutate("save")}>
                Lưu nháp
              </Button>
              <Button disabled={!canPublish || action.isPending} onClick={() => action.mutate("publish")}>
                Xuất bản
              </Button>
            </>
          ) : (
            <Button disabled={!canWrite || action.isPending} onClick={() => action.mutate("draft")}>
              Tạo nháp để sửa
            </Button>
          )
        }
      />
      {message && <p className="type-body">{message}</p>}
      {data.missingFields.length > 0 && (
        <p className="type-body text-destructive">
          Cần bổ sung trước khi xuất bản: {data.missingFields.map((path) => missingLabel(path)).join(", ")}
        </p>
      )}
      {content.guideKind === "AUTO_CHESS" && (
        <p className="type-body">
          <Link to={`/game-modes/${modeId}/auto-chess`} className="underline">
            Mở cẩm nang Cờ Liên Quân →
          </Link>
        </p>
      )}

      <fieldset disabled={!editable} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid content-start gap-4">
          <Section title="Thông tin chung">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={field}>
                <span className="type-label">Tên</span>
                <Input value={content.name} maxLength={120} onChange={(event) => set({ name: event.target.value })} />
              </label>
              <label className={field}>
                <span className="type-label">Nhóm</span>
                <NativeSelect
                  value={content.group ?? ""}
                  onChange={(event) => set({ group: (event.target.value || null) as ModeContent["group"] })}
                >
                  <option value="">Chưa chọn</option>
                  <option value="PVP">PVP</option>
                  <option value="ENTERTAINMENT">Chế độ giải trí</option>
                </NativeSelect>
              </label>
              <label className={field}>
                <span className="type-label">Thứ tự trong nhóm</span>
                <Input
                  type="number"
                  min={0}
                  value={content.order ?? ""}
                  onChange={(event) => set({ order: event.target.value === "" ? null : Number(event.target.value) })}
                />
              </label>
              <label className={field}>
                <span className="type-label">Số người / đội hình</span>
                <Input
                  value={content.playersLabel ?? ""}
                  placeholder="5v5, 8 người…"
                  onChange={(event) => set({ playersLabel: event.target.value || null })}
                />
              </label>
              <label className={field}>
                <span className="type-label">Thời lượng từ (phút)</span>
                <Input
                  type="number"
                  min={1}
                  value={content.duration?.minMinutes ?? ""}
                  onChange={(event) =>
                    set({
                      duration: {
                        ...content.duration,
                        minMinutes: event.target.value === "" ? null : Number(event.target.value),
                      },
                    })
                  }
                />
              </label>
              <label className={field}>
                <span className="type-label">đến (phút)</span>
                <Input
                  type="number"
                  min={1}
                  value={content.duration?.maxMinutes ?? ""}
                  onChange={(event) =>
                    set({
                      duration: {
                        ...content.duration,
                        maxMinutes: event.target.value === "" ? null : Number(event.target.value),
                      },
                    })
                  }
                />
              </label>
              <label className={field}>
                <span className="type-label">Cẩm nang chi tiết</span>
                <NativeSelect
                  value={content.guideKind}
                  onChange={(event) => set({ guideKind: event.target.value as ModeContent["guideKind"] })}
                >
                  <option value="NONE">Không có</option>
                  <option value="AUTO_CHESS">Cờ Liên Quân</option>
                </NativeSelect>
              </label>
            </div>
            <label className={field}>
              <span className="type-label">Mô tả ngắn</span>
              <Textarea
                value={content.summary ?? ""}
                maxLength={1000}
                onChange={(event) => set({ summary: event.target.value || null })}
              />
            </label>
          </Section>

          <Section title="Luật chơi">
            <RulesEditor rules={content.rules} onChange={(rules) => set({ rules })} />
          </Section>

          <Section title="Tướng của chế độ">
            <ListEditor
              rows={content.heroes}
              empty={{ heroCode: null, name: "", note: null }}
              onChange={(heroes) => set({ heroes })}
              render={(hero, update) => (
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input
                    value={hero.name}
                    placeholder="Tên"
                    onChange={(event) => update({ ...hero, name: event.target.value })}
                  />
                  <HeroCodePicker
                    value={hero.heroCode ?? null}
                    unitName={hero.name}
                    onChange={(heroCode) => update({ ...hero, heroCode })}
                  />
                  <Input
                    value={hero.note ?? ""}
                    placeholder="Ghi chú"
                    onChange={(event) => update({ ...hero, note: event.target.value || null })}
                  />
                </div>
              )}
            />
          </Section>

          <Section title="Vật phẩm riêng">
            <ListEditor
              rows={content.specialItems}
              empty={{ name: "", description: null, iconAssetId: null }}
              onChange={(specialItems) => set({ specialItems })}
              render={(item, update) => (
                <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
                  <Input
                    value={item.name}
                    placeholder="Tên"
                    onChange={(event) => update({ ...item, name: event.target.value })}
                  />
                  <Input
                    value={item.description ?? ""}
                    placeholder="Mô tả"
                    onChange={(event) => update({ ...item, description: event.target.value || null })}
                  />
                </div>
              )}
            />
          </Section>
        </div>

        <aside className="grid content-start gap-4">
          <Section title="Ảnh chế độ">
            <div className="aspect-video overflow-hidden rounded-md bg-muted">
              {art ? <img src={art.url} alt="" className="size-full object-cover" /> : null}
            </div>
            <ArtUpload onUploaded={(artAssetId) => set({ artAssetId })} />
            {content.artAssetId && !art && <p className="type-meta">Ảnh mới sẽ hiện sau khi lưu nháp.</p>}
            <p className="type-meta">Ảnh đã gỡ chữ, nút và UID. Credit: Garena / Liên Quân Mobile.</p>
          </Section>
          <Section title="Tình trạng mở">
            <label className={field}>
              <span className="type-label">Trạng thái</span>
              <NativeSelect
                value={content.availability?.status ?? ""}
                onChange={(event) =>
                  set({
                    availability: {
                      ...content.availability,
                      status: (event.target.value || null) as NonNullable<ModeContent["availability"]>["status"],
                    },
                  })
                }
              >
                <option value="">Chưa chọn</option>
                {Object.entries(AVAILABILITY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </label>
            {(
              [
                ["gameLabel", "Nhãn trong game", "text"],
                ["startsOn", "Mở từ ngày", "date"],
                ["endsOn", "Đến ngày", "date"],
                ["observedOn", "Ngày quan sát", "date"],
                ["note", "Ghi chú", "text"],
              ] as const
            ).map(([key, label, type]) => (
              <label key={key} className={field}>
                <span className="type-label">{label}</span>
                <Input
                  type={type}
                  value={content.availability?.[key] ?? ""}
                  onChange={(event) =>
                    set({
                      availability: {
                        status: content.availability?.status ?? null,
                        ...content.availability,
                        [key]: event.target.value || null,
                      },
                    })
                  }
                />
              </label>
            ))}
          </Section>
          <Section title="Nguồn">
            <ListEditor
              rows={content.sources}
              empty={{ label: "", url: null, observedOn: null }}
              onChange={(sources) => set({ sources })}
              render={(source, update) => (
                <div className="grid gap-2">
                  <Input
                    value={source.label}
                    placeholder="Nguồn"
                    onChange={(event) => update({ ...source, label: event.target.value })}
                  />
                  <Input
                    value={source.url ?? ""}
                    placeholder="https://…"
                    onChange={(event) => update({ ...source, url: event.target.value || null })}
                  />
                </div>
              )}
            />
          </Section>
          <Section title="Ghi chú thay đổi">
            <Input value={note} maxLength={4000} onChange={(event) => setNote(event.target.value)} />
          </Section>
          <Section title="Lịch sử">
            <ul className="type-meta grid gap-1">
              {history.data?.map((revision) => (
                <li key={revision.id}>
                  #{revision.revisionNo} · {revision.state} · <LocalTime value={revision.updatedAt} />
                  {revision.changeNote && ` · ${revision.changeNote}`}
                </li>
              ))}
            </ul>
          </Section>
        </aside>
      </fieldset>
    </Page>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 rounded-lg border bg-card p-4">
      <h2 className="type-section-title">{title}</h2>
      {children}
    </section>
  )
}

/** Rows edited in place; the "⋯" menu moves, copies, adds below or removes a row. */
export function ListEditor<T>({
  rows,
  empty,
  onChange,
  render,
}: {
  rows: T[]
  empty: T
  onChange: (rows: T[]) => void
  render: (row: T, update: (row: T) => void) => ReactNode
}) {
  const insert = (at: number, row: T) => onChange([...rows.slice(0, at), row, ...rows.slice(at)])
  const move = (at: number, target: number) => {
    const next = [...rows]
    ;[next[at], next[target]] = [next[target], next[at]]
    onChange(next)
  }
  return (
    <div className="grid gap-2">
      {rows.map((row, at) => (
        <div key={at} className="flex items-start gap-2 rounded-md border p-2">
          <span className="type-meta mt-1.5 grid size-6 shrink-0 place-items-center rounded-full bg-muted">
            {at + 1}
          </span>
          <div className="min-w-0 flex-1">
            {render(row, (next) => onChange(rows.map((other, i) => (i === at ? next : other))))}
          </div>
          <RowMenu
            label={`Tùy chọn cho dòng ${at + 1}`}
            actions={[
              { label: "Lên trên", icon: <ArrowUp />, disabled: at === 0, onSelect: () => move(at, at - 1) },
              {
                label: "Xuống dưới",
                icon: <ArrowDown />,
                disabled: at === rows.length - 1,
                onSelect: () => move(at, at + 1),
              },
              { label: "Thêm dòng bên dưới", icon: <ListPlus />, onSelect: () => insert(at + 1, empty) },
              { label: "Nhân bản", icon: <Copy />, onSelect: () => insert(at + 1, structuredClone(row)) },
              {
                label: "Xóa dòng",
                icon: <Trash2 />,
                destructive: true,
                apart: true,
                onSelect: async () => {
                  if (
                    await confirmAction({
                      title: `Xóa dòng ${at + 1}?`,
                      description: "Dòng sẽ bị xóa khỏi bản nháp cho tới khi bạn lưu.",
                      confirmLabel: "Xóa",
                    })
                  )
                    onChange(rows.filter((_, i) => i !== at))
                },
              },
            ]}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start"
        onClick={() => onChange([...rows, empty])}
      >
        <Plus /> Thêm
      </Button>
    </div>
  )
}

function ArtUpload({ onUploaded }: { onUploaded: (assetId: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  return (
    <label className="type-body inline-flex cursor-pointer items-center gap-2">
      <Upload className="size-4" />
      {busy ? "Đang tải ảnh…" : "Tải ảnh mới"}
      <input
        type="file"
        hidden
        accept="image/png,image/jpeg,image/webp"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (!file) return
          setBusy(true)
          setError("")
          try {
            onUploaded(
              await uploadModeImage(file, "GAME_MODE_ART", {
                type: "GAME_CLIENT",
                label: "Ảnh chế độ trong Liên Quân Mobile",
                note: `Uploaded mode art: ${file.name}`,
              }),
            )
          } catch (cause) {
            setError(errorMessage(cause))
          } finally {
            setBusy(false)
          }
        }}
      />
      {error && <span className="text-destructive">{error}</span>}
    </label>
  )
}
