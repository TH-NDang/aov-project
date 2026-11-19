import { useState, type ReactNode } from "react"
import { Link } from "react-router"
import type { CompetitionView } from "@aov/community-contracts"
import { LocalMoney, LocalPrizeText } from "@aov/ui/components/local-money"
import { LocalTime } from "@aov/ui/components/local-time"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { EntityPageLink } from "../../components/public-competitions"
import {
  codeName,
  COMPETITION_TYPE_NAMES,
  playedOrder,
  STAGE_FORMAT_NAMES,
  VENUE_MODE_NAMES,
} from "../../lib/competition-model"
import { awardGroups } from "./competition-page-model"

/** The facts of the competition: organizer, prize pool, format, venues, time zone and its sources. */
export function Facts({ view }: { view: CompetitionView }) {
  const { text, languageTag } = useStreamLocale()
  const { tournament, plan, organizer } = view.content
  const venues = plan.venues.filter((venue) => venue.name || venue.city)
  const rows: [string, ReactNode][] = [
    [
      text("Đơn vị tổ chức", "Organizer"),
      organizer ? (
        <Link className="cp-organizer" to={`/pages/${organizer.code}`}>
          {organizer.logoUrl && <img src={organizer.logoUrl} alt="" />}
          {organizer.name}
        </Link>
      ) : (
        plan.organizer
      ),
    ],
    [
      text("Quỹ giải thưởng", "Prize pool"),
      plan.prizePool && (
        <LocalPrizeText
          text={plan.prizePool}
          currency={plan.currency}
          on={tournament.endsOn ?? tournament.startsOn}
          locale={languageTag}
        />
      ),
    ],
    [
      text("Hình thức", "Format"),
      [
        codeName(COMPETITION_TYPE_NAMES, tournament.competitionType, text),
        codeName(VENUE_MODE_NAMES, tournament.venueMode, text),
      ]
        .filter(Boolean)
        .join(" · "),
    ],
    [
      text("Địa điểm", "Venue"),
      venues.length > 0 &&
        venues.map((venue, index) => <div key={index}>{[venue.name, venue.city].filter(Boolean).join(", ")}</div>),
    ],
    [text("Múi giờ của lịch", "Schedule time zone"), plan.timezone],
  ]
  const links = [
    ...(tournament.links ?? []),
    ...(plan.sourceUrl && !(tournament.links ?? []).some((link) => link.url === plan.sourceUrl)
      ? [{ label: text("Nguồn kiểm chứng", "Verification source"), url: plan.sourceUrl }]
      : []),
  ]
  return (
    <section className="tn-side-card">
      <h2>{text("Thông tin", "Information")}</h2>
      <dl className="tn-facts">
        {rows.map(([label, value]) =>
          value ? (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ) : null,
        )}
      </dl>
      {links.length > 0 && (
        <ul className="tn-links">
          {links.map((link) => (
            <li key={link.url}>
              <a href={link.url} target="_blank" rel="noreferrer noopener">
                {link.label}
                <StreamIcon name="external" size={13} />
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="cp-meta">
        {text("Cập nhật:", "Updated:")} <LocalTime value={view.publishedAt} locale={languageTag} />
      </p>
    </section>
  )
}

/** The rules that order teams level on points, in Vietnamese and in English. */
const TIE_BREAKERS: Record<string, readonly [string, string]> = {
  HEAD_TO_HEAD: ["đối đầu", "head-to-head"],
  GAME_DIFF: ["hiệu số ván", "game difference"],
  GAME_WINS: ["số ván thắng", "game wins"],
}

/** The stages in the order they are played, with their format, best-of and tiebreakers. */
export function Format({ view }: { view: CompetitionView }) {
  const { text } = useStreamLocale()
  const { plan } = view.content
  if (!plan.stages.length) return null
  return (
    <section className="tn-side-card">
      <h2>{text("Thể thức", "Format")}</h2>
      <ol className="tn-stages">
        {playedOrder(plan.stages, plan.matches).map((stage) => (
          <li key={stage.code}>
            <strong>{stage.name}</strong>
            <span>
              {[
                codeName(STAGE_FORMAT_NAMES, stage.format, text) ?? text("Lịch riêng", "Custom schedule"),
                `BO${stage.bestOf}`,
                stage.format === "ROUND_ROBIN" && stage.legs > 1 && text(`${stage.legs} lượt`, `${stage.legs} legs`),
                stage.format === "ROUND_ROBIN" &&
                  stage.advance > 0 &&
                  text(
                    `${stage.advance} đội đi tiếp`,
                    `${stage.advance} ${stage.advance === 1 ? "team advances" : "teams advance"}`,
                  ),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {stage.format === "ROUND_ROBIN" && stage.tieBreakers.length > 0 && (
              <small>
                {text("Xếp hạng phụ:", "Tiebreakers:")}{" "}
                {stage.tieBreakers.map((rule) => (TIE_BREAKERS[rule] ? text(...TIE_BREAKERS[rule]) : rule)).join(" → ")}
              </small>
            )}
            {stage.patchNote && <small>{stage.patchNote}</small>}
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Awards grouped by title, since a weekly award names several players. The first few show; the rest unfold. */
export function Awards({ view }: { view: CompetitionView }) {
  const { text, languageTag } = useStreamLocale()
  const { tournament } = view.content
  const [open, setOpen] = useState(false)
  const all = awardGroups(tournament.awards ?? [])
  if (!all.length) return null
  const shown = open ? all : all.slice(0, 4)
  return (
    <section className="tn-side-card">
      <h2>{text("Giải thưởng cá nhân", "Individual awards")}</h2>
      <dl className="tn-awards">
        {shown.map(([title, awards]) => (
          <div key={title}>
            <dt>{title}</dt>
            {awards.map((award, index) => (
              <dd key={index}>
                <strong>
                  {award.playerId ? (
                    <EntityPageLink kind="PLAYER" id={award.playerId} name={award.recipientName} />
                  ) : (
                    award.recipientName
                  )}
                </strong>
                {award.teamName && <span>{award.teamName}</span>}
                {(award.prizeUsd != null || award.prizeLocal != null) && (
                  <LocalMoney
                    amounts={[
                      { amount: award.prizeUsd, currency: "USD" },
                      { amount: award.prizeLocal, currency: tournament.localCurrency },
                    ]}
                    on={tournament.endsOn ?? tournament.startsOn}
                    locale={languageTag}
                    compact
                  />
                )}
              </dd>
            ))}
          </div>
        ))}
      </dl>
      {all.length > 4 && (
        <button type="button" className="tn-more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open
            ? text("Thu gọn", "Show less")
            : text(
                `Xem thêm ${all.length - 4} giải thưởng`,
                `Show ${all.length - 4} more ${all.length - 4 === 1 ? "award" : "awards"}`,
              )}
        </button>
      )}
    </section>
  )
}
