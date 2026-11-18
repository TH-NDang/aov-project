import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { fetchPublishedSets, isSourceAccessDenied } from "../../files/capture-sets"
import {
  buildCaptureGroups,
  withShopGroups,
  type CaptureGroup,
  type CaptureImage,
  type CaptureTarget,
} from "../model/captures/patch-capture-model"
import { createPublishingApi, type HeroCatalogQuery, publishingKeys } from "./publishing-api"
import type { HeroRow, PageSlice, Skill } from "./types"

const api = createPublishingApi(backendRequest)
const OPEN_KEY = "aov-admin:hero-captures-open"

export type CaptureState =
  | { status: "idle" }
  | { status: "loading" }
  /** The account cannot open source files (no catalog:read), so the panel stays out of the way. */
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

/** One patch's screenshots of a hero, from the set publish-captures left in the private bucket (ADR-030). */
export async function fetchHeroCaptures(patchCode: string | undefined, heroCode: string): Promise<CaptureState> {
  try {
    const set = (await fetchPublishedSets("HERO_CAPTURE")).find((entry) => entry.set.patchCode === patchCode)?.set
    if (!set) return { status: "no-patch" }
    const hero = set.heroes[heroCode]
    if (!hero) return { status: "no-hero", heroCode }
    return { status: "ready", heroCode: hero.heroCode, sourceFolder: hero.sourceFolder, images: hero.images }
  } catch (failure) {
    if (isSourceAccessDenied(failure)) return { status: "unavailable" }
    return { status: "error", message: errorMessage(failure) }
  }
}

/** Patches that have a published set, so a revision from another patch can still reach the screenshots that exist. */
export async function fetchCaptureSets(): Promise<string[]> {
  try {
    return (await fetchPublishedSets("HERO_CAPTURE")).map((entry) => entry.set.patchCode).sort()
  } catch {
    return []
  }
}

/** Newest shop visit first; empty where the account cannot open source files or the hero has no shop screenshot. */
export async function fetchShopCaptures(heroCode: string): Promise<CaptureImage[]> {
  try {
    return (await fetchPublishedSets("SHOP_CAPTURE"))
      .map((entry) => entry.set)
      .sort((a, b) => b.capturedOn.localeCompare(a.capturedOn))
      .flatMap((set) => set.heroes[heroCode] ?? [])
  } catch {
    return []
  }
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
  skills: readonly Skill[]
  locale: string
  /** Opens a group and the part of the page it is the source of, when the page is free to follow. */
  go: (target: CaptureTarget, imageId?: string) => void
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
  onNavigate,
}: {
  heroId: string
  heroName: string
  patchCode: string | undefined
  skills: readonly Skill[]
  locale: string
  focus: string
  ready: boolean
  onNavigate?: (target: CaptureTarget) => void
}): PatchCaptureWorkspace {
  const [open, setOpen] = useState(readOpen)
  const [manual, setManual] = useState<{ key: string; focus: string; imageId?: string } | null>(null)
  const [focusRequest, setFocusRequest] = useState(0)
  const [chosenPatch, setChosenPatch] = useState<string>()
  const capturePatch = chosenPatch ?? patchCode
  const code = useQuery({
    queryKey: publishingKeys.captureHeroCode(heroId),
    queryFn: () => findHeroCode(heroId, heroName, (page, query) => api.heroes(page, query)),
    enabled: !!heroId && ready,
    staleTime: Infinity,
    retry: false,
  })
  const captures = useQuery({
    queryKey: publishingKeys.captures(capturePatch ?? "none", code.data),
    queryFn: () => fetchHeroCaptures(capturePatch, code.data!),
    enabled: !!code.data,
    staleTime: Infinity,
    retry: false,
  })
  const shop = useQuery({
    queryKey: publishingKeys.shopCaptures(code.data),
    queryFn: () => fetchShopCaptures(code.data!),
    enabled: !!code.data,
    staleTime: Infinity,
    retry: false,
  })
  const sets = useQuery({
    queryKey: publishingKeys.captureSets,
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
    skills,
    locale,
    go: (target, imageId) => {
      setManual({ key: target.group, focus, imageId })
      onNavigate?.(target)
    },
  }
}

const PatchCaptureContext = createContext<PatchCaptureWorkspace | null>(null)
export const PatchCaptureProvider = PatchCaptureContext.Provider
export const usePatchCaptureContext = () => useContext(PatchCaptureContext)
