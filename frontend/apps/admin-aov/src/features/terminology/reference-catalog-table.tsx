import { Link } from "react-router"
import { ArrowUpRight, ChevronRight, Database, X } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import {
  resolveEntityRoute,
  foldEntitySearch,
  entityKindLabels,
  type EntityReference,
} from "@aov/ui/lib/entity-rich-text"
import { EntityReferenceIcon, type EntityIconResolver } from "@aov/ui/components/entity-rich-text"

const kinds = entityKindLabels
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
  const [missingTranslation, setMissingTranslation] = useState(false)
  const termsOnly = entities.every((entity) => entity.kind === "term")
  const availableKinds = [...new Set(entities.map((entity) => entity.kind))]
  const [page, setPage] = useState(0)
  const rows = useMemo(
    () =>
      entities.filter((entity) => {
        return (
          (kind === "all" || entity.kind === kind) &&
          (!missingTranslation ||
            !entity.translations.some((text) => text.locale.toLowerCase() === locale.toLowerCase())) &&
          fold([entity.id, ...entity.translations.flatMap((text) => [text.name, ...text.aliases])].join(" ")).includes(
            fold(search.trim()),
          )
        )
      }),
    [entities, kind, missingTranslation, locale, search],
  )
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / 25) - 1))
  return (
    <section aria-label="Danh mục thuật ngữ và đối tượng liên quan" className="min-w-0 space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap gap-3">
        <Input
          className="min-w-0 flex-1 basis-56"
          aria-label="Tìm danh mục"
          placeholder={termsOnly ? "Tìm thuật ngữ, tên gọi khác…" : "Tìm tên hoặc tên gọi khác…"}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
        />
        {!termsOnly && availableKinds.length > 1 && (
          <div
            role="group"
            aria-label="Lọc loại tham chiếu"
            className="flex items-center gap-1 rounded-lg bg-muted p-1"
          >
            {[["all", "Tất cả"], ...availableKinds.map((key) => [key, kinds[key]])].map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={kind === key ? "secondary" : "ghost"}
                aria-pressed={kind === key}
                onClick={() => {
                  setKind(key!)
                  setPage(0)
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        )}
        {(missingTranslation ||
          entities.some(
            (entity) => !entity.translations.some((text) => text.locale.toLowerCase() === locale.toLowerCase()),
          )) && (
          <Button
            size="sm"
            variant={missingTranslation ? "secondary" : "outline"}
            aria-pressed={missingTranslation}
            onClick={() => {
              setMissingTranslation((value) => !value)
              setPage(0)
            }}
          >
            Thiếu bản dịch
          </Button>
        )}
        {(search || kind !== "all" || missingTranslation) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearch("")
              setKind("all")
              setMissingTranslation(false)
              setPage(0)
            }}
          >
            <X className="size-4" />
            Bỏ lọc
          </Button>
        )}
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {rows.length} mục{rows.length !== entities.length ? ` / ${entities.length}` : ""}
      </p>
      <div
        role="region"
        aria-label="Bảng tham chiếu, cuộn ngang để xem đích đến"
        tabIndex={0}
        className="relative isolate max-h-[560px] overflow-auto rounded-xl border"
      >
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">
            Danh mục thật, bản dịch, alias và trạng thái tham chiếu. Chọn tên để chỉnh sửa.
          </caption>
          <thead className="sticky top-0 z-20 bg-muted">
            <tr>
              {["Tên", "Bản dịch / tên gọi khác", "Nhận diện", ...(!termsOnly ? ["Dữ liệu gốc"] : [])].map(
                (heading, index) => (
                  <th
                    key={heading}
                    scope="col"
                    className={`p-3 font-medium ${index === 0 ? "sticky left-0 z-20 bg-muted" : ""}`}
                  >
                    {heading}
                  </th>
                ),
              )}
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
                  <td className="sticky left-0 z-10 bg-card p-3">
                    <button
                      type="button"
                      className="group flex min-h-11 w-full min-w-44 cursor-pointer items-center gap-2 rounded-lg text-left font-medium hover:text-primary focus-visible:outline-2"
                      onClick={() => onSelect(key)}
                    >
                      <EntityReferenceIcon entity={entity} resolveIcon={resolveIcon} className="size-9 rounded-lg" />
                      <span>
                        {text?.name || entity.id}
                        {!termsOnly && (
                          <span className="block text-xs font-normal text-muted-foreground">{kinds[entity.kind]}</span>
                        )}
                      </span>
                      <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    </button>
                  </td>
                  <td className="max-w-60 p-3">
                    <span className="flex flex-wrap gap-1">
                      {entity.translations.map((text) => (
                        <span key={text.locale} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {text.locale}
                        </span>
                      ))}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {text?.aliases.join(", ") || "Chưa có tên gọi khác"}
                      {text && text.locale !== locale ? ` · đang xem ${text.locale}` : ""}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs">
                      {entity.autoMatch === false ||
                      (!["hero", "term"].includes(entity.kind) && entity.autoMatch !== true)
                        ? "Chọn bằng @"
                        : "Tự nhận diện"}
                    </span>
                    {!available && <p className="mt-1 text-xs text-amber-600">Thiếu dữ liệu gốc</p>}
                    {entity.kind !== "term" && customKeys.has(key) && (
                      <p className="mt-1 text-xs text-muted-foreground">Có tùy chỉnh</p>
                    )}
                  </td>
                  {!termsOnly && (
                    <td className="p-3">
                      {available && resolveEntityRoute(entity, "admin", locale) ? (
                        <Link
                          to={resolveEntityRoute(entity, "admin", locale)!}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-primary hover:bg-primary/5"
                        >
                          <Database className="size-3.5" />
                          Mở danh mục gốc
                          <ArrowUpRight className="size-3.5" />
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">Chưa có dữ liệu nguồn</span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-5 text-sm text-muted-foreground">Không có mục phù hợp. Thử đổi bộ lọc hoặc tạo thuật ngữ.</p>
        )}
      </div>
      {rows.length > 25 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground">
            Trang {currentPage + 1} / {Math.ceil(rows.length / 25)}
          </span>
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
      )}
    </section>
  )
}
