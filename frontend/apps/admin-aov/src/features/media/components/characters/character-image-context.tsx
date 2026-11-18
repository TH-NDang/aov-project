import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router"
import { SearchField } from "@/components/search-field"
import { createPortal } from "react-dom"
import { cn } from "@aov/ui/lib/utils"
import { backendRequest } from "@/app/auth/session"
import { createCharacterImageApi } from "../../api/character-image-api"
import { defaultRulesetId, hasRulesetChoice } from "@/lib/default-ruleset"
import type { Request } from "../../../publishing/api/publishing-api"
import { publishingKeys } from "../../../publishing/api/publishing-api"
import { NativeSelect } from "@/components/native-select"

export function useImageContext(request: Request = backendRequest) {
  const [params, setParams] = useSearchParams()
  const rulesets = useQuery({
    queryKey: publishingKeys.rulesets,
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

/**
 * Search and ruleset controls of an image tab. `searchSlot` places the search in the workspace header: an element
 * while the tab is active, `null` while it is hidden; leave it out to keep the search in the toolbar.
 */
export function ImageContextControls({
  context,
  placeholder,
  searchSlot,
  className,
}: {
  context: ReturnType<typeof useImageContext>
  placeholder: string
  searchSlot?: HTMLElement | null
  className?: string
}) {
  const search = (
    <SearchField
      placement={searchSlot ? "header" : "inline"}
      className={searchSlot ? undefined : "w-full sm:w-80"}
      label={placeholder}
      placeholder={placeholder}
      shortcut
      value={context.search}
      onChange={context.setSearch}
    />
  )
  const rulesetChoice = hasRulesetChoice(context.rulesets.data)
  if (searchSlot !== undefined && !rulesetChoice) return searchSlot ? createPortal(search, searchSlot) : null
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {searchSlot === undefined ? search : searchSlot && createPortal(search, searchSlot)}
      {rulesetChoice && (
        <NativeSelect
          aria-label="Bộ quy tắc"
          className="max-w-52"
          value={context.rulesetId}
          disabled={context.rulesets.isPending}
          onChange={(event) => context.setRuleset(event.target.value)}
        >
          {context.rulesets.data?.map((rule) => (
            <option key={rule.id} value={rule.id}>
              {rule.code}
            </option>
          ))}
        </NativeSelect>
      )}
    </div>
  )
}
