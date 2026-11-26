import { useCallback, useEffect, useRef, useState } from "react"

/** Fields text is typed in; a list, a tick and a slider are chosen at once. */
const TEXT_FIELD = [
  "textarea",
  "input:not([type])",
  "input[type=text]",
  "input[type=search]",
  "input[type=number]",
  "input[type=url]",
].join(", ")
/** The body of the dock, where the tool of the game on the desk stands. */
const BODY = ".esp-body"
/** It keeps the focus all the time, so it is typed in only while it holds a name. */
const HERO_SEARCH = "[data-hero-search]"
/** The events after which whether something is being typed is read again. */
const SETTLED = ["focusin", "focusout", "input", "submit"] as const

type Field = HTMLInputElement | HTMLTextAreaElement

function fieldOf(target: EventTarget | null): Field | null {
  if (!(target instanceof Element)) return null
  const field = target.closest<Field>(TEXT_FIELD)
  return field?.closest(BODY) ? field : null
}

/**
 * Text typed on the desk and not saved yet. While a text field of the dock's body has the focus, something is being
 * typed. A field of a form keeps what was typed in it until the form is sent, its text is put back or it leaves the
 * page; a field outside a form saves itself when it is left, or only searches.
 */
export function useTypedText() {
  const before = useRef(new WeakMap<Field, string>())
  const touched = useRef(new Set<Field>())
  const [typing, setTyping] = useState(false)

  const unsaved = useCallback(() => {
    for (const field of touched.current) {
      if (!field.isConnected) touched.current.delete(field)
      else if (field.value !== before.current.get(field)) return true
    }
    return false
  }, [])

  useEffect(() => {
    const focused = (active: Element | null) => {
      const field = fieldOf(active)
      return !!field && !(field.matches(HERO_SEARCH) && !field.value)
    }
    const update = (active: Element | null = document.activeElement) => setTyping(focused(active) || unsaved())
    const forget = (field: Field) => {
      touched.current.delete(field)
      before.current.delete(field)
    }
    // What a field held and whether it was typed in is noted on the way down, before anything can stop the event.
    const onFocusIn = (event: FocusEvent) => {
      const field = fieldOf(event.target)
      if (field && !before.current.has(field)) before.current.set(field, field.value)
    }
    const onFocusOut = (event: FocusEvent) => {
      const field = fieldOf(event.target)
      if (field && !field.form) forget(field)
    }
    const onInput = (event: Event) => {
      const field = fieldOf(event.target)
      if (!field) return
      if (!before.current.has(field)) before.current.set(field, "")
      touched.current.add(field)
    }
    const onSubmit = (event: Event) => {
      for (const field of touched.current) if (field.form === event.target) forget(field)
    }
    // The state is set on the way up, once React has handled the event. A browser renders what a listener sets before it
    // calls the next one, so a state set on the way down puts a controlled field back at the text it had before the
    // key, and React's own listener then finds nothing typed.
    const settled = (event: Event) => {
      const next = event.type === "focusout" ? (event as FocusEvent).relatedTarget : document.activeElement
      update(next instanceof Element ? next : null)
    }
    // A part that closes takes its fields along, and a cancel button puts their text back: both are read once the
    // page has changed.
    const changes = new MutationObserver(() => update())
    changes.observe(document.body, { childList: true, subtree: true })
    document.addEventListener("focusin", onFocusIn, true)
    document.addEventListener("focusout", onFocusOut, true)
    document.addEventListener("input", onInput, true)
    document.addEventListener("submit", onSubmit, true)
    for (const type of SETTLED) window.addEventListener(type, settled)
    return () => {
      changes.disconnect()
      document.removeEventListener("focusin", onFocusIn, true)
      document.removeEventListener("focusout", onFocusOut, true)
      document.removeEventListener("input", onInput, true)
      document.removeEventListener("submit", onSubmit, true)
      for (const type of SETTLED) window.removeEventListener(type, settled)
    }
  }, [unsaved])

  return { typing, unsaved }
}
