import { Link } from "react-router"
import { useStreamLocale } from "./stream-locale"
import "./image-rights.css"

/** Whose the logos on a page are, in one line at its end, with the way to the whole statement. */
export function ImageRights() {
  const { text } = useStreamLocale()
  return (
    <p className="hub-rights">
      {text(
        "Logo đội và giải đấu thuộc về chủ sở hữu tương ứng, dùng để nhận diện.",
        "Team and tournament logos belong to their owners and are shown to identify them.",
      )}{" "}
      <Link to="/credits">{text("Bản quyền và nguồn", "Rights and sources")}</Link>
    </p>
  )
}
