import { UnsavedBar } from "@/components/unsaved-bar"
import {
  BookOpenText,
  Link2,
  Plus,
  Settings2,
  Eye,
  Save,
  RotateCcw,
  FlaskConical,
  Eraser,
  Languages,
  ChevronDown,
  Trash2,
} from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { Tabs, TabsList, TabsTrigger } from "@aov/ui/components/tabs"
import { useIsWide } from "@/hooks/use-media-query"
import { languageOptions } from "../users/profile-preference-picker"
import { memo, useDeferredValue, useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { EntityRichText } from "@aov/ui/components/entity-rich-text"
import {
  managedCommunityReference,
  resolveEntityRoute,
  validateRichTextSettings,
  type EntityReference,
  type RichTextSettings,
} from "@aov/ui/lib/entity-rich-text"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Textarea } from "@aov/ui/components/textarea"
import { useBeforeUnload, useSearchParams } from "react-router"
import { usePageCloseGuard } from "@/app/layout/page-tabs"
import { useReferenceCatalog } from "./catalog"
import { saveSettings, loadLegacySettings } from "./settings-api"
import { ReferenceCatalogTable } from "./reference-catalog-table"
import { EntityRichTextEditor } from "@aov/ui/components/entity-rich-text-editor"
import { useSkillReferences } from "./use-skill-references"
import { useCommunityReferences, useReferenceSearch } from "./use-community-references"
import { EntityReferenceArtwork } from "@aov/ui/components/entity-rich-text"
import { mergeReferenceCatalog, updateHeroAliases } from "./hero-aliases"
import { HeroAliasEditor } from "./hero-alias-editor"
import { invalidateReferenceCatalog } from "./reference-api"

const ReferencePreview = memo(EntityRichText)

