import { Link } from "react-router"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { wikiSections, type WikiSectionKey } from "../../layout/wiki-sections"
import "./home-categories.css"

const descriptions: Record<WikiSectionKey, [string, string]> = {
  heroes: ["Kỹ năng, chỉ số và lịch sử thay đổi", "Skills, stats and change history"],
  skins: ["Trang phục theo tướng và bậc", "Skins by hero and tier"],
  items: ["Cửa hàng và công thức ghép", "Shop layout and recipes"],
  enchantments: ["Bốn hệ phù hiệu và các bậc", "The four trees and their tiers"],
  arcana: ["Ngọc theo màu và cấp", "Arcana by color and level"],
  spells: ["Phép bổ trợ và thời gian hồi", "Spells and cooldowns"],
}

export function HomeCategories() {
  const { locale, t, href } = useWikiContext()
  return (
    <nav className="wiki-index" aria-labelledby="wiki-index-title">
      <h2 id="wiki-index-title">{wikiText(locale, "Danh mục", "Browse the library")}</h2>
      <ul>
        {wikiSections.map(({ key, icon, path }) => (
          <li key={key}>
            <Link to={href(path)}>
              <WikiIcon name={icon} size={44} className="wiki-index-icon" />
              <span className="wiki-index-copy">
                <strong>{t(key)}</strong>
                <span>{wikiText(locale, ...descriptions[key])}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
