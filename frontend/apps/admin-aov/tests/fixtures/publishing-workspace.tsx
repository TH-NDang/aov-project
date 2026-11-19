/**
 * The hero workspace on a fake backend, for the flow tests of publishing, comparing and moving an imported baseline.
 * A test file installs `workspaceBackend.fetch` with `withDom` before any app module loads, starts each test with
 * `startHero` and mounts the page with `showWorkspace`. Nothing here reaches a real service.
 */
import "fake-indexeddb/auto"
import type { Content, Revision } from "@/lib/hero-types"
import { render } from "./dom"
import { createHeroFixture } from "./hero-workspace-data"
import { fakeBackend, json, type ApiRequest, type Handler } from "./network"
import { sessionRoutes } from "./session"

export const heroId = "fixture-hero"

type Version = { revision: Revision; content: Content }

let hero = createHeroFixture(false, true)
let versions = new Map<string, Version>()
let testRoutes: Handler = () => undefined

/** The hero's versions: the list and each read answer from what the test started with and what writes kept. */
const versionRoutes: Handler = ({ method, pathname }) => {
  if (method !== "GET") return undefined
  if (pathname === `/admin/heroes/${heroId}/revisions`)
    return json([...versions.values()].map((version) => version.revision))
  const read = pathname.match(/^\/admin\/heroes\/fixture-hero\/revisions\/([^/]+)$/)
  const version = read && versions.get(read[1]!)
  return version ? json(version) : undefined
}

/** Every other read of the page (rulesets, overview, comparisons, references) comes from the shared hero fixture. */
const heroRoutes: Handler = async ({ url, init }) => {
  try {
    return await hero.fetcher(url.pathname + url.search, init)
  } catch {
    return undefined
  }
}

/** An editor who may write and publish heroes. */
export const workspaceBackend = fakeBackend(
  sessionRoutes({ capabilities: ["catalog:read", "hero:write", "hero:publish"] }),
  (request) => testRoutes(request),
  versionRoutes,
  heroRoutes,
)

/**
 * Starts a test on a fresh hero holding `revisions`, each with `content` (the fixture hero's by default). `routes`
 * answers first, such as the writes the test expects. Requests and local drafts of the previous test are dropped.
 */
export async function startHero(revisions: Revision[], options: { content?: Content; routes?: Handler } = {}) {
  hero = createHeroFixture(false, true)
  const content = options.content ?? hero.content
  versions = new Map(revisions.map((revision) => [revision.id, { revision, content: structuredClone(content) }]))
  testRoutes = options.routes ?? (() => undefined)
  workspaceBackend.requests.length = 0
  const { draftRepository } = await import("../../src/app/drafts/draft-store")
  for (const key of Object.keys(draftRepository.store.getState().slots)) await draftRepository.remove(key)
}

/** Keeps a version a write answered with, so the page reads it back as the server would; returns it. */
export function keepVersion(revision: Revision) {
  versions.set(revision.id, { revision, content: versions.get(revision.id)?.content ?? hero.content })
  return revision
}

/** The path of an action on one of the hero's drafts, such as `publish` or `discard`. */
export const draftAction = (revisionId: string, action: string) =>
  `/admin/heroes/${heroId}/drafts/${revisionId}/${action}`

/** The bodies of the writes sent to `path`, in order. */
export const sentTo = (path: string) =>
  workspaceBackend.requests
    .filter((request: ApiRequest) => request.method !== "GET" && request.pathname === path)
    .map((request) => request.body)

/** The comparison requests of the page, each as the path it asked for. */
export const comparisonRequests = () =>
  workspaceBackend.requests
    .filter((request) => request.pathname.endsWith("/comparison"))
    .map((request) => request.path.replace(`/admin/heroes/${heroId}/revisions/`, ""))

/**
 * Mounts the workspace at `path`, as the hero drawer does, and returns what the address holds as the page changes
 * it. `heroId` is empty for the hero list.
 */
export async function showWorkspace(path: string, id = heroId) {
  const { MemoryRouter, useLocation } = await import("react-router")
  const { PublishingWorkspace } =
    await import("../../src/features/publishing/components/workspace/publishing-workspace")
  const address = { search: "" }
  function Address() {
    address.search = useLocation().search
    return null
  }
  const onUnsavedChange = () => {}
  await render(<PublishingWorkspace heroId={id} onUnsavedChange={onUnsavedChange} />, {
    wrap: (node) => (
      <MemoryRouter initialEntries={[path]}>
        {node}
        <Address />
      </MemoryRouter>
    ),
  })
  return { search: () => new URLSearchParams(address.search) }
}

/** The version menu of the hero header; its title names the version on screen and its state. */
export const versionMenu = () => document.querySelector<HTMLButtonElement>('button[aria-label="Phiên bản dữ liệu"]')
