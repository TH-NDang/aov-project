import { useHero } from "@/lib/queries"

export function HeroCrumb({ heroId }: { heroId: string }) {
  const hero = useHero(heroId)
  return <>{hero.data?.name ?? heroId}</>
}
