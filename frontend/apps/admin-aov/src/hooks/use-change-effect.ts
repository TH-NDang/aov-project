import { useEffect, useRef, type DependencyList } from "react"

/** Synchronize changed inputs without resetting retained state on Activity reactivation. */
export function useChangeEffect(effect: () => void, dependencies: DependencyList) {
  const previous = useRef<DependencyList | null>(null)
  useEffect(() => {
    if (
      previous.current?.length === dependencies.length &&
      dependencies.every((value, index) => Object.is(value, previous.current![index]))
    )
      return
    previous.current = [...dependencies]
    effect()
  }, dependencies)
}
