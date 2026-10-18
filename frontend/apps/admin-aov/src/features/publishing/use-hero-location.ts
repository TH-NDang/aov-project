import { useCallback } from "react"
import { useSearchParams } from "react-router"
import { patchHeroLocation } from "./hero-location"

export function useHeroLocation() {
  const [params, setParams] = useSearchParams()
  const update = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      setParams((current) => patchHeroLocation(current, patch), { replace: true, preventScrollReset: true })
    },
    [setParams],
  )
  return { params, update }
}
