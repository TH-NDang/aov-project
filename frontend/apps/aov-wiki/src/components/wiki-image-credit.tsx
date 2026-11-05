import type { ComponentProps } from "react"
import { ImageCredit } from "@aov/ui/components/image-credit"
import { publicSiteUrl } from "@aov/ui/lib/public-site-url"

export function WikiImageCredit(props: ComponentProps<typeof ImageCredit>) {
  const stream = publicSiteUrl(import.meta.env.VITE_STREAM_URL, 5174, window.location.origin)
  return <ImageCredit {...props} mobileDrawer pageBaseHref={`${stream.replace(/\/$/, "")}/pages`} />
}
