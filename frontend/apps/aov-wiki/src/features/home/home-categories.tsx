import { useId, type ReactNode } from "react"
import { Link } from "react-router"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import "./home-categories.css"

const CATEGORIES: { name: string; englishName: string; icon: ReactNode; path?: string }[] = [
  {
    name: "Tướng",
    englishName: "Heroes",
    path: "/hero",
    icon: (
      <>
        <path d="m24 3 11 10 3 16-7 12-7 4-7-4-7-12 3-16Z" />
        <path className="wiki-category-shade" d="m13 15-7 7 4 13 9 7-5-17Zm22 0 7 7-4 13-9 7 5-17Z" />
        <path className="wiki-category-light" d="m24 4 3 16-3 6-3-6Zm-10 9 7 7-8-2Zm20 0-7 7 8-2Z" />
        <path className="wiki-category-cutout" d="m15 23 8 3-2 5-6-4Zm18 0-8 3 2 5 6-4ZM22 33h4l-2 8Z" />
        <path className="wiki-category-light" d="m17 34 5 8-4-3Zm14 0-5 8 4-3Z" />
      </>
    ),
  },
  {
    name: "Trang phục",
    englishName: "Skins",
    path: "/skins",
    icon: (
      <>
        <path className="wiki-category-shade" d="m29 15 7-12 2 10 7-2-7 13ZM8 23l-5-7 8 2Z" />
        <path d="M6 14c7 4 11 3 18-2 7 5 11 6 18 2l-3 18c-4 5-9 8-15 11-6-3-11-6-15-11Z" />
        <path className="wiki-category-light" d="M8 16c7 3 11 1 16-2v7c-6-3-10-2-17-1Zm32 0-5 15-9 9 12-9Z" />
        <path className="wiki-category-cutout" d="m10 23 10 2-4 5-7-3Zm28 0-10 2 4 5 7-3ZM21 35h6l-3 3Z" />
        <path className="wiki-category-shade" d="m24 22 3 10h-6Z" />
      </>
    ),
  },
  {
    name: "Kho trang bị",
    englishName: "Armory",
    path: "/warehouse?tab=items",
    icon: (
      <>
        <path d="M4 4h7l20 23-5 5L4 11Zm40 0v7L22 32l-5-5L37 4Z" />
        <path className="wiki-category-light" d="m6 6 22 23-2 2L6 10Zm36 0L20 29l2 2 20-21Z" />
        <path className="wiki-category-cutout" d="m18 24 6 6 6-6-6-2Z" />
        <path className="wiki-category-shade" d="m25 30 4-4 12 11-4 4ZM7 37l12-11 4 4-12 11Z" />
        <path d="m21 33 12-12 3 3-12 12ZM12 24l3-3 12 12-3 3Z" />
        <path className="wiki-category-light" d="m37 38 4-1 3 5-2 2Zm-30 0-3-1-2 5 2 2Z" />
      </>
    ),
  },
  {
    name: "Bản đồ",
    englishName: "Maps",
    icon: (
      <>
        <path className="wiki-category-shade" d="m4 10 13-5 14 5 13-5v33l-13 5-14-5-13 5Z" />
        <path d="m5 10 12-5v32L5 42Zm26 0 12-5v32l-12 5Z" />
        <path className="wiki-category-light" d="m5 10 12-5v4L5 14Zm26 0 12-5v4l-12 5Z" />
        <path className="wiki-category-cutout" d="m9 29 4-7 4 2 6-7 8 4 7-6 2 2-9 8-7-4-6 7-4-2-3 5Z" />
        <path className="wiki-category-light" d="m37 11 3 4-3 4-3-4Z" />
        <circle className="wiki-category-light" cx="10" cy="30" r="2" />
      </>
    ),
  },
  {
    name: "Chế độ chơi",
    englishName: "Game modes",
    icon: (
      <>
        <path className="wiki-category-shade" d="M10 42V7h4v35Zm-4 2h17v-4H6Z" />
        <path d="M14 8c10-9 17 7 29-1l-3 10 3 10c-12 8-19-8-29 1Z" />
        <path className="wiki-category-light" d="M14 8c10-9 17 7 29-1l-2 5c-11 5-18-8-27-1Z" />
        <path className="wiki-category-cutout" d="m23 12 10 7-10 3Z" />
        <circle className="wiki-category-light" cx="12" cy="5" r="3" />
        <path d="M9 29h3v12H9Z" />
      </>
    ),
  },
]

export function HomeCategories() {
  const { locale, href } = useWikiContext()
  const gradientId = useId()

  return (
    <section className="wiki-categories" aria-label={wikiText(locale, "Danh mục wiki", "Wiki categories")}>
      <ul className="wiki-categories-list">
        {CATEGORIES.map(({ name, englishName, icon, path }, index) => (
          <li className={`wiki-categories-item${path ? " wiki-categories-item-linked" : ""}`} key={name}>
            <span className="wiki-categories-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48" fill={`url(#${gradientId}-${index})`}>
                <defs>
                  <linearGradient
                    id={`${gradientId}-${index}`}
                    x1="8"
                    y1="4"
                    x2="35"
                    y2="44"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#f1dfb0" />
                    <stop offset="0.5" stopColor="#d8b878" />
                    <stop offset="1" stopColor="#b18a4c" />
                  </linearGradient>
                </defs>
                {icon}
              </svg>
            </span>
            {path ? (
              <Link to={href(path)} className="wiki-categories-name wiki-categories-link">
                {wikiText(locale, name, englishName)}
              </Link>
            ) : (
              <span className="wiki-categories-name">{wikiText(locale, name, englishName)}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
