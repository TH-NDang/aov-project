import { Link } from "react-router"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import owlMark from "../assets/stream-owl.svg"
import { PublicAppOptionBody, PublicAppWordmark } from "@aov/ui/components/public-app-brand"
import "./stream-app-switcher.css"

export function StreamAppSwitcher({ wikiUrl }: { wikiUrl: string }) {
  const wikiLogoUrl = new URL("images/mole-logo-v4.png", `${wikiUrl.replace(/\/$/, "")}/`).href

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className="public-app-theme public-app-trigger"
        data-product="stream"
        aria-label="Chọn ứng dụng — AOV Stream"
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
      <DropdownMenuContent align="start" alignOffset={-40} sideOffset={10} className="public-app-theme public-app-menu">
        <div className="public-app-menu-title">Chọn ứng dụng</div>
        <DropdownMenuItem asChild className="public-app-option" data-product="wiki">
          <a href={wikiUrl}>
            <PublicAppOptionBody product="Wiki" image={wikiLogoUrl} description="Tra cứu tướng, trang bị, phù hiệu" />
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="public-app-option" data-product="stream" data-current="true">
          <Link to="/" aria-current="true">
            <PublicAppOptionBody
              product="Stream"
              image={owlMark}
              description="Khám phá giải đấu, ván đấu và cộng đồng"
              current
            />
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
