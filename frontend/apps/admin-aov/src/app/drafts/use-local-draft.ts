import { useEffect, useRef } from "react"
import { useStore } from "zustand"
import type { ZodType } from "zod"
import { useSession } from "../auth/auth-gate"
import { draftKey, draftRepository, emptyDraftSlot, sameDraftValue, type DraftValue } from "./draft-store"
import { reconcileDraft } from "./draft-merge"

export function useLocalDraft<T>({
  form,
  initialValue,
  schema,
  baseVersion = null,
  enabled = true,
  hasConflict = (base, value, current) => reconcileDraft(base, value, current).conflict,
  merge = (base, value, current) => reconcileDraft(base, value, current).value as T,
}: {
  form: string
  initialValue: T
  schema: ZodType<T>
  baseVersion?: number | string | null
  enabled?: boolean
  hasConflict?: (base: T, value: T, current: T) => boolean
  merge?: (base: T, value: T, current: T) => T
}) {
  const actor = useSession().actor
  const key = enabled && actor ? draftKey(actor.issuer, actor.subject, form) : ""
  const slot = useStore(draftRepository.store, (state) => state.slots[key] ?? emptyDraftSlot)
  const record = key ? slot.record : null
  const parsed = record ? schema.safeParse(record.value) : null
  const baseline = record ? schema.safeParse(record.base) : null
  const valid = !!parsed?.success && !!baseline?.success
  const value = valid ? merge(baseline.data, parsed.data, initialValue) : initialValue
  const dirty = valid && !sameDraftValue(value, initialValue)
  const conflict = valid && dirty && hasConflict(baseline.data, parsed.data, initialValue)
  const invalid = !!record && !valid
  const ready = !key || slot.ready
  const unsafeToUnload = !!key && !!record && slot.persistence !== "saved"
  const latest = useRef({ unsafeToUnload, key })
  latest.current = { unsafeToUnload, key }
  useEffect(() => {
    if (key) void draftRepository.load(key)
  }, [key])
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (!latest.current.unsafeToUnload) return
      void draftRepository.flush(latest.current.key)
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", unload)
    return () => window.removeEventListener("beforeunload", unload)
  }, [])
  const write = (
    next: T,
    base = valid && conflict ? baseline.data : initialValue,
    version = conflict ? (record?.baseVersion ?? baseVersion) : baseVersion,
  ) => {
    if (!key || !ready || invalid) return
    draftRepository.put(key, base as DraftValue, next as DraftValue, version)
  }
  return {
    key,
    value,
    dirty,
    ready,
    conflict,
    invalid,
    persistence: slot.persistence,
    error: invalid ? "Bản nháp cũ không còn đúng định dạng. Bỏ nháp này để dùng dữ liệu hiện tại." : slot.error,
    update: write,
    rebase: (next: T, base: T, version: number | string | null = baseVersion) => write(next, base, version),
    keepMine: () => write(value, initialValue, baseVersion),
    discard: () => (key ? draftRepository.remove(key, record) : Promise.resolve(true)),
    flush: () => (key ? draftRepository.flush(key) : Promise.resolve()),
  }
}
