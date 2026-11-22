import { useQuery } from "@tanstack/react-query"
import { useWikiContext, useWikiText } from "../../context/wiki-context"
import { WikiImage } from "../../components/wiki-image"
import { PatchName } from "../../components/hero-patch-name"
import { previousPatch } from "../../lib/hero-patch-line"
import { skinCatalogQuery, type SkinEntry } from "../../lib/skin-api"
import { skinsNewIn } from "./skin-releases-model"
import "./skin-releases.css"

/**
 * The skins the version being read brought, as a row above the collection: each its picture, name and hero, opening the
 * viewer on a tap. The collection of the version before is read to tell them; the row stays away while that version
 * has no recorded skins, which is the case until skins are recorded version by version.
 */
export function SkinReleases({
  current,
  onOpen,
}: {
  current: readonly SkinEntry[]
  onOpen: (skin: SkinEntry) => void
}) {
  const scope = useWikiContext()
  const text = useWikiText()
  const patches = scope.options?.patches ?? []
  // A whole season has no single version before it.
  const reading =
    scope.seasonId && !scope.patchVariantId
      ? undefined
      : patches.find((patch) => (scope.patchVariantId ? patch.id === scope.patchVariantId : patch.isCurrent))
  const before = previousPatch(patches, scope.options?.seasons ?? [], reading)
  const previous = useQuery({
    ...skinCatalogQuery({
      region: scope.region,
      locale: scope.locale,
      seasonId: before?.seasonId,
      patchVariantId: before?.id,
    }),
    // The browser keeps one copy of the collection: the version on screen, not this one.
    meta: undefined,
    enabled: !!before,
  })
  const released = skinsNewIn(current, previous.data?.items)
  if (!reading || !released.length) return null

  return (
    <section className="wiki-skin-releases" aria-labelledby="wiki-skin-releases-title">
      <h2 id="wiki-skin-releases-title">
        {text("Trang phục mới ở bản ", "New skins in ")}
        <PatchName patch={reading} />
        <small>{released.length}</small>
      </h2>
      <ul>
        {released.map((skin) => {
          const picture = skin.portrait?.currentVersion?.url ?? skin.head?.currentVersion?.url
          return (
            <li key={skin.skinKey}>
              <button type="button" onClick={() => onOpen(skin)}>
                <span className="wiki-skin-release-art">
                  {picture && <WikiImage frameWidth={128} src={picture} alt="" loading="lazy" decoding="async" />}
                </span>
                <strong>{skin.name}</strong>
                <small>{skin.heroName}</small>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
