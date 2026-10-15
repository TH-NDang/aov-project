import { useEffect, useState } from "react"
import { Link, useBeforeUnload, useParams } from "react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@aov/ui/components/button"
import { Badge } from "@aov/ui/components/badge"
import { Page, PageHeader } from "@/components/page-header"
import { backendRequest } from "@/app/auth/session"
import { useSession } from "@/app/auth/auth-gate"
import { errorMessage } from "@/lib/api/errors"
import type { Hero } from "@/lib/api/types"
import { createPublishingApi } from "./publishing-api"
import { Box, Field, control } from "./fields"
import { PatchChangeForm } from "./patch-change-form"
import { PatchSetup } from "./patch-setup"
import { SectionEditor, emptySection } from "./section-editor"
import { resourceContent } from "./resource-import"
import { SECTIONS, publishIssues, type Cause, type Content, type Preview, type Revision, type Section } from "./types"
const api = createPublishingApi(backendRequest)
const CAUSES: Record<Cause, string> = {
  CONTENT_CORRECTION: "Sửa nội dung",
  GAME_PATCH: "Cập nhật gameplay",
  TRANSLATION: "Bản dịch",
  IMPORT_CORRECTION: "Sửa dữ liệu nhập",
  VISUAL_UPDATE: "Thay artwork",
  OTHER: "Khác",
}

export function PublishingPage() {
  const { heroId = "" } = useParams()
  return <PublishingWorkspace key={heroId} heroId={heroId} />
}

