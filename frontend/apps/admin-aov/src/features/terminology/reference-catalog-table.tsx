import { useMemo, useState } from "react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { resolveEntityRoute, foldEntitySearch, type EntityReference } from "@aov/ui/lib/entity-rich-text"
import { EntityReferenceIcon, type EntityIconResolver } from "@aov/ui/components/entity-rich-text"

const kinds = { hero: "Tướng", item: "Trang bị", term: "Thuật ngữ" }
const fold = foldEntitySearch
export function ReferenceCatalogTable({
  entities,
  locale,
  fallbackLocale,
  selected,
  onSelect,
  customKeys,
  availableKeys,
  resolveIcon,
}: {
  entities: EntityReference[]
  locale: string
  fallbackLocale: string
  selected: string
  onSelect: (key: string) => void
  customKeys: Set<string>
  availableKeys: Set<string>
  resolveIcon?: EntityIconResolver
}) {
  const [search, setSearch] = useState("")
  const [kind, setKind] = useState("all")
  const [language, setLanguage] = useState("all")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(0)
  const languages = useMemo(
    () => [...new Set(entities.flatMap((entity) => entity.translations.map((text) => text.locale)))].sort(),
    [entities],
  )
  const rows = useMemo(
    () =>
      entities.filter((entity) => {
        const key = `${entity.kind}:${entity.id}`
        return (
          (kind === "all" || entity.kind === kind) &&
          (language === "all" || entity.translations.some((text) => text.locale === language)) &&
          (status === "all" ||
            (status === "custom"
              ? customKeys.has(key)
              : status === "available"
                ? availableKeys.has(key)
                : !availableKeys.has(key))) &&
          fold([entity.id, ...entity.translations.flatMap((text) => [text.name, ...text.aliases])].join(" ")).includes(
            fold(search.trim()),
          )
        )
      }),
    [entities, kind, language, status, customKeys, availableKeys, search],
  )
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / 25) - 1))
  return (
    <section aria-label="Danh mục thuật ngữ và đối tượng liên quan" className="min-w-0 space-y-3 rounded-xl border p-4">
      <h2 className="font-semibold">Danh mục thuật ngữ và đối tượng liên quan</h2>
      <div className="flex flex-wrap gap-3">
        <Input
          className="min-w-0 flex-1 basis-56"
          aria-label="Tìm danh mục"
          placeholder="Tìm tên, alias hoặc ID…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
        />
        <select
          aria-label="Lọc loại tham chiếu"
          className="rounded border bg-background p-2 text-sm"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value)
            setPage(0)
          }}
        >
          <option value="all">Mọi loại</option>
          {Object.entries(kinds).map(([key, label]) => (
            <option value={key} key={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Lọc locale danh mục"
          className="rounded border bg-background p-2 text-sm"
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value)
            setPage(0)
          }}
        >
          <option value="all">Mọi locale</option>
          {languages.map((lang) => (
            <option value={lang} key={lang}>
              {lang}
            </option>
          ))}
        </select>
        <select
          aria-label="Lọc trạng thái tham chiếu"
          className="rounded border bg-background p-2 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(0)
          }}
        >
          <option value="all">Mọi trạng thái</option>
          <option value="custom">Có tùy chỉnh / glossary</option>
          <option value="available">Sẵn sàng nhận diện</option>
          <option value="unavailable">Thiếu dữ liệu nguồn</option>
        </select>
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {rows.length} / {entities.length} mục · trang {currentPage + 1} / {Math.max(1, Math.ceil(rows.length / 25))} ·
        tối đa 25 dòng/trang
      </p>
      <div
        role="region"
        aria-label="Bảng tham chiếu, cuộn ngang để xem đích đến"
        tabIndex={0}
        className="max-h-[480px] overflow-auto rounded border"
      >
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">
            Danh mục thật, bản dịch, alias và trạng thái tham chiếu. Chọn tên để chỉnh sửa.
          </caption>
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              {["Tên / loại", "Locale / alias", "Nguồn / trạng thái", "Đích đến"].map((heading) => (
                <th key={heading} scope="col" className="p-3 font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(currentPage * 25, currentPage * 25 + 25).map((entity) => {
              const key = `${entity.kind}:${entity.id}`
              const text =
                entity.translations.find((text) => text.locale === locale) ??
                entity.translations.find((text) => text.locale === fallbackLocale) ??
                entity.translations[0]
              const available = availableKeys.has(key)
              return (
                <tr
                  key={key}
                  className={`border-t align-top ${selected === key ? "bg-accent/50" : ""}`}
                  aria-selected={selected === key}
                >
                  <td className="p-3">
                    <button
                      type="button"
                      className="flex min-h-11 items-center gap-2 text-left font-medium underline-offset-4 hover:underline focus-visible:outline-2"
                      onClick={() => onSelect(key)}
                    >
                      <EntityReferenceIcon entity={entity} resolveIcon={resolveIcon} className="size-8 rounded-md" />
                      <span>
                        {text?.name || entity.id}
                        <span className="block text-xs font-normal text-muted-foreground">{kinds[entity.kind]}</span>
                      </span>
                    </button>
                    <code className="block max-w-48 break-all text-[10px] text-muted-foreground">{key}</code>
                  </td>
                  <td className="max-w-60 p-3">
                    <span className="block">{entity.translations.map((text) => text.locale).join(", ")}</span>
                    <span className="text-xs text-muted-foreground">
                      {text?.aliases.join(", ") || "Chưa có alias"}
                      {text && text.locale !== locale ? ` · đang xem ${text.locale}` : ""}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="block">
                      {entity.kind === "hero"
                        ? "Tướng · phiên bản gần nhất"
                        : entity.kind === "item"
                          ? "Tài nguyên · adapter local"
                          : "Glossary · Vite"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {available ? "Sẵn sàng nhận diện" : "Thiếu dữ liệu nguồn"}
                      {customKeys.has(key) ? " · có tùy chỉnh" : ""}
                    </span>
                  </td>
                  <td className="p-3">
                    {(["admin", "wiki"] as const).map((context) => {
                      const url = resolveEntityRoute(entity, context, locale)
                      return (
                        <div key={context} className="max-w-60 break-all text-xs">
                          {context}:{" "}
                          {available && url ? (
                            <a href={url} className="underline underline-offset-4">
                              {url}
                            </a>
                          ) : (
                            "Chưa sẵn sàng"
                          )}
                        </div>
                      )
                    })}
                    {entity.kind !== "hero" && (
                      <span className="text-[10px] text-muted-foreground">Wiki cần nối API và route production.</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-5 text-sm text-muted-foreground">Không có mục phù hợp. Thử đổi bộ lọc hoặc tạo thuật ngữ.</p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={currentPage === 0}
          onClick={() => setPage(currentPage - 1)}
        >
          Trước
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={(currentPage + 1) * 25 >= rows.length}
          onClick={() => setPage(currentPage + 1)}
        >
          Sau
        </Button>
      </div>
    </section>
  )
}
