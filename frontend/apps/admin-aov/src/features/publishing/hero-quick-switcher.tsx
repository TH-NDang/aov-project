import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react"
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeftRight, Check, LoaderCircle, Search } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { EntityReferenceIcon } from "@aov/ui/components/entity-rich-text"
import { cn } from "@aov/ui/lib/utils"
import { backendRequest, getSession, subscribeSession } from "@/app/auth/session"
import { InfiniteScroll } from "@/components/infinite-scroll"
import { errorMessage } from "@/lib/api/errors"
import { createMediaIconResolver } from "../media/media-cache"
import { referenceCatalogApi, referenceCatalogKeys } from "../terminology/reference-api"
import { createPublishingApi } from "./publishing-api"
import type { HeroRow } from "./types"

const api = createPublishingApi(backendRequest)
interface HeroQuickSwitcherProps {
  heroId: string
  locale: string
  rulesetId?: string
  disabled?: boolean
  onSelect: (hero: HeroRow) => void
}

export function HeroQuickSwitcher(props: HeroQuickSwitcherProps) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (props.disabled) setOpen(false)
  }, [props.disabled])
  return (
    <Popover open={open && !props.disabled} onOpenChange={(next) => setOpen(next && !props.disabled)}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          disabled={props.disabled}
          aria-label="Chuyển tướng nhanh"
          title="Chuyển tướng nhanh"
        >
          <ArrowLeftRight className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={12}
        sideOffset={8}
        className="flex max-h-[min(60dvh,360px)] w-[min(360px,calc(100vw-24px))] min-w-0 flex-col overflow-hidden rounded-xl p-0"
      >
        {open && !props.disabled && (
          <HeroQuickSwitcherPanel
            {...props}
            onSelect={(hero) => {
              props.onSelect(hero)
              setOpen(false)
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}

function HeroQuickSwitcherPanel({ heroId, locale, rulesetId = "", onSelect }: HeroQuickSwitcherProps) {
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const session = useSyncExternalStore(subscribeSession, getSession, getSession)
  const client = useQueryClient()
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim().slice(0, 100)), 300)
    return () => clearTimeout(timer)
  }, [search])
  const catalog = useInfiniteQuery({
    queryKey: [
      "publishing-heroes",
      "quick-switch",
      session.actor?.issuer,
      session.actor?.subject,
      rulesetId,
      locale,
      query,
    ],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      api.heroes(pageParam, { q: query, locale, rulesetId, includeUnchanged: "true", sort: "code" }, signal),
    enabled: !!session.actor,
    staleTime: 60000,
    getNextPageParam: (last) => ((last.page + 1) * last.size < last.totalElements ? last.page + 1 : undefined),
  })
  const references = useQuery({
    queryKey: referenceCatalogKeys.catalog(session.actor?.issuer, session.actor?.subject, rulesetId),
    queryFn: ({ signal }) => referenceCatalogApi.list(rulesetId, signal),
    enabled: !!session.actor,
    staleTime: 300000,
    retry: false,
  })
  const names = useMemo(
    () =>
      new Map((references.data ?? []).filter((entity) => entity.kind === "hero").map((entity) => [entity.id, entity])),
    [references.data],
  )
  const resolveIcon = useMemo(() => createMediaIconResolver(client, api.asset), [client])
  const debouncing = search.trim().slice(0, 100) !== query
  const heroes = debouncing
    ? []
    : [...new Map(catalog.data?.pages.flatMap((page) => page.items).map((hero) => [hero.id, hero]) ?? []).values()]
  const options = () => [...(list.current?.querySelectorAll<HTMLButtonElement>("[data-hero-option]") ?? [])]
  function focus(element: HTMLButtonElement | undefined) {
    if (!element) return
    element.focus({ preventScroll: true })
    if (!list.current) return
    const bounds = list.current.getBoundingClientRect()
    const row = element.getBoundingClientRect()
    if (row.top < bounds.top) list.current.scrollTop += row.top - bounds.top
    else if (row.bottom > bounds.bottom) list.current.scrollTop += row.bottom - bounds.bottom
  }
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return
    const rows = options()
    const index = rows.indexOf(event.target as HTMLButtonElement)
    if (index < 0) return
    event.preventDefault()
    if (event.key === "ArrowUp" && index === 0) input.current?.focus({ preventScroll: true })
    else
      focus(
        rows[
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? rows.length - 1
              : Math.max(0, Math.min(rows.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))
        ],
      )
  }
  return (
    <>
      <label className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={input}
          autoFocus
          aria-label="Tìm tướng để chuyển"
          placeholder="Tìm tên hoặc mã tướng…"
          className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          maxLength={100}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            if (list.current) list.current.scrollTop = 0
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && !event.nativeEvent.isComposing) {
              event.preventDefault()
              focus(options()[0])
            }
          }}
        />
      </label>
      <div
        ref={list}
        data-reference-icon-scroll
        role="group"
        aria-label="Danh sách chuyển tướng"
        className="min-h-0 overflow-y-auto overscroll-contain p-1.5"
        onKeyDown={navigate}
      >
        {(catalog.isPending || debouncing) && (
          <p role="status" className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Đang tìm tướng…
          </p>
        )}
        {!debouncing && catalog.error && (
          <div role="alert" className="space-y-2 px-3 py-4 text-sm">
            <p>Chưa tải được danh sách tướng. {errorMessage(catalog.error)}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void catalog.refetch()}>
              Thử lại
            </Button>
          </div>
        )}
        {heroes.map((hero) => {
          const reference = names.get(hero.id)
          const name =
            reference?.translations.find((text) => text.locale === locale)?.name ||
            reference?.translations.find((text) => text.locale === "vi-VN")?.name ||
            reference?.translations.find((text) => text.name.trim())?.name ||
            hero.code
          const current = hero.id === heroId
          return (
            <button
              key={hero.id}
              type="button"
              data-hero-option
              aria-label={`Chuyển sang ${name}`}
              aria-current={current ? "true" : undefined}
              className={cn(
                "flex min-h-14 w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left outline-none hover:bg-muted/70 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                current && "bg-primary/5",
              )}
              onClick={() => onSelect(hero)}
            >
              <EntityReferenceIcon
                entity={reference ?? { id: hero.id, kind: "hero", translations: [] }}
                resolveIcon={resolveIcon}
                className="size-9 overflow-hidden rounded-full"
                defer
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{name}</span>
                <span className="block truncate text-xs text-muted-foreground">{hero.code}</span>
              </span>
              {current && (
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <Check className="size-3.5" />
                  Đang xem
                </span>
              )}
            </button>
          )
        })}
        {!catalog.isPending && !catalog.isError && !debouncing && heroes.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Không tìm thấy tướng phù hợp.</p>
        )}
        <InfiniteScroll query={catalog} rootRef={list} enabled={!debouncing} label="Đang tải thêm tướng…" />
      </div>
      {references.isError && (
        <p className="shrink-0 border-t px-3 py-2 text-xs text-muted-foreground">
          Chưa tải được tên và ảnh. Tạm hiển thị mã tướng.
        </p>
      )}
    </>
  )
}
