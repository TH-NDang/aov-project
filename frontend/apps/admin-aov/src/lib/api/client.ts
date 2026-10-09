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
import type { PortraitMoveRequest } from "@/lib/domain/portraits"
import { createMockApi } from "./mock-api"

export interface HeroProfileInput {
  expectedVersion: number
  name: string
  sources: Hero["sources"]
}

export interface HeroSkillsInput {
  expectedVersion: number
  skills: { slot: number; name: string; description: string | null }[]
}

export interface SkinInput {
  expectedVersion: number
  name: string
  badgeId: string | null
  /** File chosen as primary portrait; must be the current primary or one of its alternates. */
  portrait: string | null
}

export interface EnchantmentInput {
  expectedVersion: number
  name: string
  summary: string
  description: string
  /** Row in the group grid is always `tier - 1` (data convention). */
  tier: Enchantment["tier"]
  column: number
}

export interface PortraitMoveInput extends PortraitMoveRequest {
  /** Versions of the heroes the editor read; any mismatch is a conflict. */
  expectedVersions: Record<string, number>
}

/**
 * Contract the admin UI depends on. The mock implementation reads `resources/`; a live adapter
 * for `/api/wiki/v1/admin/**` replaces it once wiki-service exposes the endpoints.
 */
export interface AdminApi {
  readonly mode: "mock" | "live"
  listHeroes(): Promise<Hero[]>
  getHero(heroId: string): Promise<Hero>
  updateHeroProfile(heroId: string, input: HeroProfileInput): Promise<Hero>
  updateHeroSkills(heroId: string, input: HeroSkillsInput): Promise<Hero>
  updateSkin(heroId: string, skinId: string, input: SkinInput): Promise<Hero>
  listBadges(): Promise<SkinBadge[]>
  listPortraits(): Promise<PortraitSource[]>
  movePortrait(input: PortraitMoveInput): Promise<{ heroes: Hero[]; createdSkinId: string | null }>
  getItemCatalog(): Promise<ItemCatalog>
  listItemIssues(): Promise<ItemIssue[]>
  saveItems(input: { expectedVersion: number; items: Item[] }): Promise<ItemCatalog>
  listEnchantmentGroups(): Promise<EnchantmentGroup[]>
  listEnchantments(): Promise<Enchantment[]>
  updateEnchantment(enchantmentId: string, input: EnchantmentInput): Promise<Enchantment>
  getArcanaStatus(): Promise<ArcanaStatus>
  listAudit(): Promise<AuditEntry[]>
  resetLocalChanges(): Promise<void>
}

export const api: AdminApi = createMockApi()
