import type { AdminApi } from "./client"
import { ApiError } from "./errors"
import type {
  ArcanaStatus,
  AuditEntry,
  Enchantment,
  EnchantmentGroup,
  Hero,
  Item,
  ItemCatalog,
  ItemIssue,
  PortraitSource,
  SkinBadge,
} from "./types"
import { changedItemIds, validateCatalog } from "@/lib/domain/items"
import { planPortraitMove } from "@/lib/domain/portraits"
import { RESOURCES_BASE } from "@/lib/media"

const STORAGE_KEY = "aov-admin:mock-changes:v1"
const AUDIT_LIMIT = 200
const TIER_LABEL = { 1: "I", 2: "II", 3: "III" } as const

/** Edits made in mock mode. Only changed records are stored, never the whole data set. */
interface LocalChanges {
  heroes: Record<string, Hero>
  itemCatalog: { version: number; items: Item[] } | null
  enchantments: Record<string, Enchantment>
  audit: AuditEntry[]
}

const emptyChanges = (): LocalChanges => ({ heroes: {}, itemCatalog: null, enchantments: {}, audit: [] })

function readChanges(): LocalChanges {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...emptyChanges(), ...(JSON.parse(raw) as Partial<LocalChanges>) } : emptyChanges()
  } catch {
    return emptyChanges()
  }
}

