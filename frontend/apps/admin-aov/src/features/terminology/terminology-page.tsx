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
import { saveSettings } from "./settings-api"
import { ReferenceCatalogTable } from "./reference-catalog-table"
import { EntityRichTextEditor } from "@aov/ui/components/entity-rich-text-editor"

export function TerminologyPage() {
  const [params] = useSearchParams()
  const catalog = useReferenceCatalog()
  const client = useQueryClient()
  const [draft, setDraft] = useState<RichTextSettings | null>(null)
  const [selected, setSelected] = useState(params.get("term") ? `term:${params.get("term")}` : "")
  const [locale, setLocale] = useState("vi-VN")
  const [preview, setPreview] = useState("")
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
  for (const entity of settings.entities) entities.set(`${entity.kind}:${entity.id}`, entity)
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
  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <fieldset disabled={saving || catalog.settings.isPending} className="contents">
        <h1 className="text-2xl font-semibold">Thuật ngữ & tham chiếu</h1>
        <p className="text-sm text-muted-foreground">
          Thiết lập lưu vào JSON trên máy chủ Vite dev/preview, chưa đồng bộ production hoặc wiki. Tướng: bản đã xuất
          bản hoặc bản nháp gần nhất; trang bị: bộ tài nguyên hiện có. Mô tả tham chiếu là giới thiệu ngắn, không thay
          thế dữ liệu theo phiên bản.
        </p>
        {(catalog.heroes.isError || catalog.items.isError) && (
          <p role="alert">Không tải đủ danh mục. Các mục chưa tải sẽ không được tự nhận diện.</p>
        )}
        {catalog.settings.isError && (
          <p role="alert">Không đọc được JSON storage. Không thể lưu: {catalog.settings.error.message}</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <label>
            <input
              type="checkbox"
              checked={settings.autoRecognize}
              onChange={(e) => setDraft({ ...settings, autoRecognize: e.target.checked })}
            />{" "}
            Tự nhận diện
          </label>
          <label>
            Locale dự phòng{" "}
            <Input
              className="w-36"
              value={settings.fallbackLocale}
              onChange={(e) => setDraft({ ...settings, fallbackLocale: e.target.value })}
            />
          </label>
          <Button
            disabled={!draft || saving || !catalog.settings.data}
            onClick={async () => {
              setSaving(true)
              setMessage("")
              try {
                const valid = validateRichTextSettings(settings)
                const table = await saveSettings(valid, catalog.settings.data!.table)
                client.setQueryData(["rich-text-settings"], { table, settings: valid })
                setDraft(null)
                setMessage("Đã lưu trên máy chủ Vite.")
              } catch (error) {
                setMessage(
                  `Chưa lưu: ${error instanceof Error ? error.message : "Storage error"}. Nếu xung đột, tải lại thiết lập trước khi thử lại.`,
                )
              } finally {
                setSaving(false)
              }
            }}
          >
            Lưu thiết lập
          </Button>
          <Button
            variant="outline"
            disabled={saving}
            onClick={async () => {
              if (!draft || window.confirm("Bỏ thay đổi và tải lại?")) {
                setDraft(null)
                await catalog.settings.refetch()
              }
            }}
          >
            Tải lại
          </Button>
        </div>
        {message && <p role="status">{message}</p>}
        <ReferenceCatalogTable
          entities={[...entities.values()]}
          locale={locale}
          fallbackLocale={settings.fallbackLocale}
          selected={selected}
          onSelect={setSelected}
          customKeys={customKeys}
          availableKeys={availableKeys}
          resolveIcon={catalog.resolveIcon}
        />
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <section className="space-y-3 rounded-xl border p-4">
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
              Thêm thuật ngữ
            </Button>
            <label className="block text-sm">
              Danh mục ({entities.size})
              <select
                aria-label="Danh mục tham chiếu"
                className="mt-2 w-full rounded border bg-background p-2"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Chọn mục…</option>
                {[...entities].map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.translations.find((t) => t.locale === locale)?.name ?? item.translations[0]?.name} (
                    {item.kind})
                  </option>
                ))}
              </select>
            </label>
            <p className="break-all text-xs text-muted-foreground">{selected}</p>
          </section>
          <section className="space-y-4 rounded-xl border p-4">
            {entity ? (
              <>
                <label className="block">
                  Locale <Input value={locale} onChange={(e) => setLocale(e.target.value)} />
                </label>
                <p className="text-xs text-muted-foreground">
                  Có bản dịch: {entity.translations.map((text) => text.locale).join(", ")}. Nhập locale khác để thêm bản
                  dịch.
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
                  Tên <Input value={translation?.name ?? ""} onChange={(e) => textField("name", e.target.value)} />
                </label>
                <label className="block">
                  Alias (mỗi dòng một tên)
                  <Textarea
                    value={translation?.aliases.join("\n") ?? ""}
                    onChange={(e) => textField("aliases", e.target.value)}
                  />
                </label>
                <EntityRichTextEditor
                  key={`${selected}:${locale}`}
                  label="Mô tả ngắn"
                  maxLength={4000}
                  value={translation?.description ?? ""}
                  onChange={(value) => textField("description", value)}
                  entities={editorEntities}
                  locale={locale}
                  fallbackLocale={settings.fallbackLocale}
                  autoRecognize={settings.autoRecognize}
                  resolveIcon={catalog.resolveIcon}
                />
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
                      checked={entity.autoMatch ?? entity.kind !== "item"}
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
          </section>
        </div>
        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="font-semibold">Xem trước</h2>
          <p className="break-all text-sm">
            {entity ? `<ref=${selected}>${translation?.name ?? "nhãn"}</ref>` : "<ref=term:ID>nhãn</ref>"} ·{" "}
            {"<color=#2563eb>nội dung</color>"} · {"<noauto>không tự nhận diện</noauto>"}
          </p>
          <Textarea aria-label="Nguồn xem trước" value={preview} onChange={(e) => setPreview(e.target.value)} />
          <div className="whitespace-pre-wrap break-words border-t pt-3">
            <EntityRichText
              text={preview}
              entities={[...entities.values()]}
              locale={locale}
              fallbackLocale={settings.fallbackLocale}
              autoRecognize={settings.autoRecognize}
              context="admin"
              resolveIcon={catalog.resolveIcon}
            />
          </div>
        </section>
      </fieldset>
    </main>
  )
}
