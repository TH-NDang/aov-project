import { useEffect } from "react"
import { draftRepository } from "./draft-store"

/** This guard remains mounted while route Activities suspend their effects. */
export function DraftPersistenceGuard() {
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      const pending = Object.entries(draftRepository.store.getState().slots).filter(
        ([, slot]) => slot.record && slot.persistence !== "saved",
      )
      if (!pending.length) return
      for (const [key] of pending) void draftRepository.flush(key)
      event.preventDefault()
      event.returnValue = ""
    }
    const hidden = () => {
      if (document.visibilityState !== "hidden") return
      for (const [key, slot] of Object.entries(draftRepository.store.getState().slots))
        if (slot.record && slot.persistence === "pending") void draftRepository.flush(key)
    }
    window.addEventListener("beforeunload", unload)
    document.addEventListener("visibilitychange", hidden)
    return () => {
      window.removeEventListener("beforeunload", unload)
      document.removeEventListener("visibilitychange", hidden)
    }
  }, [])
  return null
}
