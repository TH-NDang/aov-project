import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { buildCaptureGroups, withShopGroups, type CaptureGroup, type CaptureImage } from "./patch-capture-model"
import { createPublishingApi, type HeroCatalogQuery } from "./publishing-api"
import type { HeroRow, PageSlice, Skill } from "./types"

const api = createPublishingApi(backendRequest)
const OPEN_KEY = "aov-admin:hero-captures-open"

export type CaptureState =
  | { status: "idle" }
  | { status: "loading" }
  /** The endpoint exists only on the Vite dev and preview servers. */
  | { status: "unavailable" }
  | { status: "no-patch" }
  | { status: "no-hero"; heroCode: string | null }
  | { status: "error"; message: string }
  | { status: "ready"; heroCode: string; sourceFolder: string; images: CaptureImage[] }

type ListHeroes = (page: number, query: HeroCatalogQuery) => Promise<PageSlice<HeroRow>>

/** The workspace only knows the hero's id; the capture set is keyed by its code. */
export async function findHeroCode(heroId: string, name: string, list: ListHeroes): Promise<string | null> {
  if (name) {
    const match = (await list(0, { q: name })).items.find((row) => row.id === heroId)
    if (match) return match.code
  }
  for (let page = 0; ; page++) {
    const slice = await list(page, {})
    const match = slice.items.find((row) => row.id === heroId)
    if (match) return match.code
    if (!slice.items.length || (page + 1) * slice.size >= slice.totalElements) return null
  }
}

export async function fetchHeroCaptures(patchCode: string | undefined, heroCode: string): Promise<CaptureState> {
  const patch = encodeURIComponent(patchCode ?? "none")
  const response = await fetch(`/__patch-captures/${patch}/heroes/${encodeURIComponent(heroCode)}.json`, {
    credentials: "omit",
  })
  if (!response.headers.get("content-type")?.includes("application/json")) return { status: "unavailable" }
  const body = (await response.json()) as {
    code?: string
    message?: string
    heroCode: string
    sourceFolder: string
    images: CaptureImage[]
  }
  if (response.ok)
    return { status: "ready", heroCode: body.heroCode, sourceFolder: body.sourceFolder, images: body.images }
  if (body.code === "HERO_NOT_FOUND") return { status: "no-hero", heroCode }
  if (body.code === "PATCH_NOT_FOUND" || body.code === "CAPTURES_UNAVAILABLE") return { status: "no-patch" }
  return { status: "error", message: body.message ?? "Không đọc được bộ ảnh gốc." }
}

export async function fetchCaptureSets(): Promise<string[]> {
  const response = await fetch("/__patch-captures/sets.json", { credentials: "omit" })
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return []
  return ((await response.json()) as { patches: string[] }).patches
}

/** Empty where the endpoint does not exist or this hero has no shop screenshot. */
export async function fetchShopCaptures(heroCode: string): Promise<CaptureImage[]> {
  const response = await fetch(`/__shop-captures/heroes/${encodeURIComponent(heroCode)}.json`, { credentials: "omit" })
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return []
  return ((await response.json()) as { images?: CaptureImage[] }).images ?? []
}

function readOpen() {
  try {
    return localStorage.getItem(OPEN_KEY) === "true"
  } catch {
    return false
  }
}

function saveOpen(open: boolean) {
  try {
    localStorage.setItem(OPEN_KEY, String(open))
  } catch {
    /* The panel still opens for this page. */
  }
}

export interface PatchCaptureWorkspace {
  state: CaptureState
  /** The patch whose screenshots are shown; it differs from `viewedPatchCode` only after the editor chose so. */
  patchCode: string | undefined
  viewedPatchCode: string | undefined
  /** Other capture sets to offer when the viewed revision's patch has none. */
  otherPatches: string[]
  choosePatch: (patchCode: string) => void
  open: boolean
  groups: CaptureGroup[]
  activeKey: string
  imageId: string | null
  focusRequest: number
  toggle: () => void
  close: () => void
  /** From a button next to an item: opens the panel on that item and hands it the keyboard. */
  reveal: (key: string, imageId?: string) => void
  select: (key: string, imageId?: string) => void
}

export function usePatchCaptureWorkspace({
  heroId,
  heroName,
  patchCode,
  skills,
  locale,
  focus,
  ready,
}: {
  heroId: string
  heroName: string
  patchCode: string | undefined
  skills: readonly Skill[]
  locale: string
  focus: string
  ready: boolean
}): PatchCaptureWorkspace {
  const [open, setOpen] = useState(readOpen)
  const [manual, setManual] = useState<{ key: string; focus: string; imageId?: string } | null>(null)
  const [focusRequest, setFocusRequest] = useState(0)
  const [chosenPatch, setChosenPatch] = useState<string>()
  const capturePatch = chosenPatch ?? patchCode
  const code = useQuery({
    queryKey: ["patch-capture-hero-code", heroId],
    queryFn: () => findHeroCode(heroId, heroName, (page, query) => api.heroes(page, query)),
    enabled: !!heroId && ready,
    staleTime: Infinity,
    retry: false,
  })
  const captures = useQuery({
    queryKey: ["patch-captures", capturePatch ?? "none", code.data],
    queryFn: () => fetchHeroCaptures(capturePatch, code.data!),
    enabled: !!code.data,
    staleTime: Infinity,
    retry: false,
  })
  const shop = useQuery({
    queryKey: ["shop-captures", code.data],
    queryFn: () => fetchShopCaptures(code.data!),
    enabled: !!code.data,
    staleTime: Infinity,
    retry: false,
  })
  const sets = useQuery({
    queryKey: ["patch-capture-sets"],
    queryFn: fetchCaptureSets,
    enabled: captures.data?.status === "no-patch",
    staleTime: Infinity,
    retry: false,
  })
  const state: CaptureState = !heroId
    ? { status: "idle" }
    : code.isError
      ? { status: "error", message: errorMessage(code.error) }
      : code.data === null
        ? { status: "no-hero", heroCode: null }
        : captures.isError
          ? { status: "error", message: errorMessage(captures.error) }
          : (captures.data ?? { status: "loading" })
  const images = state.status === "ready" ? state.images : undefined
  const groups = useMemo(
    () =>
      withShopGroups(
        images ? buildCaptureGroups({ images, skills, locale, patchCode: capturePatch ?? "", focus }) : [],
        shop.data ?? [],
      ),
    [images, skills, locale, capturePatch, focus, shop.data],
  )
  // A manual choice lasts until the editor moves on, then the panel follows the editor again.
  const following = !manual || manual.focus !== focus
  const activeKey = following ? focus : manual.key
  const change = useCallback((next: boolean) => {
    setOpen(next)
    saveOpen(next)
  }, [])
  return {
    state,
    patchCode: capturePatch,
    viewedPatchCode: patchCode,
    otherPatches: state.status === "no-patch" ? (sets.data ?? []) : [],
    choosePatch: setChosenPatch,
    open,
    groups,
    activeKey,
    imageId: following ? null : (manual.imageId ?? null),
    focusRequest,
    toggle: () => {
      if (!open) setFocusRequest((count) => count + 1)
      change(!open)
    },
    close: () => change(false),
    reveal: (key, imageId) => {
      setManual({ key, focus, imageId })
      setFocusRequest((count) => count + 1)
      change(true)
    },
    select: (key, imageId) => setManual({ key, focus, imageId }),
  }
}

const PatchCaptureContext = createContext<PatchCaptureWorkspace | null>(null)
export const PatchCaptureProvider = PatchCaptureContext.Provider
export const usePatchCaptureContext = () => useContext(PatchCaptureContext)
