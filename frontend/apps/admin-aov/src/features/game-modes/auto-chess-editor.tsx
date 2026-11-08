import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useParams } from "react-router"
import { ArrowLeft, Download, Upload } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Textarea } from "@aov/ui/components/textarea"
import { useSession } from "@/app/auth/auth-gate"
import { Page, PageHeader } from "@/components/page-header"
import { ApiError, errorMessage } from "@/lib/api/errors"
import { RESOURCES_BASE } from "@/lib/media"
import { field, ListEditor, Section, selectClass } from "./game-mode-editor"
import {
  gameModeApi,
  gameModeKeys,
  uploadModeImage,
  type AdminGuide,
  type AdminImage,
  type GuideContent,
  type GuideLineup,
} from "./game-mode-api"
import {
  GUIDE_FOLDER,
  GUIDE_MANIFEST,
  guideContentFromManifest,
  guideIconPaths,
  iconsWithoutSource,
  importedImageSource,
  mapLimit,
  missingLabel,
  retry,
  type GuideManifest,
} from "./game-mode-import"

type Unit = GuideContent["units"][number]
type Trait = GuideContent["traits"][number]

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

const STATS = [
  ["health", "Máu"],
  ["physicalAttack", "Công vật lý"],
  ["armor", "Giáp"],
  ["magicResistance", "Giáp phép"],
] as const

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
        title={`Cẩm nang Cờ Liên quân · ${data.modeCode}`}
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
      {message && <p className="type-body whitespace-pre-line">{message}</p>}
      {data.missingFields.length > 0 && (
        <p className="type-body text-destructive">
          Cần bổ sung trước khi xuất bản: {data.missingFields.map((path) => missingLabel(path, content)).join(", ")}
        </p>
      )}
      <div className="flex flex-wrap gap-1" role="tablist">
        {TABS.map(([key, label]) => (
          <Button key={key} size="sm" variant={tab === key ? "default" : "outline"} onClick={() => setTab(key)}>
            {label}
          </Button>
        ))}
      </div>
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
            <ListEditor
              rows={content.rules}
              empty={{ group: null, title: "", body: "" }}
              onChange={(rules) => setContent({ ...content, rules })}
              render={(rule, update) => (
                <div className="grid gap-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={rule.group ?? ""}
                      placeholder="Nhóm"
                      onChange={(e) => update({ ...rule, group: e.target.value || null })}
                    />
                    <Input
                      value={rule.title}
                      placeholder="Tiêu đề"
                      onChange={(e) => update({ ...rule, title: e.target.value })}
                    />
                  </div>
                  <Textarea value={rule.body ?? ""} onChange={(e) => update({ ...rule, body: e.target.value })} />
                </div>
              )}
            />
          </Section>
        )}
        {tab === "units" && <UnitsEditor content={content} setContent={setContent} image={image} upload={upload} />}
        {tab === "traits" && <TraitsEditor content={content} setContent={setContent} image={image} upload={upload} />}
        {tab === "items" && (
          <>
            <Section title="Nhóm trang bị">
              <ListEditor
                rows={content.itemGroups}
                empty={{ code: "", name: "", slotCount: null }}
                onChange={(itemGroups) => setContent({ ...content, itemGroups })}
                render={(group, update) => (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Input
                      value={group.code}
                      placeholder="Mã"
                      onChange={(e) => update({ ...group, code: e.target.value })}
                    />
                    <Input
                      value={group.name}
                      placeholder="Tên"
                      onChange={(e) => update({ ...group, name: e.target.value })}
                    />
                    <Input
                      type="number"
                      value={group.slotCount ?? ""}
                      placeholder="Số ô"
                      onChange={(e) =>
                        update({ ...group, slotCount: e.target.value === "" ? null : Number(e.target.value) })
                      }
                    />
                  </div>
                )}
              />
            </Section>
            <Section title="Trang bị">
              <ListEditor
                rows={content.items}
                empty={{ code: "", name: "", effect: null, groupCode: null, slot: null, iconAssetId: null }}
                onChange={(items) => setContent({ ...content, items })}
                render={(item, update) => (
                  <div className="grid gap-2 sm:grid-cols-[auto_1fr_1fr_2fr_1fr_80px]">
                    <IconField
                      src={image(item.iconAssetId)}
                      onFile={async (file) => update({ ...item, iconAssetId: await upload(file, "item icon") })}
                    />
                    <Input
                      value={item.code}
                      placeholder="Mã"
                      onChange={(e) => update({ ...item, code: e.target.value })}
                    />
                    <Input
                      value={item.name}
                      placeholder="Tên"
                      onChange={(e) => update({ ...item, name: e.target.value })}
                    />
                    <Input
                      value={item.effect ?? ""}
                      placeholder="Hiệu ứng"
                      onChange={(e) => update({ ...item, effect: e.target.value || null })}
                    />
                    <select
                      className={selectClass}
                      value={item.groupCode ?? ""}
                      onChange={(e) => update({ ...item, groupCode: e.target.value || null })}
                    >
                      <option value="">Không nhóm</option>
                      {content.itemGroups.map((group) => (
                        <option key={group.code} value={group.code}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      value={item.slot ?? ""}
                      placeholder="Ô"
                      onChange={(e) => update({ ...item, slot: e.target.value === "" ? null : Number(e.target.value) })}
                    />
                  </div>
                )}
              />
            </Section>
          </>
        )}
        {tab === "blessings" && (
          <Section title={`Chúc phúc (${content.blessings.length})`}>
            <ListEditor
              rows={content.blessings}
              empty={{ code: "", tier: "NORMAL" as const, name: "", description: null, iconAssetId: null }}
              onChange={(blessings) => setContent({ ...content, blessings })}
              render={(blessing, update) => (
                <div className="grid gap-2 sm:grid-cols-[auto_1fr_1fr_160px]">
                  <IconField
                    src={image(blessing.iconAssetId)}
                    onFile={async (file) => update({ ...blessing, iconAssetId: await upload(file, "blessing icon") })}
                  />
                  <Input
                    value={blessing.code}
                    placeholder="Mã"
                    onChange={(e) => update({ ...blessing, code: e.target.value })}
                  />
                  <Input
                    value={blessing.name}
                    placeholder="Tên"
                    onChange={(e) => update({ ...blessing, name: e.target.value })}
                  />
                  <select
                    className={selectClass}
                    value={blessing.tier}
                    onChange={(e) => update({ ...blessing, tier: e.target.value as typeof blessing.tier })}
                  >
                    <option value="NORMAL">Thường</option>
                    <option value="EPIC">Huyền thoại / Sử thi</option>
                    <option value="LEGENDARY">Truyền thuyết</option>
                  </select>
                  <Textarea
                    className="sm:col-span-4"
                    value={blessing.description ?? ""}
                    onChange={(e) => update({ ...blessing, description: e.target.value || null })}
                  />
                </div>
              )}
            />
          </Section>
        )}
        {tab === "quests" && (
          <Section title="Nhiệm vụ">
            <ListEditor
              rows={content.quests}
              empty={{ code: "", task: "", reward: null }}
              onChange={(quests) => setContent({ ...content, quests })}
              render={(quest, update) => (
                <div className="grid gap-2 sm:grid-cols-[1fr_3fr_1fr]">
                  <Input
                    value={quest.code}
                    placeholder="Mã"
                    onChange={(e) => update({ ...quest, code: e.target.value })}
                  />
                  <Input
                    value={quest.task}
                    placeholder="Nhiệm vụ"
                    onChange={(e) => update({ ...quest, task: e.target.value })}
                  />
                  <Input
                    value={quest.reward ?? ""}
                    placeholder="Phần thưởng"
                    onChange={(e) => update({ ...quest, reward: e.target.value || null })}
                  />
                </div>
              )}
            />
          </Section>
        )}
        {tab === "lineups" && <LineupsEditor content={content} setContent={setContent} />}
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
      const response = await fetch(`${RESOURCES_BASE}${GUIDE_MANIFEST}`)
      if (!response.ok)
        throw new Error("Không đọc được dữ liệu Bách khoa. Chạy Admin bằng pnpm dev để có /__resources/.")
      const manifest = (await response.json()) as GuideManifest
      const unsourced = iconsWithoutSource(manifest)
      if (unsourced.length)
        throw new Error(
          `${unsourced.length} icon chưa có nguồn trong dữ liệu, ví dụ ${unsourced[0]}. Chưa tải ảnh nào.`,
        )
      const paths = guideIconPaths(manifest)
      let done = 0
      const assets = uploaded.current
      await mapLimit(paths, 4, async (path) => {
        if (assets.has(path)) {
          setProgress(`Đã tải ${++done}/${paths.length} ảnh…`)
          return
        }
        const image = await fetch(`${RESOURCES_BASE}${GUIDE_FOLDER}${path}`)
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
  })
  return (
    <Section title="Chưa có cẩm nang">
      <p className="type-body">
        Nhập bản chép Bách khoa 08/11/2026 (lượt 15:03) trong resources: 58 quân cờ, 27 Phe/Nghề, 22 trang bị, 82 chúc
        phúc, 18 nhiệm vụ và 3 đội hình mẫu, cùng 247 icon. Mỗi icon mang nguồn riêng: ảnh thể hiện gì, tệp gốc trong bộ
        thu thập và giờ ghi. Hoặc bắt đầu từ nháp trống. Kết quả là bản nháp để rà soát.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!canWrite || run.isPending} onClick={() => run.mutate(true)}>
          <Download /> Nhập Bách khoa từ resources
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

function IconField({ src, onFile, round }: { src?: string; onFile: (file: File) => Promise<void>; round?: boolean }) {
  const [busy, setBusy] = useState(false)
  return (
    <label
      className="relative inline-flex size-10 cursor-pointer items-center justify-center overflow-hidden rounded-md border bg-muted"
      title="Đổi ảnh"
    >
      {src ? (
        <img src={src} alt="" className={round ? "size-full rounded-full object-cover" : "size-full object-cover"} />
      ) : (
        <Upload className="size-4" />
      )}
      {busy && <span className="absolute inset-0 bg-background/70" />}
      <input
        type="file"
        hidden
        accept="image/png,image/jpeg,image/webp"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (!file) return
          setBusy(true)
          try {
            await onFile(file)
          } finally {
            setBusy(false)
          }
        }}
      />
    </label>
  )
}

interface EditorProps {
  content: GuideContent
  setContent: (content: GuideContent) => void
  image: (id?: string | null) => string | undefined
  upload: (file: File, label: string) => Promise<string>
}

function UnitsEditor({ content, setContent, image, upload }: EditorProps) {
  const [selected, setSelected] = useState(0)
  const [search, setSearch] = useState("")
  const unit = content.units[selected]
  const update = (next: Unit) =>
    setContent({ ...content, units: content.units.map((u, i) => (i === selected ? next : u)) })
  const add = () => {
    setContent({
      ...content,
      units: [
        ...content.units,
        {
          code: "",
          name: "",
          cost: 1,
          traitCodes: [],
          complete: false,
          skill: null,
          stats: null,
          portraitAssetId: null,
        },
      ],
    })
    setSelected(content.units.length)
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Section title={`Quân cờ (${content.units.length})`}>
        <Input placeholder="Tìm…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <ul className="grid max-h-[60vh] gap-1 overflow-y-auto">
          {content.units.map((item, at) =>
            item.name.toLowerCase().includes(search.toLowerCase()) ? (
              <li key={at}>
                <button
                  type="button"
                  className={`type-body flex w-full items-center gap-2 rounded-md p-1 text-left ${at === selected ? "bg-muted" : ""}`}
                  onClick={() => setSelected(at)}
                >
                  {image(item.portraitAssetId) ? (
                    <img src={image(item.portraitAssetId)} alt="" className="size-7 rounded-full" />
                  ) : (
                    <span className="size-7 rounded-full bg-muted" />
                  )}
                  <span className="truncate">{item.name || "(chưa đặt tên)"}</span>
                  <span className="type-meta ml-auto">{item.cost}🪙</span>
                </button>
              </li>
            ) : null,
          )}
        </ul>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          Thêm quân cờ
        </Button>
      </Section>
      {unit && (
        <Section title={unit.name || "Quân cờ mới"}>
          <div className="flex flex-wrap items-end gap-3">
            <IconField
              round
              src={image(unit.portraitAssetId)}
              onFile={async (file) => update({ ...unit, portraitAssetId: await upload(file, "unit portrait") })}
            />
            <label className={field}>
              <span className="type-label">Mã</span>
              <Input value={unit.code} onChange={(e) => update({ ...unit, code: e.target.value })} />
            </label>
            <label className={field}>
              <span className="type-label">Tên</span>
              <Input value={unit.name} onChange={(e) => update({ ...unit, name: e.target.value })} />
            </label>
            <label className={field}>
              <span className="type-label">Giá</span>
              <Input
                type="number"
                min={1}
                max={6}
                value={unit.cost}
                onChange={(e) => update({ ...unit, cost: Number(e.target.value) })}
              />
            </label>
            <label className={field}>
              <span className="type-label">Mã tướng (tùy chọn)</span>
              <Input
                value={unit.heroCode ?? ""}
                onChange={(e) => update({ ...unit, heroCode: e.target.value || null })}
              />
            </label>
            <label className="type-body flex items-center gap-2">
              <input
                type="checkbox"
                checked={unit.complete}
                onChange={(e) => update({ ...unit, complete: e.target.checked })}
              />
              Đủ dữ liệu
            </label>
          </div>
          <div className="grid gap-1">
            <span className="type-label">Phe/Nghề (tối đa 3)</span>
            <div className="flex flex-wrap gap-2">
              {content.traits.map((trait) => (
                <label key={trait.code} className="type-body flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={unit.traitCodes.includes(trait.code)}
                    onChange={(e) =>
                      update({
                        ...unit,
                        traitCodes: e.target.checked
                          ? [...unit.traitCodes, trait.code]
                          : unit.traitCodes.filter((code) => code !== trait.code),
                      })
                    }
                  />
                  {trait.name}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[auto_1fr_1fr]">
            <IconField
              src={image(unit.skill?.iconAssetId)}
              onFile={async (file) =>
                update({ ...unit, skill: { values: [], ...unit.skill, iconAssetId: await upload(file, "skill icon") } })
              }
            />
            <Input
              placeholder="Tên chiêu"
              value={unit.skill?.name ?? ""}
              onChange={(e) => update({ ...unit, skill: { values: [], ...unit.skill, name: e.target.value || null } })}
            />
            <Input
              placeholder="Nhãn giá trị (vd. ST phép)"
              value={unit.skill?.valueLabel ?? ""}
              onChange={(e) =>
                update({ ...unit, skill: { values: [], ...unit.skill, valueLabel: e.target.value || null } })
              }
            />
          </div>
          <Textarea
            placeholder="Mô tả chiêu"
            value={unit.skill?.description ?? ""}
            onChange={(e) =>
              update({ ...unit, skill: { values: [], ...unit.skill, description: e.target.value || null } })
            }
          />
          <label className={field}>
            <span className="type-label">Giá trị chiêu theo 1/2/3 sao, cách nhau bằng “/”</span>
            <Input
              value={unit.skill?.values.join("/") ?? ""}
              onChange={(e) =>
                update({
                  ...unit,
                  skill: {
                    ...unit.skill,
                    values: e.target.value ? e.target.value.split("/").map((v) => v.trim()) : [],
                  },
                })
              }
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {STATS.map(([key, label]) => (
              <label key={key} className={field}>
                <span className="type-label">{label} (1/2/3 sao)</span>
                <Input
                  value={unit.stats?.[key]?.join("/") ?? ""}
                  onChange={(e) =>
                    update({
                      ...unit,
                      stats: {
                        health: [],
                        physicalAttack: [],
                        armor: [],
                        magicResistance: [],
                        ...unit.stats,
                        [key]: e.target.value ? e.target.value.split("/").map((v) => Number(v.trim())) : [],
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
          <label className={field}>
            <span className="type-label">Ghi chú biên tập</span>
            <Input value={unit.note ?? ""} onChange={(e) => update({ ...unit, note: e.target.value || null })} />
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => {
              setContent({ ...content, units: content.units.filter((_, i) => i !== selected) })
              setSelected(0)
            }}
          >
            Xóa quân cờ này
          </Button>
        </Section>
      )}
    </div>
  )
}

function TraitsEditor({ content, setContent, image, upload }: EditorProps) {
  const members = useMemo(() => {
    const map = new Map<string, number>()
    content.units.forEach((unit) => unit.traitCodes.forEach((code) => map.set(code, (map.get(code) ?? 0) + 1)))
    return map
  }, [content.units])
  return (
    <Section title={`Phe/Nghề (${content.traits.length})`}>
      <ListEditor<Trait>
        rows={content.traits}
        empty={{ code: "", kind: "FACTION", name: "", description: null, iconAssetId: null, tiers: [], note: null }}
        onChange={(traits) => setContent({ ...content, traits })}
        render={(trait, update) => (
          <div className="grid gap-2">
            <div className="grid gap-2 sm:grid-cols-[auto_1fr_1fr_140px_auto]">
              <IconField
                round
                src={image(trait.iconAssetId)}
                onFile={async (file) => update({ ...trait, iconAssetId: await upload(file, "trait icon") })}
              />
              <Input value={trait.code} placeholder="Mã" onChange={(e) => update({ ...trait, code: e.target.value })} />
              <Input
                value={trait.name}
                placeholder="Tên"
                onChange={(e) => update({ ...trait, name: e.target.value })}
              />
              <select
                className={selectClass}
                value={trait.kind}
                onChange={(e) => update({ ...trait, kind: e.target.value as Trait["kind"] })}
              >
                <option value="FACTION">Phe</option>
                <option value="CLASS">Nghề</option>
              </select>
              <span className="type-meta self-center">{members.get(trait.code) ?? 0} quân</span>
            </div>
            <ListEditor
              rows={trait.tiers}
              empty={{ count: (trait.tiers.at(-1)?.count ?? 0) + 1, effect: "" }}
              onChange={(tiers) => update({ ...trait, tiers })}
              render={(tier, setTier) => (
                <div className="grid gap-2 sm:grid-cols-[80px_1fr]">
                  <Input
                    type="number"
                    min={1}
                    value={tier.count}
                    onChange={(e) => setTier({ ...tier, count: Number(e.target.value) })}
                  />
                  <Input
                    value={tier.effect}
                    placeholder="Hiệu ứng"
                    onChange={(e) => setTier({ ...tier, effect: e.target.value })}
                  />
                </div>
              )}
            />
            <Input
              value={trait.note ?? ""}
              placeholder="Ghi chú"
              onChange={(e) => update({ ...trait, note: e.target.value || null })}
            />
          </div>
        )}
      />
    </Section>
  )
}

function LineupsEditor({
  content,
  setContent,
}: {
  content: GuideContent
  setContent: (content: GuideContent) => void
}) {
  return (
    <Section title="Đội hình đề xuất">
      <p className="type-meta">
        Mỗi đội hình giữ ID khi tạo nháp mới nên lượt thích không mất. Hạng S/A/B/C là đánh giá biên tập; để trống nếu
        chưa kiểm chứng.
      </p>
      <ListEditor<GuideLineup>
        rows={content.lineups}
        empty={{
          code: "",
          name: "",
          tier: null,
          difficulty: null,
          summary: null,
          units: [],
          emblems: [],
          blessingCodes: [],
          notes: null,
        }}
        onChange={(lineups) => setContent({ ...content, lineups })}
        render={(lineup, update) => (
          <div className="grid gap-2">
            <div className="grid gap-2 sm:grid-cols-4">
              <Input
                value={lineup.code}
                placeholder="Mã"
                onChange={(e) => update({ ...lineup, code: e.target.value })}
              />
              <Input
                value={lineup.name}
                placeholder="Tên"
                onChange={(e) => update({ ...lineup, name: e.target.value })}
              />
              <select
                className={selectClass}
                value={lineup.tier ?? ""}
                onChange={(e) => update({ ...lineup, tier: (e.target.value || null) as GuideLineup["tier"] })}
              >
                <option value="">Chưa xếp hạng</option>
                {["S", "A", "B", "C"].map((tier) => (
                  <option key={tier} value={tier}>
                    Hạng {tier}
                  </option>
                ))}
              </select>
              <select
                className={selectClass}
                value={lineup.difficulty ?? ""}
                onChange={(e) =>
                  update({ ...lineup, difficulty: (e.target.value || null) as GuideLineup["difficulty"] })
                }
              >
                <option value="">Độ khó?</option>
                <option value="EASY">Dễ</option>
                <option value="MEDIUM">Vừa</option>
                <option value="HARD">Khó</option>
              </select>
            </div>
            <Textarea
              value={lineup.summary ?? ""}
              placeholder="Lối chơi"
              onChange={(e) => update({ ...lineup, summary: e.target.value || null })}
            />
            <div className="flex flex-wrap gap-2">
              {content.units.map((unit) => {
                const member = lineup.units.find((item) => item.unitCode === unit.code)
                return (
                  <span
                    key={unit.code}
                    className="type-body inline-flex items-center gap-1 rounded-md border px-2 py-1"
                  >
                    <input
                      type="checkbox"
                      checked={!!member}
                      disabled={!member && lineup.units.length >= 10}
                      onChange={(e) =>
                        update({
                          ...lineup,
                          units: e.target.checked
                            ? [...lineup.units, { unitCode: unit.code, carry: false, row: null, itemCodes: [] }]
                            : lineup.units.filter((item) => item.unitCode !== unit.code),
                        })
                      }
                    />
                    {unit.name}
                    {member && (
                      <button
                        type="button"
                        className={member.carry ? "text-primary" : "text-muted-foreground"}
                        onClick={() =>
                          update({
                            ...lineup,
                            units: lineup.units.map((item) =>
                              item === member ? { ...item, carry: !item.carry } : item,
                            ),
                          })
                        }
                      >
                        {member.carry ? "★ chủ lực" : "☆"}
                      </button>
                    )}
                  </span>
                )
              })}
            </div>
            <Input
              value={lineup.notes ?? ""}
              placeholder="Ghi chú"
              onChange={(e) => update({ ...lineup, notes: e.target.value || null })}
            />
          </div>
        )}
      />
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
