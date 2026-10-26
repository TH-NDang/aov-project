import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/select"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { useWikiContext, wikiText } from "../context/wiki-context"
import { WikiIcon } from "./wiki-icon"
import "./wiki-version-picker.css"

export function WikiVersionPicker() {
  const scope = useWikiContext()
  const { locale, options, seasonId, patchVariantId, includeUnscoped, setScope } = scope
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const patches = options?.patches.filter((patch) => !seasonId || patch.seasonId === seasonId) ?? []
  const historical = !!(seasonId || patchVariantId)
  const unavailable = scope.optionsPending || !!scope.optionsError
  const info = text("Về mốc dữ liệu", "About this data scope")
  const reset = text("Về hiện tại", "Return to current data")

  return (
    <section className="wiki-version-picker" aria-label={text("Mùa và phiên bản", "Season and patch")}>
      <Select
        value={seasonId || "current"}
        onValueChange={(value) =>
          setScope({ seasonId: value === "current" ? "" : value, patchVariantId: "", includeUnscoped: false })
        }
      >
        <SelectTrigger
          className="wiki-version-select"
          aria-label={text("Chọn mùa", "Select season")}
          disabled={unavailable}
        >
          <WikiIcon name="season" size={16} />
          <SelectValue placeholder={text("Chọn mùa", "Select season")} />
        </SelectTrigger>
        <SelectContent className="wiki-version-menu" position="popper">
          <SelectItem value="current">{text("Hiện tại", "Current")}</SelectItem>
          {options?.seasons.map((season) => (
            <SelectItem value={season.id} key={season.id}>
              {season.displayName}
              {season.isCurrent ? text(" · hiện tại", " · current") : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={patchVariantId || "season"}
        onValueChange={(value) => {
          const selected = options?.patches.find((patch) => patch.id === value)
          setScope({
            seasonId: selected?.seasonId ?? seasonId,
            patchVariantId: value === "season" ? "" : value,
            includeUnscoped: false,
          })
        }}
      >
        <SelectTrigger
          className="wiki-version-select"
          aria-label={text("Chọn patch", "Select patch")}
          disabled={unavailable || !patches.length}
        >
          <WikiIcon name="patch" size={16} />
          <SelectValue placeholder={text("Chọn patch", "Select patch")} />
        </SelectTrigger>
        <SelectContent className="wiki-version-menu" position="popper">
          <SelectItem value="season">
            {seasonId ? text("Cả mùa · mới nhất", "Whole season · latest") : text("Patch hiện tại", "Current patch")}
          </SelectItem>
          {patches.map((patch) => (
            <SelectItem value={patch.id} key={patch.id}>
              {patch.title || patch.code}
              <small>
                {patch.regionalDate || text("Chưa rõ ngày", "Date unconfirmed")}
                {patch.isCurrent ? text(" · hiện tại", " · current") : ""}
              </small>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {historical && (
        <button
          className="wiki-version-action"
          type="button"
          title={reset}
          aria-label={reset}
          onClick={() => setScope({ seasonId: "", patchVariantId: "", includeUnscoped: false })}
        >
          <WikiIcon name="reset" size={15} />
        </button>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="wiki-version-action"
            data-attention={includeUnscoped || !!scope.optionsError || undefined}
            title={info}
            aria-label={info}
          >
            <WikiIcon name="info" size={16} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="wiki-version-info" align="end">
          <h2>{info}</h2>
          {scope.optionsError ? (
            <p role="status">
              {text("Chưa tải được danh sách mùa/patch.", "Season and patch options could not be loaded.")}{" "}
              <button type="button" onClick={() => void scope.retryOptions()}>
                {scope.t("retry")}
              </button>
            </p>
          ) : (
            <p>
              {historical
                ? patchVariantId
                  ? text("Dữ liệu tại patch đã chọn.", "Data at the selected patch.")
                  : text(
                      "Chọn mùa để xem dữ liệu tại patch công khai mới nhất của mùa đó.",
                      "A season shows data at its latest public patch.",
                    )
                : text(
                    "Dữ liệu đang hiệu lực tại thị trường đã chọn.",
                    "Data currently effective in the selected market.",
                  )}
            </p>
          )}
          {historical && (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={includeUnscoped}
                  onChange={(event) => setScope({ seasonId, patchVariantId, includeUnscoped: event.target.checked })}
                />
                {text("Kèm dữ liệu nền chưa rõ mốc", "Include undated baselines")}
              </label>
              <p>
                {text(
                  "Dữ liệu chưa rõ mốc chỉ để tham khảo, chưa xác nhận đã tồn tại ở mùa/patch này.",
                  "Undated baselines are reference data; their existence in this season or patch is unconfirmed.",
                )}
              </p>
            </>
          )}
          {locale.startsWith("en") && <p>Untranslated game content uses its original language.</p>}
        </PopoverContent>
      </Popover>
    </section>
  )
}