function PublishingWorkspace({ heroId }: { heroId: string }) {
  const queryClient = useQueryClient()
  const capabilities = useSession().actor?.capabilities ?? []
  const canWrite = capabilities.includes("hero:write")
  const canPublish = capabilities.includes("hero:publish")
  const [page, setPage] = useState(0)
  const [ruleset, setRuleset] = useState("")
  const [locale, setLocale] = useState("vi-VN")
  const [selectedId, setSelectedId] = useState("")
  const [preview, setPreview] = useState<Preview | null>(null)
  const [section, setSection] = useState<Section>("PROFILE")
  const [dirty, setDirty] = useState<Set<Section>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [note, setNote] = useState("")
  const [cause, setCause] = useState<Cause>("CONTENT_CORRECTION")
  const [variant, setVariant] = useState("")
  const [resourceId, setResourceId] = useState("")
  const [showResources, setShowResources] = useState(false)
  const [showContext, setShowContext] = useState(false)
  const rulesets = useQuery({ queryKey: ["publishing-rulesets"], queryFn: api.rulesets })
  const regions = useQuery({ queryKey: ["publishing-regions"], queryFn: api.regions })
  const heroes = useQuery({ queryKey: ["publishing-heroes", page], queryFn: () => api.heroes(page) })
  const revisions = useQuery({
    queryKey: ["publishing-revisions", heroId],
    queryFn: () => api.revisions(heroId),
    enabled: !!heroId,
  })
  const read = useQuery({
    queryKey: ["publishing-preview", heroId, selectedId],
    queryFn: () => api.read(heroId, selectedId),
    enabled: !!heroId && !!selectedId,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })
  const resources = useQuery({
    queryKey: ["publishing-resources"],
    queryFn: async () => {
      const response = await fetch("/__resources/data/heroes.json", { cache: "no-store" })
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json"))
        throw new Error("Nhập tài nguyên cần Vite dev/preview và thư mục resources/Lien-Quan-v3.")
      return ((await response.json()) as { heroes: Hero[] }).heroes
    },
    enabled: showResources,
  })
  const resource = resources.data?.find((h) => h.id === resourceId)
  useEffect(() => {
    setSelectedId("")
    setPreview(null)
    setDirty(new Set())
    setResourceId("")
    setError("")
  }, [heroId])
  useEffect(() => {
    if (!selectedId && revisions.data?.length) {
      const candidates = revisions.data.filter((r) => !ruleset || r.rulesetId === ruleset)
      const chosen =
        candidates.find((r) => r.state === "DRAFT") ?? candidates.find((r) => r.state === "PUBLISHED") ?? candidates[0]
      if (chosen) setSelectedId(chosen.id)
    }
  }, [revisions.data, ruleset, selectedId])
  useEffect(() => {
    if (read.data && !dirty.size && !busy) {
      setPreview(structuredClone(read.data))
      setDirty(new Set())
    }
  }, [read.data])
  useBeforeUnload((event) => {
    if (dirty.size || busy) {
      event.preventDefault()
      event.returnValue = ""
    }
  })
  const revision = preview?.revision
  const writable = canWrite && revision?.state === "DRAFT"
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    setError("")
    setMessage("")
    try {
      await action()
      setMessage(success)
      await queryClient.invalidateQueries({ queryKey: ["publishing-heroes"] })
      await revisions.refetch()
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  async function openRevision(r: Revision) {
    const data = await api.read(r.heroId, r.id)
    queryClient.setQueryData(["publishing-preview", r.heroId, r.id], data)
    setPreview(data)
    setSelectedId(r.id)
    setDirty(new Set())
  }
  const update = (value: NonNullable<Content[Section]>) => {
    if (!preview) return
    setPreview((current) => (current ? { ...current, content: { ...current.content, [section]: value } } : current))
    setDirty((current) => new Set([...current, section]))
  }
  return (
    <Page>
      <PageHeader
        title="Biên tập và xuất bản tướng"
        description="Draft, lịch sử phiên bản và dữ liệu công khai từ wiki-service."
        actions={
          <Button variant="outline" onClick={() => setShowContext(!showContext)}>
            Gameplay context
          </Button>
        }
      />
      {showContext && <PatchSetup rulesets={rulesets.data ?? []} regions={regions.data ?? []} />}
      {[rulesets.error, regions.error, heroes.error, revisions.error, read.error].filter(Boolean).map((error, i) => (
        <p key={i} role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
          {errorMessage(error)}
        </p>
      ))}
      {error && (
        <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
          <p>{error}</p>
          <p>
            Bản đang sửa được giữ nguyên. Nếu có xung đột phiên bản, dùng “Bỏ chỉnh sửa và tải bản mới”, rồi nhập lại
            phần thay đổi.
          </p>
        </div>
      )}
      {message && (
        <p role="status" className="rounded-lg border border-emerald-500/30 p-3 text-sm">
          {message}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Ruleset
          <select
            className={control}
            value={ruleset}
            disabled={dirty.size > 0 || busy}
            onChange={(e) => {
              setRuleset(e.target.value)
              setSelectedId("")
              setPreview(null)
            }}
          >
            <option value="">Tất cả ruleset</option>
            {rulesets.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code}
              </option>
            ))}
          </select>
        </label>
        <Field label="Ngôn ngữ nhập mới" value={locale} onChange={setLocale} />
      </div>
      {!heroId ? (
        <>
          {canWrite && (
            <Box title="Tạo tướng">
              <form
                className="grid items-end gap-3 sm:grid-cols-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  const f = new FormData(e.currentTarget)
                  void run(async () => {
                    const r = await api.create(String(f.get("code")), String(f.get("name")), locale, ruleset)
                    setMessage(`Đã tạo draft ${r.id}`)
                  }, "Đã tạo tướng. Mở tướng bên dưới để nhập nội dung.")
                }}
              >
                <label className="grid gap-1 text-sm">
                  Mã tướng
                  <input className={control} name="code" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
                </label>
                <label className="grid gap-1 text-sm">
                  Tên tướng
                  <input className={control} name="name" required />
                </label>
                <Button disabled={!ruleset || busy}>Tạo draft</Button>
              </form>
              {!ruleset && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Chọn ruleset trước khi tạo. Nếu chưa có ruleset, mở Gameplay context.
                </p>
              )}
            </Box>
          )}
          <Box title="Danh mục backend">
            {heroes.isPending ? (
              <p role="status">Đang tải…</p>
            ) : !heroes.data?.items.length ? (
              <p>Chưa có tướng trong backend. Tạo draft để bắt đầu nhập dữ liệu.</p>
            ) : (
              <ul className="divide-y">
                {heroes.data.items.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <Link className="font-medium underline underline-offset-4" to={`/publishing/${h.id}`}>
                      {h.code}
                    </Link>
                    <div className="flex gap-2">
                      {h.revisions
                        .filter((r) => !ruleset || r.rulesetId === ruleset)
                        .map((r) => (
                          <Badge key={r.id} variant={r.state === "PUBLISHED" ? "default" : "outline"}>
                            #{r.revisionNo} {r.state}
                          </Badge>
                        ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex gap-2">
              <Button variant="outline" disabled={!page || busy} onClick={() => setPage(page - 1)}>
                Trước
              </Button>
              <span>Trang {page + 1}</span>
              <Button
                variant="outline"
                disabled={!heroes.data || (page + 1) * 20 >= heroes.data.totalElements || busy}
                onClick={() => setPage(page + 1)}
              >
                Sau
              </Button>
            </div>
          </Box>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" asChild>
              <Link to="/publishing">Danh mục backend</Link>
            </Button>
            <label className="flex min-w-60 flex-1 items-center gap-2 text-sm">
              Phiên bản
              <select
                className={control}
                value={selectedId}
                disabled={!!dirty.size || busy}
                onChange={(e) => {
                  setPreview(null)
                  setSelectedId(e.target.value)
                }}
              >
                {revisions.data
                  ?.filter((r) => !ruleset || r.rulesetId === ruleset)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      #{r.revisionNo} · {r.state} · v{r.version} ·{" "}
                      {rulesets.data?.find((s) => s.id === r.rulesetId)?.code}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {(read.isFetching || revisions.isPending) && <p role="status">Đang tải phiên bản…</p>}
          {preview && revision && (
            <>
              <Box title={`Phiên bản #${revision.revisionNo}`}>
                <div className="flex flex-wrap gap-2">
                  <Badge>{revision.state}</Badge>
                  <Badge variant="outline">v{revision.version}</Badge>
                  <span className="text-sm">{CAUSES[revision.cause]}</span>
                </div>
                <p className="break-all font-mono text-xs text-muted-foreground">
                  {heroId} / {revision.id}
                </p>
                {revision.state === "PUBLISHED" && canWrite && (
                  <form
                    className="grid items-end gap-3 sm:grid-cols-3"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void run(
                        async () =>
                          openRevision(await api.fork(revision, cause, cause === "GAME_PATCH" ? variant : null)),
                        "Đã tạo draft kế thừa các section.",
                      )
                    }}
                  >
                    <label className="grid gap-1 text-sm">
                      Lý do tạo bản mới
                      <select className={control} value={cause} onChange={(e) => setCause(e.target.value as Cause)}>
                        {Object.entries(CAUSES).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {cause === "GAME_PATCH" && (
                      <Field label="Patch variant ID" required value={variant} onChange={setVariant} />
                    )}
                    <Button disabled={busy}>Tạo draft từ bản này</Button>
                  </form>
                )}
                {revision.state === "PUBLISHED" && (
                  <a
                    className="inline-block text-sm underline"
                    href={`${import.meta.env.VITE_WIKI_URL || "http://localhost:5173"}/?hero=${heroId}&region=VN&locale=${encodeURIComponent(locale)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Xem trên wiki (bản đang hiệu lực tại VN)
                  </a>
                )}
              </Box>
              {writable && (
                <Box title="Nhập từ tài nguyên">
                  <Button variant="outline" onClick={() => setShowResources(!showResources)}>
                    {showResources ? "Đóng danh mục" : "Mở danh mục resources"}
                  </Button>
                  {showResources && (
                    <div className="space-y-3">
                      {resources.isError && <p role="alert">{errorMessage(resources.error)}</p>}
                      <label className="grid gap-1 text-sm">
                        Tướng nguồn
                        <select className={control} value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
                          <option value="">Chọn tướng để đối chiếu</option>
                          {resources.data?.map((h) => (
                            <option value={h.id} key={h.id}>
                              {h.name} · {h.id}
                            </option>
                          ))}
                        </select>
                      </label>
                      {resource && (
                        <>
                          <p className="text-sm text-muted-foreground">
                            Chỉ nhập tên, kỹ năng và danh sách trang phục đã ghi nhận. Nội dung thiếu vẫn để trống; bạn
                            cần bổ sung vai trò và mô tả trước khi lưu. Ảnh được chọn trong từng section, chưa tự tải
                            hàng loạt.
                          </p>
                          <Button
                            disabled={busy || !!dirty.size}
                            onClick={() => {
                              setPreview({
                                ...preview,
                                content: { ...preview.content, ...resourceContent(resource, locale) },
                              })
                              setDirty(new Set(["PROFILE", "SKILLS", "SKINS"]))
                            }}
                          >
                            Điền vào biểu mẫu
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </Box>
              )}
              <div className="flex flex-wrap gap-2" aria-label="Các phần nội dung">
                {SECTIONS.map(([key, , label]) => (
                  <Button key={key} variant={section === key ? "default" : "outline"} onClick={() => setSection(key)}>
                    {label}
                    {dirty.has(key) ? " *" : ""}
                  </Button>
                ))}
              </div>
              <Box title={SECTIONS.find((s) => s[0] === section)![2]}>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void run(async () => {
                      const next = await api.save(
                        revision,
                        section,
                        preview.content[section] ?? emptySection(section, locale),
                        note,
                      )
                      queryClient.setQueryData(
                        ["publishing-preview", heroId, revision.id],
                        await api.read(heroId, revision.id),
                      )
                      setPreview({
                        ...preview,
                        revision: next,
                        content: {
                          ...preview.content,
                          [section]: preview.content[section] ?? emptySection(section, locale),
                        },
                      })
                      setDirty(new Set([...dirty].filter((s) => s !== section)))
                    }, "Đã lưu section vào draft.")
                  }}
                >
                  <fieldset disabled={!writable || busy || read.isFetching} className="space-y-4">
                    <SectionEditor
                      section={section}
                      value={preview.content[section]}
                      locale={locale}
                      onChange={update}
                      resource={resource}
                    />
                    <Field label="Ghi chú thay đổi" value={note} onChange={setNote} />
                    {writable && <Button>Lưu phần này</Button>}
                  </fieldset>
                </form>
              </Box>
              {revision.state === "PUBLISHED" &&
                revision.cause === "GAME_PATCH" &&
                revision.effectiveFromPatchVariantId &&
                capabilities.includes("patch:write") && (
                  <PatchChangeForm key={revision.id} revision={revision} locale={locale} />
                )}
              <Box title="Kiểm tra trước khi xuất bản">
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {publishIssues(preview.content).map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
                {!publishIssues(preview.content).length && (
                  <p className="text-sm">
                    Đã có đủ sáu phần. Backend sẽ kiểm tra chi tiết dữ liệu và media khi publish.
                  </p>
                )}
                {dirty.size > 0 && (
                  <p className="text-sm text-amber-600">
                    Còn {dirty.size} phần chưa lưu. Lưu từng phần trước khi publish.
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  {revision.state === "DRAFT" && canPublish && (
                    <Button
                      disabled={busy || !!dirty.size || !!publishIssues(preview.content).length}
                      onClick={() =>
                        void run(
                          async () => openRevision(await api.publish(revision, note)),
                          "Đã publish. Wiki sẽ hiện bản mới khi gameplay context có hiệu lực.",
                        )
                      }
                    >
                      Publish tướng
                    </Button>
                  )}
                  {writable && (
                    <Button
                      variant="outline"
                      disabled={busy || !!dirty.size}
                      onClick={() => void run(async () => openRevision(await api.discard(revision)), "Đã hủy draft.")}
                    >
                      Hủy draft
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await queryClient.invalidateQueries({ queryKey: ["publishing-preview", heroId, selectedId] })
                        const fresh = await api.read(heroId, selectedId)
                        setPreview(fresh)
                        setDirty(new Set())
                      }, "Đã tải lại phiên bản từ backend.")
                    }
                  >
                    Bỏ chỉnh sửa và tải bản mới
                  </Button>
                </div>
              </Box>
            </>
          )}
        </>
      )}
    </Page>
  )
}