function writeChanges(changes: LocalChanges) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(changes))
  } catch {
    // Storage may be full or blocked; edits then live for this session only.
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const readDelay = () => delay(80 + Math.random() * 120)
const writeDelay = () => delay(250 + Math.random() * 250)

async function fetchData<T>(file: string): Promise<T> {
  const response = await fetch(`${RESOURCES_BASE}data/${file}`)
  if (!response.ok) {
    throw new ApiError({ status: 503, code: "DATA_UNAVAILABLE", detail: `Cannot load ${file} (${response.status}).` })
  }
  return (await response.json()) as T
}

function notFound(what: string): never {
  throw new ApiError({ status: 404, code: "NOT_FOUND", detail: `${what} not found.` })
}

function assertVersion(current: number, expected: number) {
  if (current !== expected) {
    throw new ApiError({
      status: 409,
      code: "VERSION_CONFLICT",
      detail: "The record has changed.",
      parameters: { currentVersion: current, expectedVersion: expected },
    })
  }
}

function invalid(path: string, message: string, code = "INVALID_REQUEST"): never {
  throw new ApiError({ status: 422, code, detail: message, errors: [{ path, code: "INVALID", message }] })
}

export function createMockApi(): AdminApi {
  let changes = readChanges()
  let heroData: Promise<{ heroes: Map<string, Hero>; badges: SkinBadge[] }> | null = null
  let itemData: Promise<{ catalog: ItemCatalog; issues: ItemIssue[] }> | null = null
  let enchantmentData: Promise<{ groups: EnchantmentGroup[]; items: Map<string, Enchantment> }> | null = null
  let portraitData: Promise<PortraitSource[]> | null = null

  const loadHeroes = () =>
    (heroData ??= fetchData<{ heroes: Omit<Hero, "version">[]; badges: SkinBadge[] }>("heroes.json").then((raw) => {
      const heroes = new Map<string, Hero>()
      for (const hero of raw.heroes) heroes.set(hero.id, changes.heroes[hero.id] ?? { ...hero, version: 1 })
      return { heroes, badges: raw.badges }
    }))

  const loadItems = () =>
    (itemData ??= Promise.all([
      fetchData<Omit<ItemCatalog, "version">>("trang-bi.json"),
      fetchData<{ issues: ItemIssue[] }>("trang-bi-can-kiem-tra.json"),
    ]).then(([raw, review]) => ({
      catalog: {
        collectedOn: raw.collectedOn,
        categories: raw.categories,
        items: changes.itemCatalog?.items ?? raw.items,
        version: changes.itemCatalog?.version ?? 1,
      },
      issues: review.issues,
    })))

  const loadEnchantments = () =>
    (enchantmentData ??= fetchData<{ groups: EnchantmentGroup[]; items: Omit<Enchantment, "version">[] }>(
      "phu-hieu.json",
    ).then((raw) => {
      const items = new Map<string, Enchantment>()
      for (const item of raw.items) items.set(item.id, changes.enchantments[item.id] ?? { ...item, version: 1 })
      return { groups: [...raw.groups].sort((a, b) => a.order - b.order), items }
    }))

  const loadPortraits = () => (portraitData ??= fetchData<PortraitSource[]>("portrait-sources.json"))

  function audit(entry: Omit<AuditEntry, "id" | "at">) {
    changes.audit = [{ ...entry, id: crypto.randomUUID(), at: new Date().toISOString() }, ...changes.audit].slice(
      0,
      AUDIT_LIMIT,
    )
  }

  function commitHero(heroes: Map<string, Hero>, hero: Hero) {
    heroes.set(hero.id, hero)
    changes.heroes[hero.id] = hero
  }

  async function getHeroOrThrow(heroId: string) {
    const { heroes } = await loadHeroes()
    const hero = heroes.get(heroId)
    if (!hero) notFound(`Hero ${heroId}`)
    return { heroes, hero }
  }

  return {
    mode: "mock",

    async listHeroes() {
      const { heroes } = await loadHeroes()
      await readDelay()
      return [...heroes.values()]
    },

    async getHero(heroId) {
      const { hero } = await getHeroOrThrow(heroId)
      await readDelay()
      return hero
    },

    async updateHeroProfile(heroId, input) {
      const { heroes, hero } = await getHeroOrThrow(heroId)
      await writeDelay()
      assertVersion(hero.version, input.expectedVersion)
      const name = input.name.trim()
      if (!name) invalid("name", "Tên tướng không được để trống.")
      const next: Hero = {
        ...hero,
        name,
        sources: input.sources,
        skins: hero.skins.map((skin) => (skin.isDefault ? { ...skin, fullName: name } : skin)),
        version: hero.version + 1,
      }
      commitHero(heroes, next)
      audit({ action: "Cập nhật thông tin tướng", entityType: "hero", entityId: heroId, label: name })
      writeChanges(changes)
      return next
    },

    async updateHeroSkills(heroId, input) {
      const { heroes, hero } = await getHeroOrThrow(heroId)
      await writeDelay()
      assertVersion(hero.version, input.expectedVersion)
      const bySlot = new Map(input.skills.map((skill) => [skill.slot, skill]))
      for (const skill of input.skills) {
        if (!skill.name.trim()) invalid(`skills[${skill.slot}].name`, "Tên kỹ năng không được để trống.")
      }
      const next: Hero = {
        ...hero,
        skills: hero.skills.map((skill) => {
          const edit = bySlot.get(skill.slot)
          return edit ? { ...skill, name: edit.name.trim(), description: edit.description?.trim() || null } : skill
        }),
        version: hero.version + 1,
      }
      commitHero(heroes, next)
      audit({ action: "Cập nhật kỹ năng", entityType: "hero", entityId: heroId, label: hero.name })
      writeChanges(changes)
      return next
    },

    async updateSkin(heroId, skinId, input) {
      const { heroes, hero } = await getHeroOrThrow(heroId)
      await writeDelay()
      assertVersion(hero.version, input.expectedVersion)
      const skin = hero.skins.find((candidate) => candidate.id === skinId) ?? notFound(`Skin ${skinId}`)
      const name = input.name.trim()
      if (!name) invalid("name", "Tên trang phục không được để trống.")
      const files = [skin.portrait, ...skin.portraitAlternates].filter((file): file is string => !!file)
      if (input.portrait !== null && !files.includes(input.portrait)) {
        invalid("portrait", "Ảnh chính phải là một trong các bản portrait của trang phục.")
      }
      const portrait = input.portrait ?? skin.portrait
      const alternates = files.filter((file) => file !== portrait)
      const nextSkin = {
        ...skin,
        name,
        fullName: skin.isDefault ? hero.name : `${hero.name} ${name}`,
        badgeId: input.badgeId,
        portrait,
        portraitAlternates: alternates,
      }
      const next: Hero = {
        ...hero,
        ...(skin.isDefault ? { portrait, portraitAlternates: alternates } : {}),
        skins: hero.skins.map((candidate) => (candidate.id === skinId ? nextSkin : candidate)),
        version: hero.version + 1,
      }
      commitHero(heroes, next)
      audit({ action: "Cập nhật trang phục", entityType: "skin", entityId: skinId, label: `${hero.name} / ${name}` })
      writeChanges(changes)
      return next
    },

    async listBadges() {
      const { badges } = await loadHeroes()
      await readDelay()
      return badges
    },

    async listPortraits() {
      const portraits = await loadPortraits()
      await readDelay()
      return portraits
    },

    async movePortrait(input) {
      const { heroes } = await loadHeroes()
      await writeDelay()
      for (const [heroId, expected] of Object.entries(input.expectedVersions)) {
        const hero = heroes.get(heroId) ?? notFound(`Hero ${heroId}`)
        assertVersion(hero.version, expected)
      }
      let result
      try {
        result = planPortraitMove([...heroes.values()], input)
      } catch (error) {
        invalid("target", error instanceof Error ? error.message : String(error), "PORTRAIT_TARGET_INVALID")
      }
      const updated = result.changedHeroIds.map((heroId) => {
        const hero = result.heroes.find((candidate) => candidate.id === heroId)!
        const next = { ...hero, version: heroes.get(heroId)!.version + 1 }
        commitHero(heroes, next)
        return next
      })
      const target = heroes.get(input.heroId)!
      audit({
        action: "Chuyển portrait",
        entityType: "portrait",
        entityId: input.file,
        label: `${target.name} · ${input.fileName}`,
      })
      writeChanges(changes)
      return { heroes: updated, createdSkinId: result.createdSkinId }
    },

    async getItemCatalog() {
      const { catalog } = await loadItems()
      await readDelay()
      return catalog
    },

    async listItemIssues() {
      const { issues } = await loadItems()
      await readDelay()
      return issues
    },

    async saveItems(input) {
      const data = await loadItems()
      await writeDelay()
      assertVersion(data.catalog.version, input.expectedVersion)
      const problems = validateCatalog({ categories: data.catalog.categories, items: input.items })
      if (problems.length) {
        throw new ApiError({
          status: 422,
          code: "ITEM_CATALOG_INVALID",
          detail: "Item catalog validation failed.",
          errors: problems.map((problem) => ({
            path: problem.itemId ?? "items",
            code: "INVALID",
            message: problem.message,
          })),
        })
      }
      const changed = changedItemIds(data.catalog.items, input.items)
      const catalog: ItemCatalog = { ...data.catalog, items: input.items, version: data.catalog.version + 1 }
      data.catalog = catalog
      changes.itemCatalog = { version: catalog.version, items: catalog.items }
      audit({
        action: "Lưu trang bị",
        entityType: "item",
        entityId: changed.join(","),
        label: `${changed.length} trang bị thay đổi`,
      })
      writeChanges(changes)
      return catalog
    },

    async listEnchantmentGroups() {
      const { groups } = await loadEnchantments()
      await readDelay()
      return groups
    },

    async listEnchantments() {
      const { items } = await loadEnchantments()
      await readDelay()
      return [...items.values()]
    },

    async updateEnchantment(enchantmentId, input) {
      const { items, groups } = await loadEnchantments()
      await writeDelay()
      const current = items.get(enchantmentId) ?? notFound(`Enchantment ${enchantmentId}`)
      assertVersion(current.version, input.expectedVersion)
      const name = input.name.trim()
      if (!name) invalid("name", "Tên phù hiệu không được để trống.")
      if (!Number.isInteger(input.column) || input.column < 0) invalid("column", "Cột phải là số nguyên không âm.")
      const row = input.tier - 1
      const clash = [...items.values()].find(
        (other) =>
          other.id !== enchantmentId &&
          other.groupId === current.groupId &&
          other.position.row === row &&
          other.position.column === input.column,
      )
      if (clash) invalid("column", `Vị trí này đang có “${clash.name}”.`)
      const group = groups.find((candidate) => candidate.id === current.groupId)
      const next: Enchantment = {
        ...current,
        name,
        summary: input.summary.trim(),
        description: input.description.replace(/\s+$/, ""),
        tier: input.tier,
        tierLabel: TIER_LABEL[input.tier],
        position: { group: group?.name ?? current.position.group, row, column: input.column },
        version: current.version + 1,
      }
      items.set(enchantmentId, next)
      changes.enchantments[enchantmentId] = next
      audit({ action: "Cập nhật phù hiệu", entityType: "enchantment", entityId: enchantmentId, label: name })
      writeChanges(changes)
      return next
    },

    async getArcanaStatus(): Promise<ArcanaStatus> {
      const raw = await fetchData<{ status: string; note: string; items: unknown[] }>("ngoc.json")
      return { status: raw.status, note: raw.note, count: raw.items.length }
    },

    async listAudit() {
      await readDelay()
      return changes.audit
    },

    async resetLocalChanges() {
      await writeDelay()
      changes = emptyChanges()
      writeChanges(changes)
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        // Ignore blocked storage.
      }
      heroData = itemData = enchantmentData = null
    },
  }
}
