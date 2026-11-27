import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useParams } from "react-router"
import { ArrowLeft, Download, FileUp, X } from "lucide-react"
import type { MapContent } from "@aov/ui/lib/battle-map"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Textarea } from "@aov/ui/components/textarea"
import { useSession } from "@/app/auth/auth-gate"
import { Page, PageHeader } from "@/components/page-header"
import { ApiError, errorMessage } from "@/lib/api/errors"
import { IconUpload } from "../auto-chess/guide-fields"
import { confirmDraftDiscard, field, ListEditor, Section } from "../game-mode-editor"
import { gameModeApi, gameModeKeys, uploadModeImage, type AdminImage, type AdminMap } from "../game-mode-api"
import { emptyMap, missingMapLabel, readMapJson } from "./map-edit-model"
import { MapAreasSection } from "./map-areas-section"
import { MapLanesSection } from "./map-lanes-section"
import { MapObjectsSection } from "./map-objects-section"
import { MapTempoSection } from "./map-tempo-section"
import { MapTerrainSection } from "./map-terrain-section"

const TABS = [
  ["general", "Chung"],
  ["objects", "Đối tượng"],
  ["areas", "Khu vực"],
  ["terrain", "Địa hình"],
  ["lanes", "Đường"],
  ["tempo", "Nhịp điệu"],
  ["json", "JSON"],
] as const
type Tab = (typeof TABS)[number][0]

const TAB_COUNT: Partial<Record<Tab, (content: MapContent) => number>> = {
  objects: (content) => content.objects.length,
  areas: (content) => content.areas.length,
  terrain: (content) => content.terrain.length,
  lanes: (content) => content.lanes.length,
  tempo: (content) => content.tempo.length,
}

/** What is saved: tags without stray blanks and the timeline in time order, as the server expects it. */
const tidy = (content: MapContent): MapContent => ({
  ...content,
  objects: content.objects.map((object) => ({ ...object, tags: object.tags.map((tag) => tag.trim()).filter(Boolean) })),
  tempo: [...content.tempo].sort((a, b) => a.seconds - b.seconds),
})

