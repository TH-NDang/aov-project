import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router"
import { SearchField } from "@/components/search-field"
import { backendRequest } from "@/app/auth/session"
import { createCharacterImageApi } from "./character-image-api"
import { control } from "../publishing/fields"
import { defaultRulesetId, hasRulesetChoice } from "../publishing/default-ruleset"
import type { Request } from "../publishing/publishing-api"

export function useImageContext(request: Request = backendRequest) {
  const [params, setParams] = useSearchParams()
  const rulesets = useQuery({
    queryKey: ["publishing-rulesets"],
    queryFn: () => createCharacterImageApi(request).rulesets(),
  })
  const requested = params.get("ruleset") ?? ""
  const rulesetId = rulesets.data?.some((rule) => rule.id === requested) ? requested : defaultRulesetId(rulesets.data)
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
    <div className="flex flex-wrap items-center gap-2">
      <SearchField
        className="w-full sm:w-80"
        label={placeholder}
        placeholder={placeholder}
        shortcut
        value={context.search}
        onChange={context.setSearch}
      />
      {hasRulesetChoice(context.rulesets.data) && (
        <select
          aria-label="Bộ quy tắc"
          className={`${control} h-9 w-auto max-w-52 py-0`}
          value={context.rulesetId}
          disabled={context.rulesets.isPending}
          onChange={(event) => context.setRuleset(event.target.value)}
        >
          {context.rulesets.data?.map((rule) => (
            <option key={rule.id} value={rule.id}>
              {rule.code}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
