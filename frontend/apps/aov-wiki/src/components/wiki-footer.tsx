import { Link } from "react-router"
import { publicSiteUrl } from "@aov/ui/lib/public-site-url"
import { useWikiContext, wikiText } from "../context/wiki-context"
import { FeedbackDialog } from "./feedback-dialog"
import { WikiIcon } from "./wiki-icon"
import { SITE_NAME } from "../lib/seo/page-meta"
import "./wiki-footer.css"

const STREAM_URL = publicSiteUrl(import.meta.env.VITE_STREAM_URL, 5174, window.location.origin)

export function WikiFooter() {
  const { href, locale, options, regions, region, patchVariantId } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const patch = options?.patches.find((entry) => entry.id === (patchVariantId || options.currentPatchVariantId))
  const market = regions.find((entry) => entry.code === region)?.displayName

  return (
    <footer className="wiki-site-footer">
      <div className="wiki-footer-main">
        <div className="wiki-footer-about">
          <Link to={href("/")} className="wiki-footer-brand">
            <img src="/images/mole-logo-v4-160.png" width="28" height="28" alt="" /> {SITE_NAME}
          </Link>
          <p>
            {text(
              "Tra cứu tướng, trang phục, trang bị và các bản cập nhật của Liên Quân Mobile.",
              "Look up heroes, skins, equipment and updates for Arena of Valor.",
            )}
          </p>
        </div>
        {/* Support links only: the footer does not repeat the library index. */}
        <nav className="wiki-footer-links" aria-label={text("Hỗ trợ", "Support")}>
          <ul>
            <li>
              <FeedbackDialog showLabel />
            </li>
            <li>
              <Link to={href("/contact")}>
                <WikiIcon name="imagePlus" size={18} />
                {text("Liên hệ & nguồn ảnh", "Contact & image sources")}
              </Link>
            </li>
            <li>
              <a href={STREAM_URL}>
                <img src="/icons/stream-owl.svg" width="18" height="18" alt="" />
                AOV Stream
                <WikiIcon name="open" size={14} />
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="wiki-footer-note">
        <p>
          {text(
            "Tên, hình ảnh và dữ liệu game thuộc về Garena / Liên Quân Mobile.",
            "Game names, images and data belong to Garena / Arena of Valor.",
          )}
        </p>
        {patch && (
          <p>
            {text(`Dữ liệu bản ${patch.code}`, `Data from ${patch.code}`)}
            {market && ` · ${market}`}
          </p>
        )}
      </div>
    </footer>
  )
}
