import { BookOpenText, Link2, Plus, Settings2, Eye, Save, RotateCcw, FlaskConical, Eraser } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { Tabs, TabsList, TabsTrigger } from "@aov/ui/components/tabs"
import { useIsWide } from "@/hooks/use-media-query"
import { languageOptions } from "../users/profile-preference-picker"
import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { EntityRichText } from "@aov/ui/components/entity-rich-text"
import { validateRichTextSettings, type EntityReference, type RichTextSettings } from "@aov/ui/lib/entity-rich-text"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Textarea } from "@aov/ui/components/textarea"
import { useBeforeUnload, useSearchParams } from "react-router"
import { usePageCloseGuard } from "@/app/layout/page-tabs"
import { useReferenceCatalog } from "./catalog"
import { saveSettings, loadLegacySettings } from "./settings-api"
import { ReferenceCatalogTable } from "./reference-catalog-table"
import { EntityRichTextEditor } from "@aov/ui/components/entity-rich-text-editor"

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
  const entities = new Map(catalog.entities.map((entity) => [`${entity.kind}:${entity.id}`, entity]))
  for (const entity of settings.entities) {
    const key = `${entity.kind}:${entity.id}`
    entities.set(key, { ...entity, iconAssetId: entities.get(key)?.iconAssetId })
  }
  const customKeys = new Set(settings.entities.map((entity) => `${entity.kind}:${entity.id}`))
  const availableKeys = new Set([
    ...catalog.entities.map((entity) => `${entity.kind}:${entity.id}`),
    ...settings.entities.filter((entity) => entity.kind === "term").map((entity) => `term:${entity.id}`),
  ])
  const editorEntities = [...entities.values()].filter((entity) => availableKeys.has(`${entity.kind}:${entity.id}`))
  const entity = entities.get(selected)
  const translation = entity?.translations.find((entry) => entry.locale === locale)
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
  async function saveDraft() {
    setSaving(true)
    setMessage("")
    try {
      const valid = validateRichTextSettings(settings)
      const document = await saveSettings(valid, catalog.settings.data!.version)
      client.setQueryData(["rich-text-settings"], document)
      setDraft(null)
      setMessage("Đã lưu. Admin và wiki dùng chung thiết lập này.")
    } catch (error) {
      setMessage(
        `Chưa lưu: ${error instanceof Error ? error.message : "Request failed"}. Nếu xung đột, tải lại thiết lập trước khi thử lại.`,
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <main className="mx-auto w-full min-w-0 max-w-6xl space-y-5 p-4 sm:p-6">
      <fieldset disabled={saving || catalog.settings.isPending} className="contents">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">Thuật ngữ & tham chiếu</h1>
            {(view !== "preview" || draft) && (
              <div className="flex items-center gap-2">
                {draft && <span className="text-xs text-amber-600">Chưa lưu</span>}
                <Button
                  variant="ghost"
                  size="icon"
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
                <Button disabled={!draft || saving || !catalog.settings.data || !catalog.canEdit} onClick={saveDraft}>
                  <Save className="size-4" />
                  {saving ? "Đang lưu…" : "Lưu thay đổi"}
                </Button>
              </div>
            )}
          </div>
          <Tabs value={view} onValueChange={setView}>
            <TabsList className="flex h-auto flex-wrap justify-start group-data-[orientation=horizontal]/tabs:h-auto">
              <TabsTrigger value="terms">
                <BookOpenText className="size-4" />
                Thuật ngữ
              </TabsTrigger>
              <TabsTrigger value="references">
                <Link2 className="size-4" />
                Tham chiếu danh mục
              </TabsTrigger>
              <TabsTrigger value="preview">
                <Eye className="size-4" />
                Thử hiển thị
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Settings2 className="size-4" />
                Thiết lập
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {catalog.catalog.isError && (
          <p role="alert">Không tải đủ danh mục. Các mục chưa tải sẽ không được tự nhận diện.</p>
        )}
        {catalog.settings.isError && (
          <p role="alert">Không tải được thiết lập từ backend. Không thể lưu: {catalog.settings.error.message}</p>
        )}
        {view === "settings" && (
          <fieldset
            disabled={!catalog.canEdit || catalog.settings.isError}
            className="max-w-2xl space-y-5 rounded-xl border p-5"
          >
            <div>
              <h2 className="font-medium">Nhận diện trong mô tả</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Áp dụng chung cho admin và wiki. Thay đổi có hiệu lực sau khi lưu.
              </p>
            </div>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={settings.autoRecognize}
                onChange={(e) => setDraft({ ...settings, autoRecognize: e.target.checked })}
              />
              Tự liên kết tên và tên gọi khác trong nội dung
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
        {message && <p role="status">{message}</p>}
        {(view === "terms" || view === "references") && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              Ngôn ngữ hiển thị
              <select
                aria-label="Ngôn ngữ danh mục"
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
            {view === "terms" && (
              <>
                {" "}
                <Button
                  variant="outline"
                  onClick={() => {
                    const id = crypto.randomUUID()
                    const next: EntityReference = {
                      id,
                      kind: "term",
                      translations: [{ locale, name: "Thuật ngữ mới", aliases: [], description: "" }],
                    }
                    setDraft({ ...settings, entities: [...settings.entities, next] })
                    setSelected(`term:${id}`)
                  }}
                >
                  <Plus className="size-4" />
                  Thêm thuật ngữ
                </Button>
              </>
            )}
          </div>
        )}
        {(view === "terms" || view === "references") && (
          <ReferenceCatalogTable
            key={view}
            entities={[...entities.values()].filter((entity) =>
              view === "terms" ? entity.kind === "term" : entity.kind !== "term",
            )}
            locale={locale}
            fallbackLocale={settings.fallbackLocale}
            selected={selected}
            onSelect={setSelected}
            customKeys={customKeys}
            availableKeys={availableKeys}
            resolveIcon={catalog.resolveIcon}
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
                ? "flex w-[min(620px,90vw)] flex-col overflow-y-auto sm:max-w-none"
                : "flex max-h-[92dvh] flex-col overflow-y-auto rounded-t-2xl"
            }
          >
            <SheetHeader className="pr-8">
              <SheetTitle>{entity?.kind === "term" ? "Biên tập thuật ngữ" : "Thiết lập tham chiếu"}</SheetTitle>
              <SheetDescription>
                {entity?.kind === "term"
                  ? "Định nghĩa, tên và các cách gọi theo từng ngôn ngữ."
                  : "Tùy chỉnh cách nhận diện và phần giới thiệu. Dữ liệu gameplay vẫn thuộc danh mục gốc."}
              </SheetDescription>
            </SheetHeader>
            <fieldset
              disabled={saving || catalog.settings.isPending || !catalog.canEdit || catalog.settings.isError}
              className="space-y-4 px-4 pb-6"
            >
              {entity ? (
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
                  <p className="text-xs text-muted-foreground">
                    Có bản dịch: {entity.translations.map((text) => text.locale).join(", ")}. Chọn ngôn ngữ khác để thêm
                    bản dịch.
                  </p>
                  <Button
                    variant="outline"
                    disabled={!translation || entity.translations.length < 2}
                    onClick={() =>
                      update({ ...entity, translations: entity.translations.filter((text) => text.locale !== locale) })
                    }
                  >
                    Xóa bản dịch {locale}
                  </Button>
                  <label className="block">
                    {entity.kind === "term" ? "Tên thuật ngữ" : "Tên hiển thị trong tham chiếu"}{" "}
                    <Input value={translation?.name ?? ""} onChange={(e) => textField("name", e.target.value)} />
                  </label>
                  <label className="block">
                    Tên gọi khác (mỗi dòng một tên)
                    <Textarea
                      value={translation?.aliases.join("\n") ?? ""}
                      onChange={(e) => textField("aliases", e.target.value)}
                    />
                  </label>
                  <EntityRichTextEditor
                    key={`${selected}:${locale}`}
                    label={entity.kind === "term" ? "Định nghĩa thuật ngữ" : "Giới thiệu ngắn khi xem tham chiếu"}
                    maxLength={4000}
                    value={translation?.description ?? ""}
                    onChange={(value) => textField("description", value)}
                    entities={editorEntities}
                    locale={locale}
                    fallbackLocale={settings.fallbackLocale}
                    autoRecognize={settings.autoRecognize}
                    resolveIcon={catalog.resolveIcon}
                  />
                  <details className="space-y-3 rounded-lg border p-3">
                    <summary className="cursor-pointer text-sm font-medium">Hiển thị & nhận diện</summary>
                    <label className="block">
                      Icon (URL HTTPS hoặc đường dẫn /)
                      <Input
                        value={entity.icon ?? ""}
                        onChange={(e) => update({ ...entity, icon: e.target.value || null })}
                      />
                    </label>
                    <label className="block">
                      Màu HEX
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
                    <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3">
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
                  <details className="space-y-3 rounded-lg border p-3">
                    <summary className="cursor-pointer text-sm font-medium">Liên kết tham chiếu</summary>
                    {(["admin", "wiki"] as const).map((context) => (
                      <label key={context} className="block">
                        Đích {context} (để trống dùng resolver)
                        <Input
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
                    variant="outline"
                    onClick={() => {
                      setDraft({
                        ...settings,
                        entities: settings.entities.filter((entry) => `${entry.kind}:${entry.id}` !== selected),
                      })
                      setSelected("")
                    }}
                  >
                    {entity.kind === "term" ? "Xóa thuật ngữ" : "Xóa tùy chỉnh, dùng danh mục gốc"}
                  </Button>
                </>
              ) : (
                <p>Chọn tướng, trang bị hoặc tạo thuật ngữ để chỉnh sửa tên và cách hiển thị.</p>
              )}
              <Button disabled={!draft || saving || !catalog.settings.data || !catalog.canEdit} onClick={saveDraft}>
                <Save className="size-4" />
                Lưu thay đổi
              </Button>
            </fieldset>
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
            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
              <div className="min-w-0 space-y-3 rounded-xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-medium">Soạn nội dung thử</h2>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
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
                  entities={editorEntities}
                  locale={locale}
                  fallbackLocale={settings.fallbackLocale}
                  autoRecognize={settings.autoRecognize}
                  resolveIcon={catalog.resolveIcon}
                  renderPreview={false}
                  hideLabel
                />
              </div>
              <div className="min-w-0 rounded-xl border bg-muted/15 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                  <h2 className="font-medium">Kết quả hiển thị</h2>
                  <div role="group" aria-label="Đích mở tham chiếu" className="flex rounded-lg bg-muted p-1">
                    {(["wiki", "admin"] as const).map((context) => (
                      <Button
                        key={context}
                        size="sm"
                        variant={previewContext === context ? "secondary" : "ghost"}
                        aria-pressed={previewContext === context}
                        onClick={() => setPreviewContext(context)}
                      >
                        {context === "wiki" ? "Wiki" : "Admin"}
                      </Button>
                    ))}
                  </div>
                </div>
                {preview ? (
                  <div className="whitespace-pre-wrap break-words text-sm leading-8">
                    <EntityRichText
                      text={preview}
                      entities={editorEntities}
                      locale={locale}
                      fallbackLocale={settings.fallbackLocale}
                      autoRecognize={settings.autoRecognize}
                      context={previewContext}
                      resolveIcon={catalog.resolveIcon}
                    />
                  </div>
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Nhập nội dung hoặc chọn Ví dụ để thử.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}
      </fieldset>
    </main>
  )
}
