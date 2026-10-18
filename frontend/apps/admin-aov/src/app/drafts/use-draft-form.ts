import { useEffect, useRef } from "react"
import { useForm, type DefaultValues, type FieldValues } from "react-hook-form"
import type { ZodType } from "zod"
import { sameDraftValue } from "./draft-store"
import { useLocalDraft } from "./use-local-draft"

/** Form ownership stays in React Hook Form; the repository owns recovery across mounts. */
export function useDraftForm<T extends FieldValues>(options: {
  form: string
  initialValue: T
  schema: ZodType<T>
  baseVersion?: string | number | null
  enabled?: boolean
}) {
  const draft = useLocalDraft(options)
  const form = useForm<T>({ defaultValues: options.initialValue as DefaultValues<T>, shouldUnregister: false })
  const latest = useRef(draft)
  latest.current = draft
  const resetting = useRef(false)
  useEffect(() => {
    if (!draft.ready || sameDraftValue(form.getValues(), draft.value)) return
    resetting.current = true
    form.reset(draft.value)
    resetting.current = false
  }, [draft.key, draft.ready, draft.value, form])
  useEffect(() => {
    const subscription = form.watch((value) => {
      if (resetting.current || !latest.current.ready || sameDraftValue(value, latest.current.value)) return
      latest.current.update(value as T)
    })
    return () => subscription.unsubscribe()
  }, [form])
  return { form, draft }
}
