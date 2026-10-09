import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import {
  api,
  type EnchantmentInput,
  type HeroProfileInput,
  type HeroSkillsInput,
  type PortraitMoveInput,
  type SkinInput,
} from "@/lib/api/client"
import type { Enchantment, Hero, Item, ItemCatalog } from "@/lib/api/types"

export const queryKeys = {
  heroes: ["heroes"] as const,
  hero: (heroId: string) => ["heroes", heroId] as const,
  badges: ["badges"] as const,
  portraits: ["portraits"] as const,
  itemCatalog: ["items", "catalog"] as const,
  itemIssues: ["items", "issues"] as const,
  enchantmentGroups: ["enchantments", "groups"] as const,
  enchantments: ["enchantments", "list"] as const,
  arcana: ["arcana"] as const,
  audit: ["audit"] as const,
}

const STATIC = { staleTime: Infinity } as const

export const useHeroes = () => useQuery({ queryKey: queryKeys.heroes, queryFn: api.listHeroes, staleTime: 60_000 })
export const useHero = (heroId: string) =>
  useQuery({ queryKey: queryKeys.hero(heroId), queryFn: () => api.getHero(heroId), staleTime: 60_000 })
export const useBadges = () => useQuery({ queryKey: queryKeys.badges, queryFn: api.listBadges, ...STATIC })
export const usePortraits = () => useQuery({ queryKey: queryKeys.portraits, queryFn: api.listPortraits, ...STATIC })
export const useItemCatalog = () =>
  useQuery({ queryKey: queryKeys.itemCatalog, queryFn: api.getItemCatalog, staleTime: 60_000 })
export const useItemIssues = () => useQuery({ queryKey: queryKeys.itemIssues, queryFn: api.listItemIssues, ...STATIC })
export const useEnchantmentGroups = () =>
  useQuery({ queryKey: queryKeys.enchantmentGroups, queryFn: api.listEnchantmentGroups, ...STATIC })
export const useEnchantments = () =>
  useQuery({ queryKey: queryKeys.enchantments, queryFn: api.listEnchantments, staleTime: 60_000 })
export const useArcanaStatus = () => useQuery({ queryKey: queryKeys.arcana, queryFn: api.getArcanaStatus, ...STATIC })
export const useAudit = () => useQuery({ queryKey: queryKeys.audit, queryFn: api.listAudit })

function storeHeroes(client: QueryClient, heroes: Hero[]) {
  const byId = new Map(heroes.map((hero) => [hero.id, hero]))
  for (const hero of heroes) client.setQueryData(queryKeys.hero(hero.id), hero)
  client.setQueryData<Hero[]>(queryKeys.heroes, (list) => list?.map((hero) => byId.get(hero.id) ?? hero))
  void client.invalidateQueries({ queryKey: queryKeys.audit })
}

export function useUpdateHeroProfile(heroId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: HeroProfileInput) => api.updateHeroProfile(heroId, input),
    onSuccess: (hero) => storeHeroes(client, [hero]),
  })
}

export function useUpdateHeroSkills(heroId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: HeroSkillsInput) => api.updateHeroSkills(heroId, input),
    onSuccess: (hero) => storeHeroes(client, [hero]),
  })
}

export function useUpdateSkin() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ heroId, skinId, input }: { heroId: string; skinId: string; input: SkinInput }) =>
      api.updateSkin(heroId, skinId, input),
    onSuccess: (hero) => storeHeroes(client, [hero]),
  })
}

export function useMovePortrait() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: PortraitMoveInput) => api.movePortrait(input),
    onSuccess: ({ heroes }) => storeHeroes(client, heroes),
  })
}

export function useSaveItems() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { expectedVersion: number; items: Item[] }) => api.saveItems(input),
    onSuccess: (catalog) => {
      client.setQueryData<ItemCatalog>(queryKeys.itemCatalog, catalog)
      void client.invalidateQueries({ queryKey: queryKeys.audit })
    },
  })
}

export function useUpdateEnchantment() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: EnchantmentInput }) => api.updateEnchantment(id, input),
    onSuccess: (enchantment) => {
      client.setQueryData<Enchantment[]>(queryKeys.enchantments, (list) =>
        list?.map((item) => (item.id === enchantment.id ? enchantment : item)),
      )
      void client.invalidateQueries({ queryKey: queryKeys.audit })
    },
  })
}

export function useResetLocalChanges() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api.resetLocalChanges(),
    onSuccess: () => client.resetQueries(),
  })
}
