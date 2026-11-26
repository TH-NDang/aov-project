/**
 * The recording desk of one game for the tests of its tools: game 2 of Azure (blue) against Crimson (red), one hour
 * into the broadcast of the match. What a tool records is kept, and `Host` draws the tool again with it, as the page
 * does once a save was answered.
 */
import { createElement, Fragment, useSyncExternalStore, type ReactNode } from "react"
import type { Catalog, DocumentView, GameContent, Lane, Reference, Side } from "@aov/community-contracts"
import type { MomentForm, RecordedChange } from "../../src/features/esports/model/desk"
import { buildGameView } from "../../src/features/esports/model/game-view"
import { itemLookups } from "../../src/features/esports/model/item-lookups"
import type { RosterOption } from "../../src/features/esports/model/line-up"
import { createPlayhead } from "../../src/features/esports/model/playhead"
import { recordingProgress } from "../../src/features/esports/model/recording-progress"
import { chapterVideo, layoutChapters } from "../../src/features/esports/model/series-vod"
import type { GameDesk } from "../../src/features/esports/pages/game-desk"
import { initialGame } from "../../src/features/tournaments/model/tournament-model"
import { match, view } from "./match-records"

export const VIDEO = "j8AvYygkzm4"
export const VIDEO_URL = `https://www.youtube.com/watch?v=${VIDEO}`

const LANES: readonly Lane[] = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"]
/** The heroes of each side in lane order. */
export const HEROES: Record<Side, readonly string[]> = {
  BLUE: ["Maloch", "Nakroth", "Tulen", "Violet", "Alice"],
  RED: ["Florentino", "Murad", "Lauriel", "Capheny", "Zip"],
}
const BANS: Record<Side, readonly string[]> = {
  BLUE: ["Aoi", "Keera", "Yena", "Qi"],
  RED: ["Elsu", "Omen", "Ryoma", "Marja"],
}

export const selection = (name: string) => ({ id: name.toLowerCase(), name })
const reference = (name: string, extra: Partial<Reference> = {}): Reference => ({
  ...selection(name),
  code: name.toLowerCase(),
  ...extra,
})

export const catalog: Catalog = {
  heroes: [...HEROES.BLUE, ...HEROES.RED, ...BANS.BLUE, ...BANS.RED, "Biron", "Hayate"].map((name) => reference(name)),
  items: [
    reference("Kiếm ngắn", { tier: 1 }),
    reference("Gươm Loki", { tier: 3 }),
    reference("Thánh kiếm", { tier: 3 }),
  ],
  arcana: [],
  enchantments: [],
  spells: [reference("Tốc biến"), reference("Trừng trị")],
}

const teams = [
  view("a", { code: "azure", name: "Azure", shortName: "AZU" }),
  view("b", { code: "crimson", name: "Crimson", shortName: "CRI" }),
]
/** One player a lane for each team, such as `a-TOP`, called "AZU Top". */
const members = (teamId: string): RosterOption[] =>
  LANES.map((lane) => ({
    id: `${teamId}-${lane}`,
    name: `${teamId === "a" ? "AZU" : "CRI"} ${lane.charAt(0)}${lane.slice(1).toLowerCase()}`,
    lane,
    status: "ACTIVE",
  }))
const players = ["a", "b"].flatMap(members).map(({ id, name }) => view(id, { code: id, nickname: name }))

/** An empty game 2 of the match, on the video of the match. */
export const emptyGame = (change: Partial<GameContent> = {}): GameContent => ({
  ...initialGame("s", match().content, 2),
  sourceUrl: VIDEO_URL,
  ...change,
})

/** Game 2 with its line-ups and its place in the video: draft 52:34, lock 58:10, 0:00 at 1:01:58, 13:22 long. */
export const recordedGame = (change: Partial<GameContent> = {}): GameContent => {
  const content = emptyGame()
  return {
    ...content,
    sourceTimestampSeconds: 3718,
    durationSeconds: 802,
    winner: "RED",
    draft: { startSecond: 3154, lockedSecond: 3490, turns: [] },
    sides: content.sides.map((side) => ({
      ...side,
      bans: BANS[side.side].map(selection),
      participants: side.participants.map((participant, index) => ({
        ...participant,
        playerId: `${side.teamId}-${participant.lane}`,
        hero: selection(HEROES[side.side][index]!),
        spell: selection("Tốc biến"),
      })),
    })),
    ...change,
  }
}

