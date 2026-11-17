import { Link } from "react-router"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/public-overlay"
import owlMark from "../assets/stream-owl.svg"
import { PublicAppOptionBody, PublicAppWordmark } from "@aov/ui/components/public-app-brand"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useStreamLocale } from "./stream-locale"
import "./stream-app-switcher.css"

export function StreamAppSwitcher({ wikiUrl }: { wikiUrl: string }) {
  const { text } = useStreamLocale()
  const mobile = usePageLayout() === "compact"
  const wikiLogoUrl = new URL("images/mole-logo-v4.png", `${wikiUrl.replace(/\/$/, "")}/`).href

  if (mobile)
    return (
      <span className="public-app-theme" data-product="stream">
        <PublicAppWordmark product="Stream" />
      </span>
    )

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className="public-app-theme public-app-trigger"
        data-product="stream"
        aria-label={text("Chọn ứng dụng — AOV Stream", "Choose application — AOV Stream")}
      >
        <PublicAppWordmark product="Stream" />
        <span className="public-app-chevron">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="m6 9 6 6 6-6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        alignOffset={-40}
        sideOffset={10}
        className="public-app-theme public-app-menu"
        drawerTitle={text("Chọn ứng dụng", "Choose application")}
      >
        <div className="public-app-menu-title">{text("Chọn ứng dụng", "Choose application")}</div>
        <DropdownMenuItem asChild className="public-app-option" data-product="wiki">
          <a href={wikiUrl}>
            <PublicAppOptionBody
              product="Wiki"
              image={wikiLogoUrl}
              description={text("Tra cứu tướng, trang bị, phù hiệu", "Look up heroes, equipment and enchantments")}
            />
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="public-app-option" data-product="stream" data-current="true">
          <Link to="/" aria-current="true">
            <PublicAppOptionBody
              product="Stream"
              image={owlMark}
              description={text(
                "Khám phá giải đấu, ván đấu và cộng đồng",
                "Explore tournaments, games and the community",
              )}
              current
              currentLabel={text("Đang xem", "Current")}
            />
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
