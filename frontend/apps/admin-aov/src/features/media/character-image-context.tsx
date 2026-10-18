import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router"
import { Search } from "lucide-react"
import { backendRequest } from "@/app/auth/session"
import { createCharacterImageApi } from "./character-image-api"
import { control } from "../publishing/fields"
import type { Request } from "../publishing/publishing-api"

export function useImageContext(request: Request = backendRequest) {
  const [params, setParams] = useSearchParams()
  const rulesets = useQuery({
    queryKey: ["publishing-rulesets"],
    queryFn: () => createCharacterImageApi(request).rulesets(),
  })
  const requested = params.get("ruleset") ?? ""
  const rulesetId = rulesets.data?.some((rule) => rule.id === requested)
    ? requested
    : (rulesets.data?.find((rule) => rule.code === "aov-standard")?.id ?? rulesets.data?.[0]?.id ?? "")
  const search = params.get("q") ?? ""
  return {
    rulesets,
    rulesetId,
    q: search.trim(),
    search,
    setSearch: (value: string) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (value) next.set("q", value)
          else next.delete("q")
          return next
        },
        { replace: true, preventScrollReset: true },
      ),
    setRuleset: (id: string) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          next.set("ruleset", id)
          return next
        },
        { preventScrollReset: true },
      ),
  }
}

export function ImageContextControls({
  context,
  placeholder,
}: {
  context: ReturnType<typeof useImageContext>
  placeholder: string
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid min-w-48 flex-1 gap-1.5 text-sm sm:max-w-72">
        <span>Bộ quy tắc</span>
        <select
          aria-label="Bộ quy tắc"
          className={control}
          value={context.rulesetId}
          disabled={context.rulesets.isPending || !context.rulesets.data?.length}
          onChange={(event) => context.setRuleset(event.target.value)}
        >
          {!context.rulesets.data?.length && <option value="">Chưa có bộ quy tắc</option>}
          {context.rulesets.data?.map((rule) => (
            <option key={rule.id} value={rule.id}>
              {rule.code}
            </option>
          ))}
        </select>
      </label>
      <label className="relative min-w-48 flex-[2]">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          aria-label={placeholder}
          className={`${control} pl-9`}
          placeholder={placeholder}
          value={context.search}
          maxLength={100}
          onChange={(event) => context.setSearch(event.target.value)}
        />
      </label>
    </div>
  )
}