export type DeskOptions = Partial<GameDesk> & {
  content?: GameContent
  /** Second of the video on screen. */
  at?: number
  /** The document around the content, such as when it was published. */
  document?: Partial<DocumentView<GameContent>>
}

/** What the desk was asked for, and the game as that left it. */
export type Kept = {
  content: () => GameContent
  changes: RecordedChange[]
  said: string[]
  /** Seconds of the video the tool went to. */
  seeks: number[]
  opened: string[]
  /** Takes the last change back, as the foot does. */
  undo: () => Promise<void>
  /** Answers the next writes with a refusal, or takes them again. */
  refuse: (refused: boolean) => void
  /** Leaves the next writes without an answer until the function it returns is called. */
  hold: () => () => void
  /** Moves the video, as playing does. */
  play: (second: number) => void
  /** Draws a tool with the desk as it is, and again after every change. */
  Host: (props: { children: (desk: GameDesk) => ReactNode }) => ReactNode
}

/** A desk that keeps what is recorded on it. */
export function deskOf({
  content: start = recordedGame(),
  at = 4158,
  document: extra,
  ...overrides
}: DeskOptions = {}): GameDesk & {
  kept: Kept
} {
  let content = start
  let version = 1
  let refused = false
  let held: Promise<void> | null = null
  let activeId = overrides.activeId ?? null
  let form: MomentForm | null = overrides.form ?? null
  const listeners = new Set<() => void>()
  const playhead = createPlayhead(at)
  const videoId = overrides.videoId === undefined ? VIDEO : overrides.videoId
  const heroes = overrides.heroes ?? catalog.heroes
  const items = overrides.items ?? catalog.items
  const lookups = itemLookups(items)
  const changes: RecordedChange[] = []
  const said: string[] = []
  const seeks: number[] = []
  const opened: string[] = []

  const draw = () => {
    current = build()
    for (const listener of listeners) listener()
  }
  const write = async (change: (content: GameContent) => GameContent) => {
    if (held) await held
    if (refused) return false
    content = change(content)
    version++
    draw()
    return true
  }

  const build = (): GameDesk => {
    const entry = { ...view("g2", content, { version, ...extra }), content }
    const chapter = layoutChapters([entry], videoId)[0]!
    return {
      entry,
      view: buildGameView(entry, teams, players, catalog),
      chapter,
      progress: recordingProgress(entry),
      catalog,
      catalogError: undefined,
      reloadCatalog: () => {},
      heroes,
      spells: catalog.spells,
      items,
      lookups,
      roster: members,
      locks: { decider: false, byTeam: new Map() },
      previous: null,
      tournamentId: "t",
      editable: true,
      canPublish: true,
      compact: false,
      playhead,
      playing: false,
      markNow: () => (videoId === null ? null : Math.floor(playhead.get())),
      record: async (change) => {
        const accepted = await write(change.apply)
        if (accepted) changes.push(change)
        return accepted
      },
      save: write,
      saveError: null,
      publish: async () => true,
      withdraw: async () => {
        opened.push("withdraw")
        return true
      },
      seekVideo: (second) => seeks.push(second),
      seekGame: (second) => seeks.push(chapterVideo(chapter, second)),
      shareLink: (second) => `http://localhost:5175/tournaments/t/matches/s?t=${Math.round(second)}`,
      openTool: (tool) => opened.push(tool),
      openPanel: (panel) => opened.push(panel ?? "none"),
      say: (text) => said.push(text),
      onActive: (id) => {
        activeId = id
        draw()
      },
      onForm: (next) => {
        form = next
        draw()
      },
      onDeleted: () => opened.push("deleted"),
      ...overrides,
      videoId,
      activeId,
      form,
    }
  }

  let current = build()
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  const kept: Kept = {
    content: () => content,
    changes,
    said,
    seeks,
    opened,
    undo: async () => {
      const last = changes.pop()
      if (last?.revert) await write(last.revert)
    },
    refuse: (value) => {
      refused = value
    },
    hold: () => {
      let answer = () => {}
      held = new Promise((resolve) => (answer = resolve))
      return () => {
        held = null
        answer()
      }
    },
    play: (second) => playhead.set(second),
    Host: ({ children }) => createElement(Fragment, null, children(useSyncExternalStore(subscribe, () => current))),
  }
  return { ...current, kept }
}
