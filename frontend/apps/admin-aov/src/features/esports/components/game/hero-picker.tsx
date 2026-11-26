import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import type { Reference, Selection } from "@aov/community-contracts"
import { Search } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { heroNamed, searchHeroes } from "../../model/hero-search"
import { HeroIcon } from "../primitives"
import { isTyping, OWN_KEYS } from "../series/key-owner"
import "./draft.css"

/** Marks and handles of the track that Alt and the arrows move while they have the focus. */
const MOVED_BY_KEYS = "[data-movable]"

/**
 * The search and the faces of the heroes a turn may take, always open: typing two letters and Enter is a turn. The field
 * keeps the focus; while it is empty the keys of the video, the undo and Esc go past it to the desk.
 */
export function HeroPicker({
  head,
  label,
  turn,
  options,
  catalog,
  whyNot,
  keepFocus,
  onTyping,
  onPick,
  onEscape,
}: {
  /** The turn being filled, over the search. */
  head: ReactNode
  /** The turn in words, as the name of the list. */
  label: string
  /** Changes with the turn being filled, so the field is ready for the next one. */
  turn: number
  /** Heroes the rules allow, in the order they are shown. */
  options: Reference[]
  /** Every hero, to say why a typed one is not among the options. */
  catalog: Reference[]
  whyNot: (hero: Selection) => string | null
  keepFocus: boolean
  /** The first key of a search was pressed, or its last one taken back. */
  onTyping: (typing: boolean) => void
  onPick: (hero: Selection) => void
  /** Esc on an empty field; true when it was used up here. */
  onEscape: () => boolean
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")
  const [walked, setWalked] = useState<number | null>(null)
  const typed = query.trim()
  const found = searchHeroes(options, query)
  const named = heroNamed(catalog, query)
  const missed = typed ? (named && whyNot(named) ? named : found.length ? null : searchHeroes(catalog, query)[0]) : null
  // Enter takes the first answer of a typed text, or whichever one the arrow keys went to. Where the hero that bears the
  // whole name is refused, another one that only holds it is not meant.
  const marked = walked ?? (typed && !missed ? 0 : -1)
  const refusal = missed ? whyNot(missed) : typed && !found.length ? whyNot({ id: null, name: typed }) : null

  useEffect(() => {
    // A field outside the dock, or a question that is open, keeps the focus it has.
    const active = document.activeElement
    if (keepFocus && (!active || active === document.body || active.closest(".esp-dock")))
      input.current?.focus({ preventScroll: true })
  }, [keepFocus, turn])
  useEffect(() => {
    if (!keepFocus) return
    // A press with the mouse anywhere on the desk leaves the focus on a button or nowhere, and the next name typed
    // would fire the keys of the desk. Once the press has done its work the search takes the focus back, unless it put
    // the focus in a field, a menu or a question of its own, or on a mark of the track: Alt and the arrows move that one,
    // and in the search they would go back a page instead. The desk gives the letters typed there to the search.
    let timer: number | undefined
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType === "touch" || !(event.target instanceof Element) || !event.target.closest(".esp-studio"))
        return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const field = input.current
        const active = document.activeElement
        if (!field || active === field) return
        if (
          active instanceof HTMLElement &&
          active !== document.body &&
          (isTyping(active) || active.closest(OWN_KEYS) || active.closest(MOVED_BY_KEYS))
        )
          return
        field.focus({ preventScroll: true })
      })
    }
    window.addEventListener("pointerup", onPointerUp, true)
    return () => {
      window.removeEventListener("pointerup", onPointerUp, true)
      window.clearTimeout(timer)
    }
  }, [keepFocus])
  useEffect(() => {
    // What Enter takes is in sight, wherever the faces were scrolled to before.
    if (query || walked !== null) list.current?.querySelector("[data-marked]")?.scrollIntoView?.({ block: "nearest" })
  }, [query, walked])

  const search = (text: string) => {
    if (!query && text) onTyping(true)
    if (query && !text) onTyping(false)
    setQuery(text)
    setWalked(null)
  }
  const pick = (hero: Selection) => {
    onPick(hero)
    setQuery("")
    setWalked(null)
    if (keepFocus) input.current?.focus({ preventScroll: true })
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === "Enter") {
      event.preventDefault()
      const option = found[marked]
      if (option) pick({ id: option.id, name: option.name })
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      const next = marked + (event.key === "ArrowDown" ? 1 : -1)
      setWalked(next < 0 ? null : Math.min(next, found.length - 1))
    } else if (event.key === "Escape" && (query || onEscape())) {
      event.preventDefault()
      event.stopPropagation()
      if (query) search("")
    }
  }

  return (
    <>
      <div className="esp-draft-top">
        {head}
        <div className="esp-draft-search">
          <Search size={14} aria-hidden />
          <Input
            ref={input}
            data-hero-search
            data-keeps-focus={keepFocus || undefined}
            role="combobox"
            aria-label="Tìm tướng"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls={`${id}-list`}
            aria-activedescendant={found[marked] ? `${id}-${found[marked].id}` : undefined}
            value={query}
            maxLength={100}
            autoComplete="off"
            placeholder="Tìm tướng"
            onChange={(event) => search(event.target.value)}
            onKeyDown={onKeyDown}
            // It keeps the focus all the time, so its ring stays out of the way of what is pressed next.
            className="h-[34px] pl-8 focus-visible:border-foreground/60 focus-visible:ring-0"
          />
        </div>
        {refusal ? (
          <p role="alert" className="px-3 pb-2 text-xs text-destructive">
            {missed?.name ?? typed}: {refusal}.
          </p>
        ) : (
          typed &&
          !found.length && (
            <p className="flex flex-wrap items-center gap-2 px-3 pb-2 text-xs text-muted-foreground" role="status">
              Không có tướng phù hợp.
              <Button
                type="button"
                size="xs"
                variant="outline"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick({ id: null, name: typed })}
              >
                Dùng tên “{typed}”
              </Button>
            </p>
          )
        )}
      </div>
      <div ref={list} id={`${id}-list`} role="listbox" aria-label={label} className="esp-faces">
        {found.map((option, index) => (
          <button
            key={option.id}
            id={`${id}-${option.id}`}
            type="button"
            role="option"
            tabIndex={-1}
            aria-selected={index === marked}
            data-marked={index === marked || undefined}
            className="esp-face"
            title={option.name}
            // The search keeps the focus, so typing the next name needs no second press.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => pick({ id: option.id, name: option.name })}
          >
            <HeroIcon hero={option} size={44} title="" className="rounded-md" />
            <span className="esp-face-name">{option.name}</span>
          </button>
        ))}
      </div>
    </>
  )
}
