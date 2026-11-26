import type { Lane } from "@aov/community-contracts"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { capital } from "../../../lib/capital"
import { gamesText, laneName } from "../../../lib/feed-words"
import {
  asksAnything,
  choices,
  conditions,
  duelGames,
  findGames,
  namesSide,
  NOTHING_ASKED,
  soleHero,
  type ConditionKey,
} from "../../../lib/finder-model"
import {
  filtered,
  lengthCounts,
  lengthOf,
  playerChoices,
  playerTeams,
  SEATLESS_NOTHING,
  turnedAround,
  UNFILTERED,
} from "../../../lib/found-model"
import { conditionWords, lengthWords } from "../../../lib/question-words"
import { FilterMenu, FilterTokens, type FilterGroup } from "./filter-menu"
import type { Finder } from "./find-question"
import type { FilterOption } from "./schedule-controls"
import "./find-filters.css"

/** The filters that have no place on the board, each choice with the games it leaves; none leaves nothing. */
function useFilterGroups({ data, question, names }: Finder): FilterGroup[] {
  const { text } = useStreamLocale()
  const { games } = data.feed
  const { teams } = data.view.content
  const sided = namesSide(question)
  // The chip draws the games beside the name, as the chips of a hero's panel do.
  const counted = (value: string, name: string, count: number): FilterOption => [value, capital(name), undefined, count]
  /** The two values of a condition in their usual order, those that leave games. */
  const both = (key: "won" | "side", values: [string, string][]): FilterOption[] => {
    const counts = choices(games, question, key)
    return values.flatMap(([value, name]): FilterOption[] => {
      const count = counts.get(value)
      return count ? [counted(value, name, count)] : []
    })
  }
  const group = (key: string, label: string, value: string | null, options: FilterOption[]): FilterGroup => ({
    key,
    label,
    value: value ?? "all",
    options,
  })
  const ofAnyLength = findGames(games, { ...question, min: null, max: null })
  const asked = question.min != null || question.max != null
  const offered = lengthOf(question)
  const lengths = lengthCounts(ofAnyLength)
    .filter((length) => length.games > 0)
    .map((length) => counted(length.key, lengthWords(length, text), length.games))
  // Minutes of its own, from a link of another page, are one more choice while they are asked for.
  const own: FilterOption[] = asked && !offered ? [["own", capital(lengthWords(question, text))]] : []
  const homes = playerTeams(games)
  const won = question.won == null ? null : question.won ? "win" : "loss"
  // Two heroes who always met in one lane are not told apart by it, and those who never did have no such games.
  const duels = duelGames(games, question)
  const narrows = duels != null && (question.duel || (duels > 0 && duels < findGames(games, question).length))
  return [
    group(
      "won",
      text("Kết quả", "Result"),
      won,
      sided || won
        ? both("won", [
            ["win", text("thắng", "won")],
            ["loss", text("thua", "lost")],
          ])
        : [],
    ),
    group(
      "side",
      text("Bên", "Side"),
      question.side,
      sided || question.side
        ? both("side", [
            ["BLUE", text("bên xanh", "blue side")],
            ["RED", text("bên đỏ", "red side")],
          ])
        : [],
    ),
    group("length", text("Độ dài", "Length"), asked ? (offered?.key ?? "own") : null, [...own, ...lengths]),
    {
      ...group(
        "duel",
        text("Đối đầu", "Duel"),
        question.duel ? "on" : null,
        narrows ? [counted("on", text("cùng đường", "same lane"), duels)] : [],
      ),
      alone: true,
    },
    group(
      "lane",
      text("Đường", "Lane"),
      question.lane,
      soleHero(question)?.role === "pick" || question.player
        ? [...choices(games, question, "lane")]
            .sort((x, y) => y[1] - x[1])
            .map(([lane, count]) => counted(lane, laneName(lane as Lane, text), count))
        : [],
    ),
    group(
      "player",
      text("Tuyển thủ", "Player"),
      question.player,
      playerChoices(games, question).map(([id, count]): FilterOption => {
        const home = homes.get(id)
        const team = home ? teams[home] : undefined
        return [
          id,
          capital(names.player(id)),
          // With one team asked for, its crest before every name would say nothing.
          !question.team && home ? (
            <StreamImage src={team?.logoUrl} darkSrc={team?.logoDarkUrl} logo name={names.team(home)} />
          ) : undefined,
          count ?? undefined,
        ]
      }),
    ),
  ]
}

/** Two arrows past each other. */
function TurnIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 8h12m0 0-4-4m4 4-4 4M17 16H5m0 0 4-4m-4 4 4 4" />
    </svg>
  )
}

/** The foot of the board: the filters without a seat, the other side's view of the question, and letting go of it all. */
export function FindFoot({ finder }: { finder: Finder }) {
  const { text, languageTag } = useStreamLocale()
  const { question, found, ask } = finder
  const groups = useFilterGroups(finder)
  return (
    <div className="tn-find-foot">
      <FilterMenu
        title={text("Lọc ván", "Filter games")}
        groups={groups}
        result={gamesText(found.length, text, languageTag)}
        onChange={(key, value) => ask(filtered(question, key, value))}
        onReset={() => ask({ ...question, ...UNFILTERED })}
        className="tn-find-filter"
      />
      {namesSide(question) && (
        <button type="button" className="tn-find-act" onClick={() => ask(turnedAround(question), "answer")}>
          <TurnIcon />
          {text("Đổi hai bên", "Swap sides")}
        </button>
      )}
      {asksAnything(question) && (
        <button type="button" className="tn-find-act" onClick={() => ask(NOTHING_ASKED, "answer")}>
          {text("Xóa hết", "Clear all")}
        </button>
      )}
    </div>
  )
}

/** The conditions that have no seat on the board. */
const SEATLESS: Partial<Record<ConditionKey, readonly [string, string]>> = {
  duel: ["Đối đầu", "Duel"],
  lane: ["Đường", "Lane"],
  player: ["Tuyển thủ", "Player"],
  mvp: ["MVP", "MVP"],
  turn: ["Lượt", "Turn"],
  side: ["Bên", "Side"],
  won: ["Kết quả", "Result"],
  length: ["Độ dài", "Length"],
  days: ["Ngày", "Days"],
}

/** What is asked and has no seat on the board, each a chip that lets go of it. */
export function FindChips({ finder }: { finder: Finder }) {
  const { text, languageTag } = useStreamLocale()
  const { question, names, ask } = finder
  const asked = conditions(question).filter(({ key }) => SEATLESS[key])
  const groups = asked.map((condition): FilterGroup => ({
    key: condition.key,
    label: text(...SEATLESS[condition.key]!),
    value: "on",
    options: [["on", capital(conditionWords(condition, question, names, text, languageTag))]],
  }))
  return (
    <FilterTokens
      groups={groups}
      onChange={(key) => {
        const condition = asked.find((item) => item.key === key)
        if (condition) ask(condition.without, "answer")
      }}
      onReset={() => ask({ ...question, ...SEATLESS_NOTHING }, "answer")}
    />
  )
}
