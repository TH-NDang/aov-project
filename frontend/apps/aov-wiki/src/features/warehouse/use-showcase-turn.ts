import { useEffect, useState } from "react"
import { useMediaQuery } from "./warehouse-layout"

/** How long one scene stays before the next takes its turn, and how long the old one takes to fade. */
const STAYS_MS = 7000
const LEAVES_MS = 360

/**
 * The scene of an armory head that is on show, out of several that take turns. Every few seconds the scene fades and
 * the next one comes in; its pictures load while the one before is on show, so it is whole when its turn comes. A
 * reader who asks for less motion keeps the first scene, and a hidden tab keeps the scene it has.
 */
export function useShowcaseTurn<T>(scenes: T[], picturesOf: (scene: T) => string[]) {
  const still = useMediaQuery("(prefers-reduced-motion: reduce)")
  const [turn, setTurn] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const rotates = !still && scenes.length > 1

  useEffect(() => {
    if (!rotates) return
    let swap: number | undefined
    const timer = window.setInterval(() => {
      if (document.hidden) return
      setLeaving(true)
      swap = window.setTimeout(() => {
        setTurn((current) => current + 1)
        setLeaving(false)
      }, LEAVES_MS)
    }, STAYS_MS)
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(swap)
    }
  }, [rotates])

  const next = rotates ? scenes[(turn + 1) % scenes.length] : undefined
  useEffect(() => {
    for (const url of next ? picturesOf(next) : []) new Image().src = url
  }, [next, picturesOf])

  return { scene: scenes.length ? scenes[turn % scenes.length] : undefined, leaving }
}