/** Editor of the battlefield map of a mode (the game's battlefield encyclopedia), saved and published as a whole. */
export function MapEditorPage() {
  const { modeId = "" } = useParams()
  const client = useQueryClient()
  const capabilities = useSession().actor?.capabilities ?? []
  const canWrite = capabilities.includes("gamemode:write")
  const canPublish = capabilities.includes("gamemode:publish")
  const map = useQuery({
    queryKey: gameModeKeys.map(modeId),
    queryFn: ({ signal }) => gameModeApi.map(modeId, signal),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 1,
  })
  const [content, setContent] = useState<MapContent | null>(null)
  const [images, setImages] = useState<Record<string, AdminImage | { url: string }>>({})
  const [tab, setTab] = useState<Tab>("objects")
  const [note, setNote] = useState("")
  const [message, setMessage] = useState("")
  useEffect(() => {
    if (map.data) {
      setContent(map.data.content)
      setImages((current) => ({ ...current, ...map.data.images }))
    }
  }, [map.data])

  const apply = (next: AdminMap, text: string) => {
    client.setQueryData(gameModeKeys.map(modeId), next)
    void client.invalidateQueries({ queryKey: gameModeKeys.list })
    setMessage(text)
  }
  const action = useMutation({
    mutationFn: async (kind: "save" | "publish" | "discard" | "draft") => {
      const current = map.data!
      if (kind === "draft") return gameModeApi.createMapDraft(modeId, undefined, note || undefined)
      if (kind === "discard") return gameModeApi.discardMap(modeId, current.revision.id, current.revision.version)
      let saved = current
      const next = content && tidy(content)
      if (next && JSON.stringify(next) !== JSON.stringify(current.content))
        saved = await gameModeApi.updateMap(
          modeId,
          current.revision.id,
          current.revision.version,
          next,
          note || undefined,
        )
      if (kind === "publish")
        return gameModeApi.publishMap(modeId, saved.revision.id, saved.revision.version, note || undefined)
      return saved
    },
    onSuccess: (result, kind) =>
      apply(
        result,
        { save: "Đã lưu nháp.", publish: "Đã xuất bản bản đồ.", discard: "Đã bỏ nháp.", draft: "Đã tạo nháp mới." }[
          kind
        ],
      ),
    onError: (error) => setMessage(errorMessage(error)),
    meta: { silent: true },
  })

  const missing = map.isError && map.error instanceof ApiError && map.error.status === 404
  if (missing)
    return (
      <Page>
        <Back modeId={modeId} />
        <StartMap modeId={modeId} canWrite={canWrite} onCreated={(next) => apply(next, "Đã tạo nháp bản đồ.")} />
      </Page>
    )
  if (!map.data || !content) return <Page>{map.isError ? errorMessage(map.error) : "Đang tải…"}</Page>

  const data = map.data
  const draft = data.revision.state === "DRAFT"
  const editable = draft && canWrite
  const image = (id?: string | null) => (id ? images[id]?.url : undefined)
  const upload = async (file: File, kind: "MAP_ICON" | "GAME_MODE_ART", label: string) => {
    const assetId = await uploadModeImage(file, kind, {
      type: "GAME_CLIENT",
      label: "Bách khoa chiến trường trong game",
      note: `Uploaded map ${kind === "MAP_ICON" ? "icon" : "picture"} of ${label}: ${file.name}`,
    })
    setImages((current) => ({ ...current, [assetId]: { url: URL.createObjectURL(file) } }))
    return assetId
  }
  const sectionProps = { content, saved: data.content, setContent, image, upload }

  return (
    <Page>
      <PageHeader
        title={`Bản đồ chiến trường · ${data.modeCode}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Back modeId={modeId} />
            <Badge variant={draft ? "default" : "secondary"}>
              {draft ? `Nháp v${data.revision.version}` : "Đã xuất bản"}
            </Badge>
            <span>
              {content.objects.length} đối tượng · {content.areas.length} khu vực · {content.lanes.length} đường ·{" "}
              {content.tempo.length} mốc
            </span>
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
      {message && <p className="type-body whitespace-pre-line">{message}</p>}
      {data.missingFields.length > 0 && (
        <p className="type-body text-destructive">
          Cần bổ sung trước khi xuất bản: {data.missingFields.map((path) => missingMapLabel(path, content)).join(", ")}
        </p>
      )}
      <nav
        className="sticky top-0 z-20 -mx-1 flex gap-1 overflow-x-auto border-b bg-background/95 px-1 backdrop-blur [scrollbar-width:none]"
        aria-label="Phần của bản đồ"
      >
        {TABS.map(([key, label]) => {
          const count = TAB_COUNT[key]?.(content)
          return (
            <button
              key={key}
              type="button"
              aria-current={tab === key ? "page" : undefined}
              onClick={() => setTab(key)}
              className={`type-label -mb-px inline-flex min-h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 whitespace-nowrap transition-colors ${
                tab === key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              {count !== undefined && <span className="type-meta rounded-full bg-muted px-1.5">{count}</span>}
            </button>
          )
        })}
      </nav>
      <fieldset disabled={!editable} className="grid min-w-0 gap-4">
        {tab === "general" && (
          <GeneralSection content={content} setContent={setContent} image={image} upload={upload} />
        )}
        {tab === "objects" && <MapObjectsSection {...sectionProps} />}
        {tab === "areas" && <MapAreasSection {...sectionProps} />}
        {tab === "terrain" && <MapTerrainSection {...sectionProps} />}
        {tab === "lanes" && <MapLanesSection {...sectionProps} />}
        {tab === "tempo" && <MapTempoSection {...sectionProps} />}
        {tab === "json" && <JsonEditor content={content} code={data.modeCode} onApply={setContent} />}
        <Section title="Ghi chú thay đổi">
          <Input value={note} maxLength={4000} onChange={(event) => setNote(event.target.value)} />
        </Section>
      </fieldset>
    </Page>
  )
}

function Back({ modeId }: { modeId: string }) {
  return (
    <Link to={`/game-modes/${modeId}`} className="inline-flex items-center gap-1">
      <ArrowLeft className="size-4" /> Chế độ
    </Link>
  )
}

