import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { ChangeKindLabel } from "../../components/patch-changes-row"
import { WikiImage } from "../../components/wiki-image"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { usePublishedChanges } from "../../lib/wiki-patch-changes"
import { heroCatalogQuery } from "../hero/hero-api"

const LIMIT = 8

/** A strip of published heroes on the home page; heroes changed in the current patch come first and say so. */
export function HomePatchHeroes() {
  const scope = useWikiContext()
  const { locale, href } = scope
  const catalog = useQuery(heroCatalogQuery(scope))
  const { subjects } = usePublishedChanges("HERO")
  const heroes = catalog.data?.items ?? []
  const ordered = [
    ...heroes.filter((hero) => subjects.has(hero.id)),
    ...heroes.filter((hero) => !subjects.has(hero.id)),
  ]

  if (!ordered.length) return null

  return (
    <section className="wiki-home-heroes" aria-labelledby="wiki-home-heroes-title">
      <div className="wiki-home-heroes-heading">
        <h2 id="wiki-home-heroes-title">
          {wikiText(locale, "Tướng", "Heroes")}
          <span>{ordered.length}</span>
        </h2>
        <Link to={href("/hero")}>{wikiText(locale, "Xem tất cả tướng", "See all heroes")}</Link>
      </div>
      <ul>
        {ordered.slice(0, LIMIT).map((hero) => {
          const image = hero.portrait?.currentVersion?.url ?? hero.head?.currentVersion?.url
          const kind = subjects.get(hero.id)?.kind
          return (
            <li key={hero.id}>
              <Link to={href(`/hero/${hero.code}`)}>
                <span className="wiki-home-hero-art">
                  {image && <WikiImage src={image} alt="" focus={hero.portrait?.currentVersion?.focalPoint} />}
                </span>
                <strong>{hero.name}</strong>
                {kind && (
                  <span className="wiki-home-hero-change">
                    <ChangeKindLabel kind={kind} size={16} />
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
