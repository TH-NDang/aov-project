import { AlertTriangle, SlidersHorizontal } from "lucide-react"
import { useSearchParams } from "react-router"
import { Button } from "@aov/ui/components/button"
import { HeroLaneIcon } from "@aov/ui/components/hero-lane-icon"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { positions, positionLanes } from "./hero-classifications"
import { patchHeroLocation } from "./hero-location"
import { ROLES } from "./types"

const selected = (value: string | null, options: Record<string, string>) =>
  Object.keys(options).filter((key) => (value ?? "").split(",").includes(key))

export function heroCatalogFacets(params: URLSearchParams) {
  return {
    role: selected(params.get("role"), ROLES).join(","),
    position: selected(params.get("position"), positions).join(","),
    hasWarnings: params.get("hasWarnings") === "true" ? "true" : "",
  }
}

export function HeroCatalogFilters() {
  const [params, setParams] = useSearchParams()
  const facets = heroCatalogFacets(params)
  const count = Number(!!facets.role) + Number(!!facets.position) + Number(!!facets.hasWarnings)
  function update(patch: Record<string, string>) {
    setParams((current) => patchHeroLocation(current, patch), { replace: true, preventScrollReset: true })
  }
  function toggle(key: "role" | "position", value: string) {
    const values = facets[key].split(",").filter(Boolean)
    update({ [key]: (values.includes(value) ? values.filter((item) => item !== value) : [...values, value]).join(",") })
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={count ? "secondary" : "outline"}
          aria-label={`Lọc tướng${count ? ` · ${count} nhóm đang áp dụng` : ""}`}
        >
          <SlidersHorizontal className="size-4" /> Bộ lọc{count > 0 && <span className="type-label">{count}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={16}
        className="max-h-[var(--radix-popover-content-available-height)] w-80 max-w-[calc(100vw-2rem)] space-y-4 overflow-y-auto"
        aria-label="Bộ lọc tướng"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="type-section-title">Lọc tướng</h3>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!count}
            onClick={() => update({ role: "", position: "", hasWarnings: "" })}
          >
            Xóa bộ lọc
          </Button>
        </div>
        <label className="type-body flex cursor-pointer items-center gap-2 rounded-lg border p-3">
          <input
            type="checkbox"
            checked={!!facets.hasWarnings}
            onChange={(event) => update({ hasWarnings: event.target.checked ? "true" : "" })}
            className="size-4 accent-primary"
          />
          <AlertTriangle className="size-4 text-amber-600" /> Có cảnh báo chưa đối chiếu
        </label>
        <fieldset className="space-y-2">
          <legend className="type-label mb-2">Đường</legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(positions).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={facets.position.split(",").includes(value) ? "secondary" : "outline"}
                aria-pressed={facets.position.split(",").includes(value)}
                onClick={() => toggle("position", value)}
              >
                <HeroLaneIcon lane={positionLanes[value as keyof typeof positions]} /> {label}
              </Button>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="type-label mb-2">Vai trò</legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ROLES).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={facets.role.split(",").includes(value) ? "secondary" : "outline"}
                aria-pressed={facets.role.split(",").includes(value)}
                onClick={() => toggle("role", value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </fieldset>
        <p className="type-meta">Có thể chọn nhiều đường và vai trò. Đường lấy từ dữ liệu nguồn đã nhập.</p>
      </PopoverContent>
    </Popover>
  )
}
