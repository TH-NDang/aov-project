import type { TournamentContent } from "@aov/community-contracts"
import { ThemedLogo } from "../../../components/themed-logo"
import "./competition-mark.css"

/** A competition's logo beside its name in a trail; one without a logo has none, and is its name alone. */
export function competitionMark({ logoUrl, logoDarkUrl }: Pick<TournamentContent, "logoUrl" | "logoDarkUrl">) {
  if (!logoUrl && !logoDarkUrl) return undefined
  return (
    <span className="tn-place-mark" aria-hidden="true">
      <ThemedLogo src={logoUrl} darkSrc={logoDarkUrl} />
    </span>
  )
}