function GeneralSection({
  content,
  setContent,
  image,
  upload,
}: {
  content: MapContent
  setContent: (content: MapContent) => void
  image: (id?: string | null) => string | undefined
  upload: (file: File, kind: "GAME_MODE_ART", label: string) => Promise<string>
}) {
  const background = image(content.backgroundAssetId)
  return (
    <>
      <Section title="Thông tin chung">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={field}>
            <span className="type-label">Tên</span>
            <Input
              value={content.name ?? ""}
              onChange={(e) => setContent({ ...content, name: e.target.value || null })}
            />
          </label>
          <label className={field}>
            <span className="type-label">Ngày ghi trong game</span>
            <Input
              type="date"
              value={content.observedOn ?? ""}
              onChange={(e) => setContent({ ...content, observedOn: e.target.value || null })}
            />
          </label>
        </div>
        <label className={field}>
          <span className="type-label">Giới thiệu</span>
          <Textarea
            value={content.summary ?? ""}
            onChange={(e) => setContent({ ...content, summary: e.target.value || null })}
          />
        </label>
      </Section>
      <Section title="Ảnh nền bản đồ">
        <div className="flex flex-wrap items-center gap-4">
          <IconUpload
            size="lg"
            src={background}
            label="Tải ảnh nền"
            onFile={async (file) =>
              setContent({ ...content, backgroundAssetId: await upload(file, "GAME_MODE_ART", "background") })
            }
          />
          <div className="grid gap-1">
            <p className="type-meta max-w-md">
              Ảnh vuông nhìn từ trên xuống, phe xanh ở góc dưới bên trái. Không có ảnh thì Wiki vẽ nền đơn giản.
            </p>
            {background && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="justify-self-start"
                onClick={() => setContent({ ...content, backgroundAssetId: null })}
              >
                <X /> Bỏ ảnh nền
              </Button>
            )}
          </div>
        </div>
      </Section>
      <Section title="Nguồn">
        <ListEditor
          rows={content.sources}
          empty={{ label: "", url: null, observedOn: null }}
          onChange={(sources) => setContent({ ...content, sources })}
          render={(source, update) => (
            <div className="grid gap-2">
              <Input
                value={source.label}
                placeholder="Nguồn, vd. Bách khoa chiến trường trong game"
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
    </>
  )
}

/** Reads a JSON file the editor picked, as a map. */
async function readMapFile(file: File) {
  return readMapJson(await file.text())
}

function StartMap({
  modeId,
  canWrite,
  onCreated,
}: {
  modeId: string
  canWrite: boolean
  onCreated: (map: AdminMap) => void
}) {
  const run = useMutation({
    mutationFn: async (file: File | null) =>
      file
        ? gameModeApi.createMapDraft(modeId, await readMapFile(file), `Nhập ${file.name}`)
        : gameModeApi.createMapDraft(modeId, emptyMap(), "Nháp trống"),
    onSuccess: onCreated,
    meta: { silent: true },
  })
  return (
    <Section title="Chưa có bản đồ">
      <p className="type-body">
        Bắt đầu từ nháp trống, hoặc nhập tệp JSON của một bản đồ (bản tải xuống từ chế độ khác hay tệp dữ liệu mẫu). Kết
        quả là bản nháp để rà soát.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!canWrite || run.isPending} onClick={() => run.mutate(null)}>
          Tạo nháp trống
        </Button>
        <Button asChild variant="outline" disabled={!canWrite || run.isPending}>
          <label className="cursor-pointer">
            <FileUp /> Nhập tệp JSON
            <input
              type="file"
              hidden
              accept="application/json,.json"
              disabled={!canWrite || run.isPending}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ""
                if (file) run.mutate(file)
              }}
            />
          </label>
        </Button>
      </div>
      {run.isError && <p className="type-body text-destructive">{errorMessage(run.error)}</p>}
      {!canWrite && <p className="type-meta">Cần quyền gamemode:write.</p>}
    </Section>
  )
}

function JsonEditor({
  content,
  code,
  onApply,
}: {
  content: MapContent
  code: string
  onApply: (content: MapContent) => void
}) {
  const [text, setText] = useState(() => JSON.stringify(content, null, 2))
  const [error, setError] = useState("")
  return (
    <Section title="Sửa toàn bộ bằng JSON">
      <p className="type-meta">
        Dùng khi cần sửa hàng loạt hoặc chép sang chế độ khác. Áp dụng xong vẫn phải Lưu nháp; máy chủ kiểm tra lại mọi
        tham chiếu.
      </p>
      <Textarea className="min-h-[60vh] font-mono" value={text} onChange={(e) => setText(e.target.value)} />
      {error && <p className="type-body text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => {
            try {
              onApply(readMapJson(text))
              setError("")
            } catch (cause) {
              setError(`JSON không hợp lệ: ${cause instanceof Error ? cause.message : String(cause)}`)
            }
          }}
        >
          Áp dụng vào nháp
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const link = document.createElement("a")
            link.href = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: "application/json" }))
            link.download = `ban-do-${code}.json`
            link.click()
            URL.revokeObjectURL(link.href)
          }}
        >
          <Download /> Tải tệp JSON
        </Button>
      </div>
    </Section>
  )
}