export function TerminologyPage() {
  const [params, setParams] = useSearchParams()
  const wide = useIsWide()
  const view = ["terms", "references", "preview", "settings"].includes(params.get("tab") ?? "")
    ? params.get("tab")!
    : "terms"
  function setView(value: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value === "terms") next.delete("tab")
        else next.set("tab", value)
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  }
  const catalog = useReferenceCatalog()
  const client = useQueryClient()
  const [draft, setDraft] = useState<RichTextSettings | null>(null)
  const [selected, setSelectedValue] = useState(
    params.get("entry") ?? (params.get("term") ? `term:${params.get("term")}` : ""),
  )
  function setSelected(value: string) {
    setSelectedValue(value)
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete("term")
        if (value) next.set("entry", value)
        else next.delete("entry")
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  }
  useEffect(() => {
    setSelectedValue(params.get("entry") ?? (params.get("term") ? `term:${params.get("term")}` : ""))
  }, [params])
  const [locale, setLocale] = useState("vi-VN")
  const [preview, setPreview] = useState("")
  const [previewContext, setPreviewContext] = useState<"admin" | "wiki">("admin")
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (draft) setMessage("")
  }, [draft])
  const settings = draft ?? catalog.config
  usePageCloseGuard(() => !saving && (!draft || window.confirm("Bỏ thay đổi thuật ngữ chưa lưu?")))
  useBeforeUnload((event) => {
    if (draft || saving) event.preventDefault()
  })
  const { entities, customKeys, availableKeys, editorEntities, terms, references } = useMemo(() => {
    const entities = new Map(
      mergeReferenceCatalog(catalog.entities, settings.entities, true).map((entity) => [
        `${entity.kind}:${entity.id}`,
        entity,
      ]),
    )
    const customKeys = new Set(settings.entities.map((entity) => `${entity.kind}:${entity.id}`))
    const availableKeys = new Set([
      ...catalog.entities.map((entity) => `${entity.kind}:${entity.id}`),
      ...settings.entities.filter((entity) => entity.kind === "term").map((entity) => `term:${entity.id}`),
    ])
    const entries = [...entities.values()]
    return {
      entities,
      customKeys,
      availableKeys,
      editorEntities: entries.filter((entity) => availableKeys.has(`${entity.kind}:${entity.id}`)),
      terms: entries.filter((entity) => entity.kind === "term"),
      references: entries.filter((entity) => entity.kind !== "term"),
    }
  }, [catalog.entities, settings.entities])
  const entity = entities.get(selected)
  const translation = entity?.translations.find((entry) => entry.locale === locale)
  const searchPreviewReferences = useReferenceSearch(catalog.rulesetId)
  const searchDescriptionReferences = useReferenceSearch(catalog.rulesetId)
  const previewSkills = useSkillReferences(preview, locale, catalog.rulesetId)
  const descriptionSkills = useSkillReferences(translation?.description ?? "", locale, catalog.rulesetId)
  const previewCommunity = useCommunityReferences(preview, locale)
  const descriptionCommunity = useCommunityReferences(translation?.description ?? "", locale)
  const previewEntities = useMemo(
    () => [...editorEntities, ...previewSkills, ...previewCommunity],
    [editorEntities, previewSkills, previewCommunity],
  )
  const descriptionEntities = useMemo(
    () => [...editorEntities, ...descriptionSkills, ...descriptionCommunity],
    [editorEntities, descriptionSkills, descriptionCommunity],
  )
  const previewOutput = useDeferredValue(
    useMemo(() => ({ text: preview, entities: previewEntities }), [preview, previewEntities]),
  )
  const update = (value: EntityReference) =>
    setDraft({
      ...settings,
      entities: [...settings.entities.filter((entry) => `${entry.kind}:${entry.id}` !== selected), value],
    })
  const textField = (key: "name" | "description" | "aliases", value: string) => {
    if (!entity) return
    const next = {
      ...(translation ?? { locale, name: "", description: "", aliases: [] }),
      [key]: key === "aliases" ? value.split("\n").filter(Boolean) : value,
    }
    update({ ...entity, translations: [...entity.translations.filter((entry) => entry.locale !== locale), next] })
  }
  async function persistSettings(value: RichTextSettings) {
    setSaving(true)
    setMessage("")
    try {
      const valid = validateRichTextSettings(value)
      const document = await saveSettings(valid, catalog.settings.data!.version)
      client.setQueryData(["rich-text-settings"], document)
      setDraft(null)
      await invalidateReferenceCatalog(client)
      setMessage("Đã lưu. Admin và wiki dùng chung thiết lập này.")
    } finally {
      setSaving(false)
    }
  }
  async function saveDraft() {
    try {
      await persistSettings(settings)
    } catch (error) {
      setMessage(
        `Chưa lưu: ${error instanceof Error ? error.message : "Request failed"}. Nếu xung đột, tải lại thiết lập trước khi thử lại.`,
      )
    }
  }
  function renderHeroAliasEditor(entity: EntityReference) {
    const canonical =
      entity.kind === "hero"
        ? catalog.catalog.data?.find((candidate) => candidate.kind === "hero" && candidate.id === entity.id)
        : undefined
    return canonical ? (
      <HeroAliasEditor
        canonical={canonical}
        custom={settings.entities.find((candidate) => candidate.kind === "hero" && candidate.id === canonical.id)}
        locale={locale}
        disabled={saving || !catalog.canEdit || !catalog.settings.data || catalog.settings.isError}
        resolveIcon={catalog.resolveIcon}
        onSave={(updates) => persistSettings(updateHeroAliases(settings, canonical, updates))}
      />
    ) : null
  }
  function createTerm() {
    const id = crypto.randomUUID()
    const next: EntityReference = {
      id,
      kind: "term",
      translations: [{ locale, name: "Thuật ngữ mới", aliases: [], description: "" }],
    }
    setDraft({ ...settings, entities: [...settings.entities, next] })
    setSelected(`term:${id}`)
  }
  return (
    <main className="mx-auto w-full min-w-0 max-w-7xl space-y-5 p-4 sm:p-6">
      <fieldset disabled={saving || catalog.settings.isPending} className="contents">
        <header className="min-w-0 space-y-4 border-b pb-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <h1 className="text-xl font-semibold tracking-tight">Thuật ngữ & tham chiếu</h1>
              <p className="text-sm text-muted-foreground">
                Tên gọi, tên gọi khác và cách hiển thị tham chiếu trong nội dung.
              </p>
            </div>
            {(view !== "preview" || draft) && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  aria-label="Tải lại thiết lập"
                  disabled={saving}
                  onClick={async () => {
                    if (!draft || window.confirm("Bỏ thay đổi và tải lại?")) {
                      setDraft(null)
                      await catalog.settings.refetch()
                    }
                  }}
                >
                  <RotateCcw className="size-4" />
                </Button>
              </div>
            )}
          </div>
          <Tabs
            value={view}
            onValueChange={setView}
            className="min-w-0 max-w-full overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <TabsList variant="line" className="h-10! w-max justify-start gap-1 p-0">
              <TabsTrigger value="terms" className="h-9 flex-none gap-1.5 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
                <BookOpenText className="size-4" />
                Thuật ngữ
              </TabsTrigger>
              <TabsTrigger
                value="references"
                aria-label="Tham chiếu danh mục"
                className="h-9 flex-none gap-1.5 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm"
              >
                <Link2 className="size-4" />
                <span>
                  Tham chiếu<span className="hidden sm:inline"> danh mục</span>
                </span>
              </TabsTrigger>
              <TabsTrigger value="preview" className="h-9 flex-none gap-1.5 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
                <Eye className="size-4" />
                Thử hiển thị
              </TabsTrigger>
              <TabsTrigger value="settings" className="h-9 flex-none gap-1.5 px-2 text-xs sm:gap-2 sm:px-3 sm:text-sm">
                <Settings2 className="size-4" />
                Thiết lập
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </header>
        {catalog.catalog.isError && (
          <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm">
            Không tải đủ danh mục. Các mục chưa tải sẽ không được tự nhận diện.
          </p>
        )}
        {catalog.settings.isError && (
          <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm">
            Không tải được thiết lập từ backend. Không thể lưu: {catalog.settings.error.message}
          </p>
        )}
        {view === "settings" && (
          <fieldset
            disabled={!catalog.canEdit || catalog.settings.isError}
            className="max-w-3xl space-y-5 rounded-xl border bg-card p-4 sm:p-5"
          >
            <div>
              <h2 className="font-medium">Nhận diện trong mô tả</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Áp dụng chung cho admin và wiki. Thay đổi có hiệu lực sau khi lưu.
              </p>
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg bg-muted/30 p-3 text-sm">
              <span>Tự liên kết tên và tên gọi khác trong nội dung</span>
              <input
                type="checkbox"
                checked={settings.autoRecognize}
                onChange={(e) => setDraft({ ...settings, autoRecognize: e.target.checked })}
                className="size-4 shrink-0 accent-primary"
              />
            </label>
            <label className="grid gap-2 text-sm">
              Ngôn ngữ dự phòng
              <select
                className="h-10 rounded-lg border bg-background px-3"
                value={settings.fallbackLocale}
                onChange={(e) => setDraft({ ...settings, fallbackLocale: e.target.value })}
              >
                {[...new Set([...languageOptions.map((o) => o.value), settings.fallbackLocale])].map((code) => (
                  <option key={code} value={code}>
                    {languageOptions.find((o) => o.value === code)?.label ?? code}
                  </option>
                ))}
              </select>
            </label>
            <details className="border-t pt-4 text-sm">
              <summary className="cursor-pointer text-muted-foreground">Chuyển thiết lập từ bản cũ</summary>
              <p className="my-3 text-muted-foreground">
                Đọc JSON cũ vào bản nháp để kiểm tra trước khi lưu lên backend. Không xóa dữ liệu cũ.
              </p>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const legacy = await loadLegacySettings()
                    if (!legacy) {
                      setMessage("Không có thiết lập cũ cần chuyển.")
                      return
                    }
                    const merged = new Map(settings.entities.map((e) => [`${e.kind}:${e.id}`, e]))
                    legacy.entities.forEach((e) => merged.set(`${e.kind}:${e.id}`, e))
                    setDraft({ ...legacy, entities: [...merged.values()] })
                    setMessage("Đã đọc thiết lập cũ vào bản nháp. Kiểm tra rồi lưu để dùng chung.")
                  } catch {
                    setMessage("Không đọc được dữ liệu cũ. Chức năng này chỉ có ở môi trường phát triển cũ.")
                  }
                }}
              >
                Đọc thiết lập cũ
              </Button>
            </details>
          </fieldset>
        )}
        {message && (
          <p role="status" className="rounded-xl border bg-muted/30 px-4 py-3 text-sm">
            {message}
          </p>
        )}
        {(view === "terms" || view === "references") && (
          <ReferenceCatalogTable
            key={view}
            variant={view}
            actions={
              <>
                <label className="flex h-9 max-w-full items-center gap-2 rounded-lg border bg-background px-2.5 text-sm">
                  <Languages className="size-4 shrink-0 text-muted-foreground" />
                  <span className="sr-only">Ngôn ngữ hiển thị</span>
                  <select
                    aria-label="Ngôn ngữ danh mục"
                    className="min-w-0 max-w-44 bg-transparent text-xs outline-none"
                    value={locale}
                    onChange={(e) => setLocale(e.target.value)}
                  >
                    {languageOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                {view === "terms" && (
                  <Button size="sm" disabled={!catalog.canEdit} onClick={createTerm}>
                    <Plus className="size-4" />
                    Thêm thuật ngữ
                  </Button>
                )}
              </>
            }
            entities={view === "terms" ? terms : references}
            locale={locale}
            fallbackLocale={settings.fallbackLocale}
            selected={selected}
            onSelect={setSelected}
            customKeys={customKeys}
            availableKeys={availableKeys}
            resolveIcon={catalog.resolveIcon}
            renderAliasAction={renderHeroAliasEditor}
          />
        )}
        <Sheet
          open={!!selected}
          onOpenChange={(open) => {
            if (!open && !saving) setSelected("")
          }}
        >
          <SheetContent
            side={wide ? "right" : "bottom"}
            className={
              wide
                ? "flex w-[min(660px,90vw)] flex-col gap-0 overflow-hidden sm:max-w-none"
                : "flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-t-2xl"
            }
          >
            <SheetHeader className="shrink-0 border-b px-5 py-4 pr-12">
              <SheetTitle className="truncate text-base" title={translation?.name}>
                {translation?.name || (entity?.kind === "term" ? "Biên tập thuật ngữ" : "Thiết lập tham chiếu")}
              </SheetTitle>
              <SheetDescription>
                {entity?.kind === "term"
                  ? "Tên gọi và định nghĩa theo ngôn ngữ."
                  : "Tên hiển thị, nhận diện và phần giới thiệu trong tham chiếu."}
              </SheetDescription>
            </SheetHeader>
            <fieldset
              disabled={saving || catalog.settings.isPending || !catalog.canEdit || catalog.settings.isError}
              className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 [&_[data-slot=entity-reference-input]]:min-h-40"
            >
              {entity && managedCommunityReference(entity.kind) ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <EntityReferenceArtwork entity={entity} className="size-12" />
                    <div>
                      <h3 className="font-semibold">{translation?.name ?? entity.id}</h3>
                      <p className="text-sm text-muted-foreground">{translation?.description}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Mục này lấy từ danh mục {entity.kind === "country" ? "quốc gia / khu vực" : "giải đấu"}. Bạn có thể
                    chọn để gắn tham chiếu trong mô tả; tên và logo được quản lý tại dữ liệu gốc.
                  </p>
                  {entity.kind !== "country" && (
                    <a
                      className="inline-flex items-center gap-2 text-sm underline underline-offset-4"
                      href={resolveEntityRoute(entity, "admin", locale)}
                    >
                      Mở dữ liệu gốc
                    </a>
                  )}
                </div>
              ) : entity ? (
                <>
                  <label className="grid gap-1.5 text-sm">
                    Ngôn ngữ bản dịch
                    <select
                      className="h-10 rounded-lg border bg-background px-3"
                      value={locale}
                      onChange={(e) => setLocale(e.target.value)}
                      aria-label="Ngôn ngữ bản dịch"
                    >
                      {[
                        ...new Set([
                          ...languageOptions.map((o) => o.value),
                          ...entity.translations.map((t) => t.locale),
                        ]),
                      ].map((code) => (
                        <option key={code} value={code}>
                          {languageOptions.find((o) => o.value === code)?.label ?? code} · {code}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Bản dịch hiện có">
                    {entity.translations.map((text) => (
                      <button
                        key={text.locale}
                        type="button"
                        aria-pressed={text.locale === locale}
                        onClick={() => setLocale(text.locale)}
                        className={`rounded-md px-2 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring ${text.locale === locale ? "bg-primary/10 font-medium text-primary" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}
                      >
                        {text.locale}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-destructive"
                    disabled={entity.kind === "hero" || !translation || entity.translations.length < 2}
                    onClick={() =>
                      update({ ...entity, translations: entity.translations.filter((text) => text.locale !== locale) })
                    }
                  >
                    Xóa bản dịch {locale}
                  </Button>
                  <label className="grid gap-2 text-sm font-medium">
                    {entity.kind === "term" ? "Tên thuật ngữ" : "Tên hiển thị trong tham chiếu"}{" "}
                    <Input
                      className="h-10 text-base font-normal shadow-none"
                      value={translation?.name ?? ""}
                      readOnly={entity.kind === "hero"}
                      onChange={(e) => textField("name", e.target.value)}
                    />
                  </label>
                  {entity.kind === "hero" ? (
                    renderHeroAliasEditor(entity)
                  ) : (
                    <label className="grid gap-2 text-sm font-medium">
                      Tên gọi khác (mỗi dòng một tên)
                      <Textarea
                        rows={3}
                        className="min-h-20 resize-y font-normal shadow-none"
                        value={translation?.aliases.join("\n") ?? ""}
                        onChange={(e) => textField("aliases", e.target.value)}
                      />
                    </label>
                  )}
                  {entity.kind === "hero" ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Tên và giới thiệu lấy từ dữ liệu tướng gốc.</p>
                      <div className="max-h-40 overflow-auto rounded-lg border p-3 text-sm">
                        <ReferencePreview
                          text={translation?.description ?? ""}
                          entities={descriptionEntities}
                          locale={locale}
                          fallbackLocale={settings.fallbackLocale}
                          autoRecognize={settings.autoRecognize}
                          context="admin"
                          resolveIcon={catalog.resolveIcon}
                        />
                      </div>
                    </div>
                  ) : (
                    <EntityRichTextEditor
                      key={`${selected}:${locale}`}
                      label={entity.kind === "term" ? "Định nghĩa thuật ngữ" : "Giới thiệu ngắn khi xem tham chiếu"}
                      maxLength={4000}
                      value={translation?.description ?? ""}
                      onChange={(value) => textField("description", value)}
                      entities={descriptionEntities}
                      locale={locale}
                      fallbackLocale={settings.fallbackLocale}
                      autoRecognize={settings.autoRecognize}
                      resolveIcon={catalog.resolveIcon}
                      searchReferences={searchDescriptionReferences}
                    />
                  )}
                  <details className="group space-y-3 border-t pt-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                      Hiển thị & nhận diện
                      <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <label className="block">
                      Ảnh biểu tượng
                      <Input
                        value={entity.icon ?? ""}
                        onChange={(e) => update({ ...entity, icon: e.target.value || null })}
                      />
                    </label>
                    <label className="block">
                      Màu chữ
                      <Input
                        placeholder="#2563eb"
                        value={entity.display?.color ?? ""}
                        onChange={(e) =>
                          update({ ...entity, display: { ...entity.display, color: e.target.value || undefined } })
                        }
                      />
                    </label>
                    <div className="flex gap-4">
                      <label>
                        <input
                          type="checkbox"
                          checked={entity.display?.underline !== false}
                          onChange={(e) =>
                            update({ ...entity, display: { ...entity.display, underline: e.target.checked } })
                          }
                        />{" "}
                        Gạch dưới
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={entity.display?.showIcon !== false}
                          onChange={(e) =>
                            update({ ...entity, display: { ...entity.display, showIcon: e.target.checked } })
                          }
                        />{" "}
                        Hiện icon
                      </label>
                    </div>
                    <div className="space-y-2 rounded-lg bg-muted/30 p-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={entity.autoMatch ?? ["hero", "term"].includes(entity.kind)}
                          onChange={(event) => update({ ...entity, autoMatch: event.target.checked })}
                        />
                        Tự nhận diện tên trong mô tả
                      </label>
                      <p className="text-xs leading-5 text-muted-foreground">
                        {entity.kind === "item"
                          ? "Trang bị mặc định chỉ liên kết khi chọn @, tránh nhầm tên vật phẩm với lời mô tả như “phi tiêu”. Chỉ bật nếu tên và alias đủ rõ nghĩa."
                          : "Tắt nếu tên hoặc alias dễ nhầm với từ thông thường. Bạn vẫn có thể chọn @ để gắn tham chiếu chính xác."}
                      </p>
                    </div>
                  </details>
                  <details className="group space-y-3 border-t pt-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                      Liên kết tham chiếu
                      <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    {(["admin", "wiki"] as const).map((context) => (
                      <label key={context} className="block">
                        Trang mở trong {context === "admin" ? "Admin" : "Wiki"}
                        <Input
                          placeholder="Tự chọn theo danh mục"
                          value={entity.destinations?.[context] ?? ""}
                          onChange={(e) =>
                            update({
                              ...entity,
                              destinations: { ...entity.destinations, [context]: e.target.value || undefined },
                            })
                          }
                        />
                      </label>
                    ))}
                  </details>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      setDraft({
                        ...settings,
                        entities: settings.entities.filter((entry) => `${entry.kind}:${entry.id}` !== selected),
                      })
                      setSelected("")
                    }}
                  >
                    <Trash2 className="size-4" />
                    {entity.kind === "term" ? "Xóa thuật ngữ" : "Xóa tùy chỉnh, dùng danh mục gốc"}
                  </Button>
                </>
              ) : (
                <p>Chọn tướng, trang bị hoặc tạo thuật ngữ để chỉnh sửa tên và cách hiển thị.</p>
              )}
            </fieldset>
            <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-background px-5 py-4">
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {draft ? "Có thay đổi chưa lưu" : "Chưa có thay đổi"}
              </span>
              <Button
                disabled={!draft || saving || !catalog.settings.data || !catalog.canEdit || catalog.settings.isError}
                onClick={saveDraft}
              >
                <Save className="size-4" />
                Lưu thay đổi
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        {view === "preview" && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Thử nội dung và tham chiếu; đoạn thử không được lưu vào dữ liệu game.
              </p>
              <label className="flex items-center gap-2 text-sm">
                Ngôn ngữ
                <select
                  aria-label="Ngôn ngữ thử hiển thị"
                  className="h-9 rounded-lg border bg-background px-2"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                >
                  {languageOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]">
              <div className="min-w-0 space-y-4 rounded-xl border bg-card p-4 sm:p-5 [&_[data-slot=entity-reference-input]]:min-h-56">
                <div className="flex items-center justify-between gap-2 border-b pb-3">
                  <h2 className="text-sm font-semibold">Soạn nội dung thử</h2>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() =>
                        setPreview(
                          "Gây <b>sát thương phép</b> và làm chậm mục tiêu. Nhận <color=#16a34a>lá chắn</color> khi sử dụng chiêu.",
                        )
                      }
                    >
                      <FlaskConical className="size-4" />
                      Ví dụ
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-muted-foreground"
                      aria-label="Xóa nội dung thử"
                      disabled={!preview}
                      onClick={() => setPreview("")}
                    >
                      <Eraser className="size-4" />
                    </Button>
                  </div>
                </div>
                <EntityRichTextEditor
                  label="Nội dung thử"
                  value={preview}
                  onChange={setPreview}
                  entities={previewEntities}
                  locale={locale}
                  fallbackLocale={settings.fallbackLocale}
                  autoRecognize={settings.autoRecognize}
                  resolveIcon={catalog.resolveIcon}
                  searchReferences={searchPreviewReferences}
                  renderPreview={false}
                  hideLabel
                />
              </div>
              <div className="min-w-0 rounded-xl border bg-card p-4 sm:p-5 xl:sticky xl:top-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                  <h2 className="text-sm font-semibold">Kết quả hiển thị</h2>
                  <div role="group" aria-label="Đích mở tham chiếu" className="flex rounded-lg bg-muted/60 p-0.5">
                    {(["wiki", "admin"] as const).map((context) => (
                      <Button
                        key={context}
                        size="sm"
                        className="h-7 px-2.5 text-xs"
                        variant={previewContext === context ? "secondary" : "ghost"}
                        aria-pressed={previewContext === context}
                        onClick={() => setPreviewContext(context)}
                      >
                        {context === "wiki" ? "Wiki" : "Admin"}
                      </Button>
                    ))}
                  </div>
                </div>
                {previewOutput.text ? (
                  <div className="min-h-56 whitespace-pre-wrap break-words text-sm leading-8">
                    <ReferencePreview
                      text={previewOutput.text}
                      entities={previewOutput.entities}
                      locale={locale}
                      fallbackLocale={settings.fallbackLocale}
                      autoRecognize={settings.autoRecognize}
                      context={previewContext}
                      resolveIcon={catalog.resolveIcon}
                    />
                  </div>
                ) : (
                  <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                      <Eye className="size-5" />
                    </span>
                    <p className="max-w-56 text-sm leading-6 text-muted-foreground">
                      Nhập nội dung hoặc chọn Ví dụ để thử.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </fieldset>
      {draft && (
        <UnsavedBar
          count={1}
          message="Có thay đổi chưa lưu"
          busy={saving}
          saveDisabled={!catalog.settings.data || !catalog.canEdit}
          onSave={() => void saveDraft()}
        />
      )}
    </main>
  )
}
