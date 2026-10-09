import { useCallback } from "react"
import { useSearchParams } from "react-router"

/**
 * String state stored in the URL query (`?key=value`), so filters survive reloads and can be
 * linked to. Empty values remove the key. Updates replace the history entry.
 */
export function useSearchParam(key: string, fallback = ""): [string, (value: string | null) => void] {
  const [params, setParams] = useSearchParams()
  const value = params.get(key) ?? fallback
  const setValue = useCallback(
    (next: string | null) => {
      setParams(
        (current) => {
          const updated = new URLSearchParams(current)
          if (next === null || next === "" || next === fallback) updated.delete(key)
          else updated.set(key, next)
          return updated
        },
        { replace: true },
      )
    },
    [key, fallback, setParams],
  )
  return [value, setValue]
}
