import { useState } from "react"
import { ThemedLogo } from "./themed-logo"
import type { ChampionTeam } from "../lib/champion-model"
import "./crest.css"

/** A team's logo on a shield; a logo with a single version brings the ground it was drawn for along. */
export function Crest({ team }: { team: Pick<ChampionTeam, "name" | "shortName" | "logoUrl" | "logoDarkUrl"> }) {
  const [failed, setFailed] = useState<string[]>([])
  const usable = (url: string | null | undefined) => (url && !failed.includes(url) ? url : null)
  const light = usable(team.logoUrl)
  const dark = usable(team.logoDarkUrl)
  return (
    <span className="tn-shield" data-ground={light && !dark ? "light" : dark && !light ? "dark" : undefined}>
      <span>
        {dark || light ? (
          <ThemedLogo src={light} darkSrc={dark} onError={(url) => setFailed((list) => [...list, url])} />
        ) : (
          <b aria-hidden="true">{(team.shortName || team.name).slice(0, 3).toLocaleUpperCase("vi-VN")}</b>
        )}
      </span>
    </span>
  )
}
