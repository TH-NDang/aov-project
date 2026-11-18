import { useCallback, useLayoutEffect, useRef } from "react"
import { useSearchParams } from "react-router"
import { patchHeroLocation } from "../model/hero-location"

export function useHeroLocation() {
  const [params, setParams] = useSearchParams()
  const latest = useRef(params)
  useLayoutEffect(() => {
    latest.current = params
  }, [params])
  const update = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      // Router search-param callbacks do not queue like React state updates.
      const next = patchHeroLocation(latest.current, patch)
      latest.current = next
      setParams(next, { replace: true, preventScrollReset: true })
    },
    [setParams],
  )
  return { params, update }
}
