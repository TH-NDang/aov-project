import type { ReactNode } from "react"
import { CatalogHeading } from "../../layout/catalog-heading"
import { useWikiContext } from "../../context/wiki-context"

/** The head of the skin library: its name, how many skins are listed and the version they are read at. */
export function SkinCollectionHeading({ lead, action }: { lead?: ReactNode; action?: ReactNode }) {
  const { t } = useWikiContext()
  return <CatalogHeading title={t("skins")} lead={lead} action={action} />
}
