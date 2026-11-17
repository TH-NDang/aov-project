import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useParams } from "react-router"
import { ArrowLeft, Download } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Textarea } from "@aov/ui/components/textarea"
import { useSession } from "@/app/auth/auth-gate"
import { Page, PageHeader } from "@/components/page-header"
import { ApiError, errorMessage } from "@/lib/api/errors"
import { fetchSourceFile, openSourceCollection } from "../files/source-collection-files"
import {
  BlessingsSection,
  ItemsSection,
  LineupsSection,
  QuestsSection,
  TraitsSection,
  UnitsSection,
} from "./auto-chess-sections"
import { field, Section } from "./game-mode-editor"
import { ModeArtCard } from "./mode-art-card"
import { RulesEditor } from "./rules-editor"
import {
  gameModeApi,
  gameModeKeys,
  uploadModeImage,
  type AdminGuide,
  type AdminImage,
  type GuideContent,
} from "./game-mode-api"
import {
  GUIDE_SOURCE,
  guideContentFromManifest,
  guideIconPaths,
  iconsWithoutSource,
  importedImageSource,
  mapLimit,
  missingLabel,
  retry,
  type GuideManifest,
} from "./game-mode-import"

const TABS = [
  ["general", "Chung"],
  ["units", "Quân cờ"],
  ["traits", "Phe/Nghề"],
  ["items", "Trang bị"],
  ["blessings", "Chúc phúc"],
  ["quests", "Nhiệm vụ"],
  ["lineups", "Đội hình đề xuất"],
  ["json", "JSON"],
  ["community", "Đội hình cộng đồng"],
] as const
type Tab = (typeof TABS)[number][0]

const TAB_COUNT: Partial<Record<Tab, (content: GuideContent) => number>> = {
  units: (content) => content.units.length,
  traits: (content) => content.traits.length,
  items: (content) => content.items.length,
  blessings: (content) => content.blessings.length,
  quests: (content) => content.quests.length,
  lineups: (content) => content.lineups.length,
}

