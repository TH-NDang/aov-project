import { Link } from "react-router"
import { publicSiteUrl } from "@aov/ui/lib/public-site-url"
import { useWikiContext, wikiText } from "../context/wiki-context"
import { FeedbackDialog } from "../layout/feedback-dialog"
import { wikiSections } from "../layout/wiki-sections"
import { WikiIcon } from "./wiki-icon"
import "./wiki-footer.css"

const STREAM_URL = publicSiteUrl(import.meta.env.VITE_STREAM_URL, 5174, window.location.origin)

export function WikiFooter() {
  const { href, locale, t, options, regions, region, patchVariantId } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const patch = options?.patches.find((entry) => entry.id === (patchVariantId || options.currentPatchVariantId))
  const market = regions.find((entry) => entry.code === region)?.displayName

  return (
    <footer className="wiki-site-footer">
      <div className="wiki-footer-main">
        <div className="wiki-footer-about">
          <Link to={href("/")} className="wiki-footer-brand">
            <img src="/images/mole-logo-v4.png" width="28" height="28" alt="" /> AOV Wiki
          </Link>
          <p>
            {text(
              "Tra cứu tướng, trang phục, trang bị và các bản cập nhật của Liên Quân Mobile.",
              "Look up heroes, skins, equipment and updates for Arena of Valor.",
            )}
          </p>
        </div>
        <nav className="wiki-footer-links" aria-label={text("Liên kết cuối trang", "Footer links")}>
          {(["characters", "warehouse", "news"] as const).map((group) => (
            <div key={group}>
              <h2>{t(group)}</h2>
              <ul>
                {wikiSections
                  .filter((section) => section.group === group)
                  .map((section) => (
                    <li key={section.key}>
                      <Link to={href(section.path)}>
                        <WikiIcon name={section.icon} size={18} />
                        {t(section.key)}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
          <div>
            <h2>{text("Hỗ trợ", "Support")}</h2>
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
          </div>
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
