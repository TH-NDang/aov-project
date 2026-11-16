import type { ComponentProps } from "react"
import { ImageCredit } from "@aov/ui/components/image-credit"
import { publicSiteUrl } from "@aov/ui/lib/public-site-url"
import { useWikiContext } from "../context/wiki-context"

export function WikiImageCredit(props: ComponentProps<typeof ImageCredit>) {
  const { locale } = useWikiContext()
  const stream = publicSiteUrl(import.meta.env.VITE_STREAM_URL, 5174, window.location.origin)
  return <ImageCredit {...props} locale={locale} mobileDrawer pageBaseHref={`${stream.replace(/\/$/, "")}/pages`} />
}
