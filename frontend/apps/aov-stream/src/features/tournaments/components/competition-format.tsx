import type { CompetitionStage, CompetitionView, DraftRule, StagePatch } from "@aov/community-contracts"
import { formatCalendarDate } from "@aov/ui/lib/time-zone"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { codeName, playedOrder, STAGE_FORMAT_NAMES } from "../../../lib/competition-model"
import { stageName } from "../../../lib/match-labels"
import { stagePhases } from "../../../lib/stage-phases"
import { Section } from "./section"
import "./competition-format.css"

/** The rules that order teams level on points, in Vietnamese and in English. */
const TIE_BREAKERS: Record<string, readonly [string, string]> = {
  HEAD_TO_HEAD: ["đối đầu", "head-to-head"],
  GAME_DIFF: ["hiệu số ván", "game difference"],
  GAME_WINS: ["số ván thắng", "game wins"],
}

/** The draft rule of a stage, in Vietnamese and in English. */
const DRAFT_RULES: Record<DraftRule, readonly [string, string]> = {
  GLOBAL: [
    "Cấm chọn toàn cục: đội không chọn lại tướng đã dùng trong loạt",
    "Global ban/pick: no team picks a hero again in a series",
  ],
  STANDARD: ["Cấm chọn thường", "Standard ban/pick"],
}

/** One game update used during a stage: when it was used, its name and day, and the publisher's notes. */
function Patch({ patch }: { patch: StagePatch }) {
  const { text, languageTag } = useStreamLocale()
  const day = patch.releasedOn && formatCalendarDate(patch.releasedOn, undefined, languageTag)
  return (
    <li>
      <strong>
        {patch.name || (day ? text(`Bản ${day}`, `Patch of ${day}`) : text("Bản cập nhật", "Game update"))}
      </strong>
      <span className="tn-patch-facts">
        {patch.label && <span>{patch.label}</span>}
        {patch.seasonName && <span>{patch.seasonName}</span>}
        {patch.name && day && <span>{text(`ra mắt ${day}`, `released ${day}`)}</span>}
      </span>
      {patch.note?.trim() && <span>{patch.note}</span>}
      {patch.sourceUrl && (
        <a href={patch.sourceUrl} target="_blank" rel="noreferrer noopener">
          {text("Ghi chú cập nhật", "Patch notes")}
          <StreamIcon name="external" size={13} />
        </a>
      )}
    </li>
  )
}

/** The rules of a stage as short lines, each said once. */
function stageRules(stage: CompetitionStage, text: (vi: string, en: string) => string) {
  const roundRobin = stage.format === "ROUND_ROBIN"
  return [
    roundRobin && stage.legs > 1 && text(`Đấu ${stage.legs} lượt`, `${stage.legs} legs`),
    roundRobin &&
      stage.advance > 0 &&
      text(
        `${stage.advance} đội đi tiếp`,
        `${stage.advance} ${stage.advance === 1 ? "team advances" : "teams advance"}`,
      ),
    roundRobin &&
      stage.tieBreakers.length > 0 &&
      text("Bằng điểm thì xét ", "Level on points: ") +
        stage.tieBreakers
          .map((rule) => (TIE_BREAKERS[rule] ? text(...TIE_BREAKERS[rule]) : rule))
          .join(text(", rồi ", ", then ")),
    stage.draftRule && text(...DRAFT_RULES[stage.draftRule]),
    stage.sideSelection === "HOME_FIRST_THEN_LOSER" &&
      text(
        "Chọn bên: đội đứng trước chọn ván 1, sau đó đội thua chọn",
        "Sides: the first-listed team picks in game 1, then the loser of each game",
      ),
    stage.rulesNote?.trim(),
  ].filter((rule): rule is string => !!rule)
}

/** How a competition is played: each stage in order with its dates, its rules and the game updates used in it. */
export function CompetitionFormat({ view }: { view: CompetitionView }) {
  const { text, languageTag } = useStreamLocale()
  const { plan } = view.content
  if (!plan.stages.length) return null
  const phases = new Map(stagePhases(view).map((phase) => [phase.stage.code, phase]))
  const day = (value: string) => formatCalendarDate(value, undefined, languageTag)
  return (
    <Section title={text("Thể thức và bản cập nhật", "Format and game updates")}>
      <ol className="tn-format">
        {playedOrder(plan.stages, plan.matches).map((stage) => {
          const phase = phases.get(stage.code)
          const rules = stageRules(stage, text)
          return (
            <li key={stage.code}>
              <header>
                <h3>{stageName(stage.name)}</h3>
                <p>
                  <span>
                    {codeName(STAGE_FORMAT_NAMES, stage.format, text) ?? text("Lịch riêng", "Custom schedule")}
                  </span>
                  <span>BO{stage.bestOf}</span>
                  {phase?.startsOn && phase.endsOn && (
                    <span>
                      {phase.startsOn === phase.endsOn
                        ? day(phase.startsOn)
                        : `${day(phase.startsOn)} – ${day(phase.endsOn)}`}
                    </span>
                  )}
                </p>
              </header>
              {rules.length > 0 && (
                <ul className="tn-format-rules">
                  {rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              )}
              {!!stage.patches?.length && (
                <ul className="tn-patches" aria-label={text("Bản cập nhật đã dùng", "Game updates used")}>
                  {stage.patches.map((patch, index) => (
                    <Patch key={index} patch={patch} />
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ol>
    </Section>
  )
}
