import { Link } from "react-router"
import { Merge, Trophy } from "lucide-react"
import type { PlayerDirectoryEntry } from "@aov/community-contracts"
import { tournamentPath } from "@/features/esports/pages/esports-shell"
import { HeroIcon, LaneIcon, Monogram, PlayerPhoto } from "@/features/esports/components/primitives"
import { initials } from "@/features/esports/model/game-view"
import { CAREER_STATUSES } from "@/features/tournaments/components/tournament-metadata"
import { activityLabel } from "@/features/tournaments/model/record-reason"
import { LANE_LABELS } from "@/lib/lanes"
import { ProfileCountry } from "../components/profile-country"
import { yearRange } from "./directory-api"
import { PublishedMark } from "./directory-shell"
import { EntryAction, EntryPicture } from "./entry-parts"

const age = (birthDate?: string | null) => {
  const year = Number(birthDate?.slice(0, 4))
  return year ? new Date().getFullYear() - year : null
}

/** One player of the directory; a click anywhere opens the profile. */
export function PlayerRow({
  player,
  pageId,
  published,
  portrait,
  onOpen,
  onSheet,
}: {
  player: PlayerDirectoryEntry
  pageId?: string
  published?: boolean
  portrait: (name: string) => string | undefined
  onOpen?: () => void
  onSheet?: (sheet: "edit" | "merge") => void
}) {
  const years = age(player.birthDate)
  const latest = player.latestTournament
  return (
    <tr
      className="border-b align-middle transition last:border-b-0 hover:bg-muted/50 data-[open]:cursor-pointer"
      data-open={onOpen ? true : undefined}
      onClick={onOpen}
    >
      {/* On a phone the name gives way, so the actions stay on screen. */}
      <td className="px-4 py-2.5 @max-2xl:w-full @max-2xl:max-w-0">
        <div className="flex min-w-0 items-center gap-3">
          <EntryPicture missing={!player.photoUrl} label="Thiếu ảnh">
            <PlayerPhoto name={player.nickname} url={player.photoUrl ?? undefined} size={40} />
          </EntryPicture>
          <div className="min-w-0">
            <p className="type-section-title flex items-center gap-2">
              {pageId ? (
                <Link to={`/pages/${pageId}`} className="truncate" onClick={(event) => event.stopPropagation()}>
                  {player.nickname}
                </Link>
              ) : (
                <span className="truncate">{player.nickname}</span>
              )}
              <PublishedMark published={published} />
            </p>
            <p className="type-meta flex items-center gap-1.5">
              <ProfileCountry country={player.country} />
              <span className="max-w-48 truncate">{player.fullName || "Chưa có tên thật"}</span>
              {years !== null && <span className="shrink-0">· {years} tuổi</span>}
            </p>
            {player.latestTeam && <p className="type-meta truncate @2xl:hidden">{player.latestTeam.name}</p>}
            <p className="type-meta truncate @4xl:hidden">{activityLabel(player.lastActiveOn)}</p>
          </div>
        </div>
      </td>
      <td className="type-body px-3 py-2.5 whitespace-nowrap">
        {player.lane ? (
          <span className="inline-flex items-center gap-1.5">
            <LaneIcon lane={player.lane} size={16} className="text-muted-foreground" />
            <span className="@max-2xl:sr-only">{LANE_LABELS[player.lane].short}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">–</span>
        )}
      </td>
      <td className="type-body hidden px-3 py-2.5 @2xl:table-cell">
        {player.latestTeam ? (
          <span className="flex min-w-0 items-center gap-2">
            <Monogram
              url={player.latestTeam.logoUrl}
              darkUrl={player.latestTeam.logoDarkUrl}
              label={`Logo ${player.latestTeam.name}`}
              text={player.latestTeam.shortName || initials(player.latestTeam.name).slice(0, 3)}
              size={24}
              className="shrink-0 rounded"
            />
            <span className="max-w-40 truncate">{player.latestTeam.name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">–</span>
        )}
      </td>
      <td className="hidden px-3 py-2.5 @6xl:table-cell">
        <span className="flex flex-nowrap items-center gap-1">
          {player.signatureHeroes.slice(0, 3).map((hero) => {
            const iconUrl = portrait(hero)
            // Only published heroes have a portrait; two letters would say less than the name.
            return iconUrl ? (
              <HeroIcon key={hero} hero={{ name: hero, iconUrl }} size={28} />
            ) : (
              <span key={hero} className="type-meta rounded bg-muted px-1.5 py-0.5 capitalize">
                {hero}
              </span>
            )
          })}
        </span>
      </td>
      <td className="type-body esp-num hidden px-3 py-2.5 text-right tabular-nums @2xl:table-cell">
        {player.tournaments}
      </td>
      <td className="type-body esp-num hidden px-3 py-2.5 text-right tabular-nums @2xl:table-cell">
        {player.titles ? (
          <span className="inline-flex items-center gap-1">
            <Trophy size={14} className="text-[var(--esp-gold-text)]" aria-hidden="true" />
            {player.titles}
          </span>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </td>
      <td className="type-meta hidden max-w-40 px-3 py-2.5 @4xl:table-cell">
        {latest && (
          <Link
            to={tournamentPath(latest.id)}
            className="block truncate underline-offset-2 hover:text-foreground hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {latest.name}
            {!/\b20\d\d\b/.test(latest.name) && latest.year ? ` · ${yearRange(latest.year, latest.year)}` : ""}
          </Link>
        )}
        <span className="block truncate">{activityLabel(player.lastActiveOn)}</span>
      </td>
      <td className="type-meta hidden px-3 py-2.5 whitespace-nowrap @4xl:table-cell">
        {player.careerStatus === "UNKNOWN" ? "–" : CAREER_STATUSES[player.careerStatus]}
      </td>
      {onSheet && (
        <td className="sticky right-0 w-20 bg-card pr-2 text-right whitespace-nowrap">
          <EntryAction label={`Gộp hồ sơ ${player.nickname}`} icon={Merge} onClick={() => onSheet("merge")} />
          <EntryAction label={`Sửa hồ sơ ${player.nickname}`} onClick={() => onSheet("edit")} />
        </td>
      )}
    </tr>
  )
}
