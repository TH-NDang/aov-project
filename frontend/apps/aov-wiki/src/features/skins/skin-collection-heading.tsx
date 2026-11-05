import { CatalogHeading } from "../../layout/catalog-heading"
import { useWikiContext } from "../../context/wiki-context"

export function SkinCollectionHeading() {
  const { t } = useWikiContext()
  return <CatalogHeading title={t("skins")} section={t("characters")} />
}
