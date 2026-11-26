import type { CSSProperties } from "react"
import { Link } from "react-router"
import type { Side } from "@aov/community-contracts"
import { useStreamLocale } from "../../../components/stream-locale"
import type { Sides } from "../../../lib/facts-model"
import { gamesText } from "../../../lib/feed-words"
import { sidesWords } from "../../../lib/highlights"
import { statsHref } from "../../../lib/statistics-routes"
import { FactWords } from "./fact-words"
import { Section } from "./section"
import type { StatsData } from "./stats-data"
import "./fact-sides.css"

/**
 * What the two sides of the map won, as two parts of one bar. The sentence says whether the difference is one that
 * chance makes, or one that the teams on the sides explain.
 */
export function FactSides({ data, sides }: { data: StatsData; sides: Sides }) {
  const { text, languageTag } = useStreamLocale()
  const words = sidesWords(sides, text, languageTag)
  const parts: [Side, number, string][] = [
    ["BLUE", sides.blue, text("Bên xanh thắng", "Blue side won")],
    ["RED", sides.red, text("Bên đỏ thắng", "Red side won")],
  ]
  return (
    <Section title={text("Bên xanh, bên đỏ", "Blue side, red side")}>
      <div className="tn-fact-sides">
        {words && <p>{words}</p>}
        <span className="tn-fact-sides-bar" aria-hidden="true">
          {parts.map(([side, count]) =>
            count > 0 ? <i key={side} data-side={side} style={{ "--part": count } as CSSProperties} /> : null,
          )}
        </span>
        <ul>
          {parts.map(([side, count, name]) => {
            const said = `${name} *${gamesText(count, text, languageTag)}*`
            return (
              <li key={side}>
                {count > 0 ? (
                  <Link to={statsHref(data.view.id, { question: { side, won: true }, scope: data.period?.key })}>
                    <FactWords words={said} />
                  </Link>
                ) : (
                  <FactWords words={said} />
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </Section>
  )
}
