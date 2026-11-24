import { Link } from "react-router"
import { PublicAppWordmark } from "@aov/ui/components/public-app-brand"
import { PerchedOwl } from "./perched-owl"
import { useStreamLocale } from "./stream-locale"
import "./stream-footer.css"

/**
 * The end of every page: the owl sits on its line and takes the reader back up, over what the app is and whose the
 * logos, the game and the icons are. It repeats no section: the top bar stays in reach on every page.
 */
export function StreamFooter() {
  const { text } = useStreamLocale()
  return (
    <footer className="hub-footer">
      <BackToTop />
      <div className="hub-footer-about">
        <span className="public-app-theme" data-product="stream">
          <PublicAppWordmark product="Stream" />
        </span>
        <p>
          {text(
            "Theo dõi giải đấu, trận đấu và đội tuyển Liên Quân Mobile. Dữ liệu được biên tập từ nguồn đối chiếu.",
            "Follow the tournaments, matches and teams of Arena of Valor. Data is compiled from reference sources.",
          )}
        </p>
      </div>
      <div className="hub-footer-rights">
        <p>
          {text(
            "Logo đội và giải đấu thuộc về chủ sở hữu tương ứng, dùng để nhận diện. Liên Quân Mobile thuộc Garena và các bên liên quan; AOV\u00a0Stream do người hâm mộ làm.",
            "Team and tournament logos belong to their owners and are shown to identify them. Arena of Valor belongs to Garena and its partners; AOV\u00a0Stream is made by fans.",
          )}{" "}
          <Link to="/credits" onClick={() => window.scrollTo(0, 0)}>
            {text("Bản quyền và nguồn", "Rights and sources")}
          </Link>
        </p>
        {/* The section marks are Game Icons, whose licence asks for this credit. */}
        <p>
          {text("Biểu tượng mục từ", "Section icons from")}{" "}
          <a href="https://game-icons.net" target="_blank" rel="noopener noreferrer">
            Game Icons
          </a>
          ,{" "}
          <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">
            CC BY 3.0
          </a>
        </p>
      </div>
    </footer>
  )
}

function BackToTop() {
  const { text } = useStreamLocale()
  return (
    <button
      type="button"
      className="hub-footer-top"
      onClick={() => {
        const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        window.scrollTo({ top: 0, behavior: calm ? "instant" : "smooth" })
        document.getElementById("main")?.focus({ preventScroll: true })
      }}
    >
      <span>{text("Về đầu trang", "Back to top")}</span>
      <PerchedOwl />
    </button>
  )
}
