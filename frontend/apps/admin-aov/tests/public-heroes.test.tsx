import assert from "node:assert/strict"
import { before, beforeEach, test } from "node:test"
import { render, waitFor, withDom } from "./fixtures/dom"
import { fakeBackend, json } from "./fixtures/network"
import { sessionRoutes, signIn } from "./fixtures/session"

const hero = (index: number) => ({
  code: `hero-${index}`,
  name: index === 0 ? "Điêu Thuyền" : `Hero ${index}`,
  head: { currentVersion: { url: `/heads/${index}.png` } },
})
const heroes = Array.from({ length: 150 }, (_, index) => hero(index))
let total = heroes.length
const backend = fakeBackend(sessionRoutes(), (request) => {
  if (request.pathname !== "/heroes") return undefined
  const page = Number(request.url.searchParams.get("page"))
  const size = Number(request.url.searchParams.get("size"))
  return json({ items: heroes.slice(page * size, (page + 1) * size), page, size, totalElements: total })
})
withDom({ globals: () => ({ fetch: backend.fetch }) })

before(signIn)
beforeEach(() => {
  backend.requests.length = 0
  total = heroes.length
})

const heroPages = () => backend.requests.filter((request) => request.pathname === "/heroes")

test("every screen that names heroes shares one read of the hero list", async () => {
  const { headsByCode, usePublicHeroes } = await import("../src/lib/public-heroes")
  const { useHeroPortraits } = await import("../src/features/community/directory/directory-api")
  let heads: Map<string, string> | undefined
  let portrait: ((name: string) => string | undefined) | undefined
  function Builds() {
    heads = usePublicHeroes(headsByCode).data
    return null
  }
  function Directory() {
    portrait = useHeroPortraits(true)
    return null
  }

  await render(
    <>
      <Builds />
      <Directory />
    </>,
  )

  await waitFor(() => heads?.size === 150)
  assert.equal(portrait!("dieu thuyen"), "/heads/0.png", "Names match without accents")
  assert.deepEqual(
    heroPages().map((request) => request.url.searchParams.get("page")),
    ["0", "1"],
  )
})

test("the hero list stops at an empty page even when the total says more", async () => {
  const { loadPublicHeroes } = await import("../src/lib/public-heroes")
  total = 1000

  const all = await loadPublicHeroes()

  assert.equal(all.length, 150)
  assert.equal(heroPages().length, 3)
})
