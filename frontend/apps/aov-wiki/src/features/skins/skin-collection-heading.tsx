import type { ReactNode } from "react"
import { CatalogHeading } from "../../layout/catalog-heading"
import { useWikiText } from "../../context/wiki-context"

/** The head of the skin library: its name, how many skins are listed and the version they are read at. */
export function SkinCollectionHeading({ lead, action }: { lead?: ReactNode; action?: ReactNode }) {
  const t = useWikiText()
  return <CatalogHeading title={t("Trang phục", "Skins")} lead={lead} action={action} />
}