/** Editor of the auto-chess encyclopedia snapshot of a mode, saved and published as a whole. */
export function AutoChessEditorPage() {
  const { modeId = "" } = useParams()
  const client = useQueryClient()
  const capabilities = useSession().actor?.capabilities ?? []
  const canWrite = capabilities.includes("gamemode:write")
  const canPublish = capabilities.includes("gamemode:publish")
  const guide = useQuery({
    queryKey: gameModeKeys.guide(modeId),
    queryFn: ({ signal }) => gameModeApi.guide(modeId, signal),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 1,
  })
  const [content, setContent] = useState<GuideContent | null>(null)
  const saved = guide.data?.content ?? null
  const [images, setImages] = useState<Record<string, AdminImage | { url: string }>>({})
  const [tab, setTab] = useState<Tab>("units")
  const [note, setNote] = useState("")
  const [message, setMessage] = useState("")
  useEffect(() => {
    if (guide.data) {
      setContent(guide.data.content)
      setImages((current) => ({ ...current, ...guide.data.images }))
    }
  }, [guide.data])

  const apply = (next: AdminGuide, text: string) => {
    client.setQueryData(gameModeKeys.guide(modeId), next)
    void client.invalidateQueries({ queryKey: gameModeKeys.list })
    setMessage(text)
  }
  const action = useMutation({
    mutationFn: async (kind: "save" | "publish" | "discard" | "draft") => {
      const current = guide.data!
      if (kind === "draft") return gameModeApi.createGuideDraft(modeId, undefined, note || undefined)
      if (kind === "discard") return gameModeApi.discardGuide(modeId, current.revision.id, current.revision.version)
      let saved = current
      if (content && JSON.stringify(content) !== JSON.stringify(current.content))
        saved = await gameModeApi.updateGuide(
          modeId,
          current.revision.id,
          current.revision.version,
          content,
          note || undefined,
        )
      if (kind === "publish")
        return gameModeApi.publishGuide(modeId, saved.revision.id, saved.revision.version, note || undefined)
      return saved
    },
    onSuccess: (result, kind) =>
      apply(
        result,
        { save: "Đã lưu nháp.", publish: "Đã xuất bản cẩm nang.", discard: "Đã bỏ nháp.", draft: "Đã tạo nháp mới." }[
          kind
        ],
      ),
    onError: (error) => setMessage(errorMessage(error)),
    meta: { silent: true },
  })

  const missing = guide.isError && guide.error instanceof ApiError && guide.error.status === 404
  if (missing)
    return (
      <Page>
        <Back modeId={modeId} />
        <StartGuide modeId={modeId} canWrite={canWrite} onCreated={(next) => apply(next, "Đã tạo nháp cẩm nang.")} />
      </Page>
    )
  if (!guide.data || !content) return <Page>{guide.isError ? errorMessage(guide.error) : "Đang tải…"}</Page>

  const data = guide.data
  const draft = data.revision.state === "DRAFT"
  const editable = draft && canWrite
  const image = (id?: string | null) => (id ? images[id]?.url : undefined)
  const upload = async (file: File, label: string) => {
    const assetId = await uploadModeImage(file, "AUTO_CHESS_ICON", {
      type: "GAME_CLIENT",
      label: "Bách khoa Cờ Liên Quân trong game",
      note: `Uploaded ${label}: ${file.name}`,
    })
    setImages((current) => ({ ...current, [assetId]: { url: URL.createObjectURL(file) } }))
    return assetId
  }

  return (
    <Page>
      <PageHeader
        title={`Cẩm nang Cờ Liên Quân · ${data.modeCode}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Back modeId={modeId} />
            <Badge variant={draft ? "default" : "secondary"}>
              {draft ? `Nháp v${data.revision.version}` : "Đã xuất bản"}
            </Badge>
            <span>
              {content.units.length} quân cờ · {content.traits.length} Phe/Nghề · {content.items.length} trang bị ·{" "}
              {content.blessings.length} chúc phúc · {content.lineups.length} đội hình
            </span>
          </span>
        }
        actions={
          draft ? (
            <>
              <Button
                variant="outline"
                disabled={!canWrite || action.isPending}
                onClick={() => action.mutate("discard")}
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
      <ModeArtCard modeId={modeId} canWrite={canWrite} />
      {message && <p className="type-body whitespace-pre-line">{message}</p>}
      {data.missingFields.length > 0 && (
        <p className="type-body text-destructive">
          Cần bổ sung trước khi xuất bản: {data.missingFields.map((path) => missingLabel(path, content)).join(", ")}
        </p>
      )}
      <nav
        className="sticky top-0 z-20 -mx-1 flex gap-1 overflow-x-auto border-b bg-background/95 px-1 backdrop-blur [scrollbar-width:none]"
        aria-label="Phần của cẩm nang"
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
      <fieldset disabled={!editable && tab !== "community"} className="grid gap-4">
        {tab === "general" && (
          <Section title="Thông tin chung">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={field}>
                <span className="type-label">Tên phiên bản</span>
                <Input
                  value={content.edition ?? ""}
                  onChange={(e) => setContent({ ...content, edition: e.target.value || null })}
                />
              </label>
              <label className={field}>
                <span className="type-label">Ngày quan sát</span>
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
            <h3 className="type-label">Luật cơ bản</h3>
            <RulesEditor rules={content.rules} onChange={(rules) => setContent({ ...content, rules })} />
          </Section>
        )}
        {tab === "units" && (
          <UnitsSection content={content} saved={saved} setContent={setContent} image={image} upload={upload} />
        )}
        {tab === "traits" && (
          <TraitsSection content={content} saved={saved} setContent={setContent} image={image} upload={upload} />
        )}
        {tab === "items" && (
          <ItemsSection content={content} saved={saved} setContent={setContent} image={image} upload={upload} />
        )}
        {tab === "blessings" && (
          <BlessingsSection content={content} saved={saved} setContent={setContent} image={image} upload={upload} />
        )}
        {tab === "quests" && <QuestsSection content={content} setContent={setContent} />}
        {tab === "lineups" && <LineupsSection content={content} saved={saved} setContent={setContent} image={image} />}
        {tab === "json" && <JsonEditor content={content} onApply={setContent} />}
        <Section title="Ghi chú thay đổi">
          <Input value={note} maxLength={4000} onChange={(event) => setNote(event.target.value)} />
        </Section>
      </fieldset>
      {tab === "community" && <CommunityModeration modeId={modeId} canPublish={canPublish} content={content} />}
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

function StartGuide({
  modeId,
  canWrite,
  onCreated,
}: {
  modeId: string
  canWrite: boolean
  onCreated: (guide: AdminGuide) => void
}) {
  const [progress, setProgress] = useState("")
  // Icons uploaded by an earlier attempt on this page; running the import again only uploads the rest.
  const uploaded = useRef(new Map<string, string>())
  const run = useMutation({
    mutationFn: async (fromResources: boolean) => {
      if (!fromResources) return gameModeApi.createGuideDraft(modeId, undefined, "Nháp trống")
      const source = await openSourceCollection(GUIDE_SOURCE.collection)
      const manifest = await source.json<GuideManifest>(GUIDE_SOURCE.manifest)
      const unsourced = iconsWithoutSource(manifest)
      if (unsourced.length)
        throw new Error(
          `${unsourced.length} biểu tượng chưa có nguồn trong dữ liệu, ví dụ ${unsourced[0]}. Chưa tải ảnh nào.`,
        )
      const paths = guideIconPaths(manifest)
      // Every icon must be in the collection before anything is uploaded, so a guide never starts half illustrated.
      const links = await source.links(paths.map((path) => GUIDE_SOURCE.folder + path))
      const absent = paths.filter((path) => !links.has(GUIDE_SOURCE.folder + path))
      if (absent.length)
        throw new Error(
          `${absent.length} biểu tượng chưa có trong bộ tệp nguồn ${GUIDE_SOURCE.collection}, ví dụ ${absent[0]}. Chưa tải ảnh nào.`,
        )
      let done = 0
      const assets = uploaded.current
      await mapLimit(paths, 4, async (path) => {
        if (assets.has(path)) {
          setProgress(`Đã tải ${++done}/${paths.length} ảnh…`)
          return
        }
        const image = await fetchSourceFile(links.get(GUIDE_SOURCE.folder + path)!)
        if (image.ok) {
          const blob = await image.blob()
          const name = path.slice(path.lastIndexOf("/") + 1)
          assets.set(
            path,
            await retry(() =>
              uploadModeImage(
                new File([blob], name, { type: blob.type || "image/jpeg" }),
                "AUTO_CHESS_ICON",
                importedImageSource(manifest.imageSources?.[path])!,
              ),
            ),
          )
        }
        setProgress(`Đã tải ${++done}/${paths.length} ảnh…`)
      })
      return gameModeApi.createGuideDraft(
        modeId,
        guideContentFromManifest(manifest, assets),
        `Nhập ${manifest.edition ?? "Bách khoa"}`,
      )
    },
    onSuccess: onCreated,
    meta: { silent: true },
  })
  return (
    <Section title="Chưa có cẩm nang">
      <p className="type-body">
        Nhập bản chép Bách khoa 08/11/2026 (lượt 15:03) trong bộ tệp nguồn co-lien-quan-2026-11-08-1503: 58 quân cờ, 27
        Phe/Nghề, 22 trang bị, 82 chúc phúc, 18 nhiệm vụ và 3 đội hình mẫu, cùng 247 biểu tượng. Mỗi biểu tượng mang
        nguồn riêng: ảnh thể hiện gì, tệp gốc trong bộ thu thập và giờ ghi. Hoặc bắt đầu từ nháp trống. Kết quả là bản
        nháp để rà soát.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!canWrite || run.isPending} onClick={() => run.mutate(true)}>
          <Download /> Nhập Bách khoa từ tệp nguồn
        </Button>
        <Button variant="outline" disabled={!canWrite || run.isPending} onClick={() => run.mutate(false)}>
          Tạo nháp trống
        </Button>
      </div>
      {progress && <p className="type-meta">{progress}</p>}
      {run.isError && <p className="type-body text-destructive">{errorMessage(run.error)}</p>}
      {!canWrite && <p className="type-meta">Cần quyền gamemode:write.</p>}
    </Section>
  )
}

function JsonEditor({ content, onApply }: { content: GuideContent; onApply: (content: GuideContent) => void }) {
  const [text, setText] = useState(() => JSON.stringify(content, null, 2))
  const [error, setError] = useState("")
  return (
    <Section title="Sửa toàn bộ bằng JSON">
      <p className="type-meta">
        Dùng khi cần sửa hàng loạt. Áp dụng xong vẫn phải Lưu nháp; máy chủ kiểm tra lại mọi tham chiếu.
      </p>
      <Textarea className="min-h-[60vh]" value={text} onChange={(e) => setText(e.target.value)} />
      {error && <p className="type-body text-destructive">{error}</p>}
      <Button
        type="button"
        className="justify-self-start"
        onClick={() => {
          try {
            onApply(JSON.parse(text) as GuideContent)
            setError("")
          } catch (cause) {
            setError(`JSON không hợp lệ: ${String(cause)}`)
          }
        }}
      >
        Áp dụng vào nháp
      </Button>
    </Section>
  )
}

function CommunityModeration({
  modeId,
  canPublish,
  content,
}: {
  modeId: string
  canPublish: boolean
  content: GuideContent
}) {
  const client = useQueryClient()
  const [status, setStatus] = useState<string | null>(null)
  const list = useQuery({
    queryKey: gameModeKeys.community(modeId, status ?? "ALL"),
    queryFn: ({ signal }) => gameModeApi.community(modeId, status, 0, signal),
  })
  const [error, setError] = useState("")
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const toggle = useMutation({
    mutationFn: async ({ id, version, hidden }: { id: string; version: number; hidden: boolean }) => {
      const reason = reasons[id]?.trim()
      if (hidden && !reason) throw new Error("Nhập lý do trước khi ẩn đội hình.")
      return gameModeApi.visibility(modeId, id, version, hidden, hidden ? reason : undefined)
    },
    onSuccess: () => {
      setError("")
      void client.invalidateQueries({ queryKey: ["admin-game-modes", "community", modeId] })
    },
    onError: (cause) => setError(errorMessage(cause)),
    meta: { silent: true },
  })
  const names = new Map(content.units.map((unit) => [unit.code, unit.name]))
  return (
    <Section title="Đội hình cộng đồng">
      <div className="flex gap-2">
        {[null, "VISIBLE", "HIDDEN"].map((value) => (
          <Button
            key={value ?? "all"}
            size="sm"
            variant={status === value ? "default" : "outline"}
            onClick={() => setStatus(value)}
          >
            {value === null ? "Tất cả" : value === "VISIBLE" ? "Đang hiện" : "Đã ẩn"}
          </Button>
        ))}
      </div>
      {error && <p className="type-body text-destructive">{error}</p>}
      {list.isPending ? (
        <p className="type-body">Đang tải…</p>
      ) : list.isError ? (
        <p className="type-body text-destructive">{errorMessage(list.error)}</p>
      ) : list.data.items.length === 0 ? (
        <p className="type-body text-muted-foreground">Chưa có đội hình cộng đồng.</p>
      ) : (
        <ul className="grid gap-2">
          {list.data.items.map((lineup) => (
            <li key={lineup.id} className="grid gap-1 rounded-md border p-2">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="type-body">{lineup.name}</strong>
                <Badge variant={lineup.status === "VISIBLE" ? "secondary" : "destructive"}>
                  {lineup.status === "VISIBLE" ? "Đang hiện" : "Đã ẩn"}
                </Badge>
                <span className="type-meta">
                  ♥ {lineup.likes} · người đăng {lineup.authorSubject.slice(0, 8)}…
                </span>
                {lineup.status === "VISIBLE" && (
                  <Input
                    className="ml-auto max-w-60"
                    placeholder="Lý do ẩn"
                    aria-label={`Lý do ẩn ${lineup.name}`}
                    value={reasons[lineup.id] ?? ""}
                    onChange={(e) => setReasons({ ...reasons, [lineup.id]: e.target.value })}
                  />
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canPublish || toggle.isPending}
                  onClick={() =>
                    toggle.mutate({ id: lineup.id, version: lineup.version, hidden: lineup.status === "VISIBLE" })
                  }
                >
                  {lineup.status === "VISIBLE" ? "Ẩn" : "Hiện lại"}
                </Button>
              </div>
              <p className="type-meta">
                {lineup.units.map((unit) => names.get(unit.unitCode) ?? unit.unitCode).join(", ")}
              </p>
              {lineup.note && <p className="type-body">{lineup.note}</p>}
              {lineup.hiddenReason && <p className="type-meta">Lý do ẩn: {lineup.hiddenReason}</p>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
