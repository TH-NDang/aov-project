import type { ReactNode } from "react"
import type { TournamentContent } from "@aov/community-contracts"
import { ArrowRight } from "lucide-react"
import { RegistryLogo } from "./registry-logo"

export type ListedChange = {
  id: string
  tournament: Pick<TournamentContent, "name" | "logoUrl" | "logoDarkUrl">
  /** What it says now and what it will say; without `to` the row only tells `from`, such as why it stays. */
  from?: ReactNode
  to?: ReactNode
}

/** The tournaments a question is about, each with its old value and the new one. */
export function ChangeList({ changes }: { changes: ListedChange[] }) {
  return (
    <ul className="grid max-h-72 gap-px overflow-y-auto rounded-md border bg-border">
      {changes.map(({ id, tournament, from, to }) => (
        <li key={id} className="flex min-w-0 items-center gap-3 bg-background px-3 py-2">
          <RegistryLogo url={tournament.logoUrl} darkUrl={tournament.logoDarkUrl} name={tournament.name} />
          <span className="min-w-0">
            <span className="type-body block break-words">{tournament.name}</span>
            {(from || to) && (
              <span className="type-meta flex flex-wrap items-center gap-x-1.5">
                {from}
                {to && (
                  <>
                    <ArrowRight aria-label="thành" className="size-3.5 shrink-0" />
                    <span className="text-foreground">{to}</span>
                  </>
                )}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}
