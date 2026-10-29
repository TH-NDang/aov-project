import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import type {
  Catalog,
  DraftTurn,
  DocumentView,
  EquipmentSnapshot,
  GameContent,
  Lane,
  Participant,
  PlayerContent,
  RosterMembershipContent,
  SeriesContent,
  Side,
  TeamContent,
  TournamentContent,
} from "@aov/community-contracts"
import { readTimeline, withPlayback, writeTimeline } from "../../src/features/esports/model/timeline-io"
import type { TimelineEvent } from "../../src/features/esports/model/timeline"

// Synthetic teams, players and events for UI checks only. Not real results.
const R = "/__resources/assets"
const doc = <T>(id: string, content: T, extra: Partial<DocumentView<T>> = {}): DocumentView<T> => ({
  id,
  version: 1,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  missingFields: [],
  content,
  ...extra,
})

export const TOURNAMENT_ID = "fx-tournament"
export const SERIES_ID = "fx-series-final"
export const GAME_ID = "fx-game-1"
const VIDEO = "https://youtu.be/R5rCsGqDJIg"

const teamNames = [
  ["fx-azure", "Azure Tide", "AZT"],
  ["fx-ember", "Ember Wolves", "EMW"],
  ["fx-jade", "Jade Lotus", "JDL"],
  ["fx-onyx", "Onyx Crown", "ONX"],
] as const
export const teams = teamNames.map(([id, name, shortName]) =>
  doc<TeamContent>(id, { code: id, name, shortName, country: "VN" }),
)

const lanes: Lane[] = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"]
export const players = teamNames.flatMap(([teamId, , short]) =>
  lanes.map((lane, index) =>
    doc<PlayerContent>(`${teamId}-p${index}`, {
      code: `${teamId}-p${index}`,
      nickname: `${short} ${["Rock", "Shade", "Nova", "Volt", "Halo"][index]}`,
    }),
  ),
)
export const rosters = teamNames.flatMap(([teamId], teamIndex) =>
  lanes.map((lane, index) =>
    doc<RosterMembershipContent>(`fx-roster-${teamIndex}-${index}`, {
      tournamentId: TOURNAMENT_ID,
      teamId,
      playerId: `${teamId}-p${index}`,
      lane,
      status: "ACTIVE",
    }),
  ),
)

export const tournament = doc<TournamentContent>(TOURNAMENT_ID, {
  code: "fx-cup",
  name: "Cúp Thử Nghiệm Mùa Thu 2026",
  region: "VN",
  year: 2026,
  startsOn: "2026-09-01",
  endsOn: "2026-11-30",
  tier: "A",
  competitionType: "LEAGUE",
  venueMode: "OFFLINE",
  status: "ONGOING",
  note: "Dữ liệu giả lập dùng để kiểm thử giao diện.",
})

const pairs: [string, string, number, number][] = [
  ["fx-azure", "fx-ember", 3, 1],
  ["fx-jade", "fx-onyx", 2, 3],
  ["fx-azure", "fx-jade", 3, 0],
  ["fx-ember", "fx-onyx", 3, 2],
  ["fx-azure", "fx-onyx", 1, 3],
  ["fx-ember", "fx-jade", 3, 1],
]
export const series = [
  ...pairs.map(([a, b, scoreA, scoreB], index) =>
    doc<SeriesContent>(`fx-series-${index}`, {
      code: `fx-series-${index}`,
      tournamentId: TOURNAMENT_ID,
      name: `Vòng ${index + 1}`,
      stage: "REGULAR_SEASON_FIRST_LEG",
      teamAId: a,
      teamBId: b,
      bestOf: 5,
      scheduledAt: `2026-09-${String(5 + index * 3).padStart(2, "0")}T11:00:00Z`,
      result: { scoreA, scoreB, sourceUrl: "https://example.test/source", verification: "UNVERIFIED" },
    }),
  ),
  doc<SeriesContent>("fx-series-semi", {
    code: "fx-series-semi",
    tournamentId: TOURNAMENT_ID,
    name: "Bán kết nhánh thắng · EMW – ONX",
    stage: "UPPER_BRACKET_SEMIFINAL",
    teamAId: "fx-ember",
    teamBId: "fx-onyx",
    bestOf: 5,
    scheduledAt: "2026-10-20T11:00:00Z",
  }),
  doc<SeriesContent>(SERIES_ID, {
    code: "fx-final",
    tournamentId: TOURNAMENT_ID,
    name: "Bán kết nhánh thắng · AZT – EMW",
    stage: "UPPER_BRACKET_SEMIFINAL",
    teamAId: "fx-azure",
    teamBId: "fx-ember",
    bestOf: 5,
    scheduledAt: "2026-10-19T11:00:00Z",
    sourceUrl: VIDEO,
    result: { scoreA: 3, scoreB: 1, sourceUrl: VIDEO, verification: "UNVERIFIED" },
  }),
]

const heroes = [
  ["florentino", "Florentino", "jpg"],
  ["nakroth", "Nakroth", "jpg"],
  ["lauriel", "Lauriel", "jpg"],
  ["capheny", "Capheny", "jpg"],
  ["grakk", "Grakk", "png"],
  ["omen", "Omen", "jpg"],
  ["murad", "Murad", "jpg"],
  ["liliana", "Liliana", "jpg"],
  ["elsu", "Elsu", "jpg"],
  ["alice", "Alice", "png"],
  ["eland-orr", "Eland'orr", "jpg"],
  ["aoi", "Aoi", "jpeg"],
  ["bijan", "Bijan", "jpg"],
  ["keera", "Keera", "jpg"],
  ["ata", "Ata", "jpg"],
  ["iggy", "Iggy", "jpeg"],
  ["dyadia", "Dyadia", "jpg"],
  ["hayate", "Hayate", "jpg"],
] as const
const spells = [
  ["toc-bien", "Tốc biến", "png"],
  ["trung-tri", "Trừng trị", "png"],
  ["cap-cuu", "Cấp cứu", "png"],
  ["ngat-ngu", "Ngất ngư", "png"],
] as const
const items = [
  ["kiem-ngan", "Kiếm ngắn"],
  ["giap-thong-kho", "Giáp thống khổ"],
  ["thuong-longinus", "Thương Longinus"],
  ["kiem-muramasa", "Kiếm Muramasa"],
  ["sach-thanh", "Sách thánh"],
  ["vuong-mien-hecate", "Vương miện Hecate"],
  ["truong-hon-mang", "Trượng hỗn mang"],
  ["xa-nhat-cung", "Xạ Nhật cung"],
  ["diet-than-cung", "Diệt thần cung"],
  ["nanh-fenrir", "Nanh Fenrir"],
  ["guom-loki", "Gươm Loki"],
  ["giap-ho-menh", "Giáp hộ mệnh"],
  ["huan-chuong-troy", "Huân chương Troy"],
  ["liet-hoa-hoi-huyet", "Liệt hoả hồi huyết"],
] as const

export const catalog: Catalog = {
  heroes: heroes.map(([id, name, ext]) => ({ id, code: id, name, iconUrl: `${R}/hero/head/${id}-1-head.${ext}` })),
  spells: spells.map(([id, name, ext]) => ({ id, code: id, name, iconUrl: `${R}/phu-tro/${id}.${ext}` })),
  // Everything except the starter sword is a finished (tier 3) item, so the bar shows it.
  items: items.map(([id, name]) => ({
    id,
    code: id,
    name,
    tier: id === "kiem-ngan" ? 1 : 3,
    iconUrl: `${R}/trang-bi/${id}.png`,
  })),
  arcana: [],
  enchantments: [],
  resolvedContext: { region: "VN", locale: "vi-VN", unknown: true, includeUnscoped: false },
}
/** Wiki entries as the admin reference catalogue returns them; descriptions are sample text for the fixture only. */
export const references: EntityReference[] = [
  ...heroes.map(([id, name]) => ({
    id,
    kind: "hero" as const,
    translations: [{ locale: "vi-VN", name, aliases: [], description: `Mô tả wiki mẫu của tướng ${name}.` }],
    destinations: { admin: `/hero/${id}` },
  })),
  ...items.map(([id, name]) => ({
    id,
    kind: "item" as const,
    translations: [
      {
        locale: "vi-VN",
        name,
        aliases: [],
        description: `Mô tả wiki mẫu của trang bị ${name}.
Nội tại: dòng mô tả thứ hai để xem bố cục thẻ.`,
      },
    ],
    destinations: { admin: `/items?item=${id}` },
  })),
  ...spells.map(([id, name]) => ({
    id,
    kind: "spell" as const,
    translations: [{ locale: "vi-VN", name, aliases: [], description: `Mô tả wiki mẫu của phụ trợ ${name}.` }],
    destinations: { admin: `/spells?item=${id}` },
  })),
]

const hero = (index: number) => ({ id: heroes[index][0], name: heroes[index][1] })
const item = (id: string) => ({ id, name: items.find((entry) => entry[0] === id)![1] })
const spell = (index: number) => ({ id: spells[index][0], name: spells[index][1] })

function snapshot(atSeconds: number, ids: (string | null)[]): EquipmentSnapshot {
  return {
    atSeconds,
    slots: Array.from({ length: 6 }, (_, index) => ({
      slot: index + 1,
      known: index < ids.length,
      item: ids[index] ? item(ids[index]!) : null,
    })),
  }
}

function side(code: Side, teamId: string, offset: number, bans: number[]) {
  return {
    side: code,
    teamId,
    bans: bans.map(hero),
    participants: lanes.map((lane, index): Participant => ({
      playerId: `${teamId}-p${index}`,
      lane,
      hero: hero(offset + index),
      spell: spell(lane === "JUNGLE" ? 1 : index === 4 ? 3 : 0),
      arcana: { status: "NOT_SHOWN", entries: [] },
      enchantments: { status: "UNKNOWN", entries: [] },
      equipmentSnapshots:
        code === "BLUE" && lane === "MID"
          ? [
              snapshot(360, ["sach-thanh", null, null]),
              snapshot(720, ["sach-thanh", "vuong-mien-hecate", "truong-hon-mang", null]),
            ]
          : [],
      equipmentEvents:
        code === "RED" && lane === "DRAGON"
          ? [
              { atSeconds: 420, type: "BUY", item: item("xa-nhat-cung"), toSlot: 1 },
              { atSeconds: 840, type: "BUY", item: item("diet-than-cung"), toSlot: 2 },
            ]
          : [],
    })),
  }
}

/** Ban/pick turns in the default order, ending with a lock shortly before the game starts. */
function draftFor(sides: GameContent["sides"], start: number, step: number): GameContent["draft"] {
  const order = [
    "BB",
    "BR",
    "BB",
    "BR",
    "PB",
    "PR",
    "PR",
    "PB",
    "PB",
    "PR",
    "BR",
    "BB",
    "BR",
    "BB",
    "PR",
    "PB",
    "PB",
    "PR",
  ]
  const taken: Record<Side, { BAN: number; PICK: number }> = { BLUE: { BAN: 0, PICK: 0 }, RED: { BAN: 0, PICK: 0 } }
  const turns = order.map((code, index): DraftTurn => {
    const kind = code[0] === "B" ? ("BAN" as const) : ("PICK" as const)
    const sideCode: Side = code[1] === "B" ? "BLUE" : "RED"
    const side = sides.find((entry) => entry.side === sideCode)!
    const hero = kind === "BAN" ? side.bans[taken[sideCode].BAN++]! : side.participants[taken[sideCode].PICK++]!.hero
    return { order: index + 1, kind, side: sideCode, hero, atSecond: start + 15 + index * step }
  })
  return { startSecond: start, lockedSecond: start + 20 + order.length * step, turns }
}

const game1Sides = [side("BLUE", "fx-azure", 0, [10, 11, 12, 13]), side("RED", "fx-ember", 5, [14, 15, 16, 17])]
// Each team plays the other team's game-1 heroes in game 2: the series rule forbids a team repeating its own picks.
const game2Sides = [side("BLUE", "fx-ember", 0, [10, 12, 14, 16]), side("RED", "fx-azure", 5, [11, 13, 15, 17])]

const baseGame = doc<GameContent>(GAME_ID, {
  seriesId: SERIES_ID,
  number: 1,
  region: "VN",
  locale: "vi-VN",
  winner: "BLUE",
  durationSeconds: 1122,
  sourceUrl: VIDEO,
  sourceTimestampSeconds: 95,
  sides: game1Sides,
  draft: draftFor(game1Sides, 0, 4),
})
export const game2 = doc<GameContent>("fx-game-2", {
  ...baseGame.content,
  number: 2,
  sourceTimestampSeconds: 1800,
  winner: "RED",
  durationSeconds: 980,
  sides: game2Sides,
  draft: draftFor(game2Sides, 1500, 12),
})

let counter = 0
const kill = (at: number, killer: string, victim: string, assists: string[] = []): TimelineEvent => ({
  id: `fx-${++counter}`,
  kind: "KILL",
  at,
  killer: killer as never,
  victim: victim as never,
  assists: assists as never[],
})
const moments: TimelineEvent[] = [
  { id: "fx-i0", kind: "ITEM", at: 12, seat: "BLUE:DRAGON", action: "BUY", slot: 1, item: item("kiem-ngan") },
  {
    id: "fx-i1",
    kind: "ITEM",
    at: 18,
    seat: "BLUE:JUNGLE",
    action: "BUY",
    slot: 1,
    item: item("guom-loki"),
  },
  {
    id: "fx-i2",
    kind: "ITEM",
    at: 22,
    seat: "RED:SUPPORT",
    action: "BUY",
    slot: 1,
    item: item("liet-hoa-hoi-huyet"),
  },
  kill(95, "BLUE:JUNGLE", "RED:MID", ["BLUE:MID"]),
  kill(142, "RED:JUNGLE", "BLUE:DRAGON", ["RED:SUPPORT"]),
  {
    id: "fx-o1",
    kind: "OBJECTIVE",
    at: 240,
    side: "BLUE",
    objective: "ABYSSAL_DRAGON",
    by: "BLUE:JUNGLE",
  },
  kill(301, "BLUE:TOP", "RED:TOP"),
  {
    id: "fx-i3",
    kind: "ITEM",
    at: 330,
    seat: "BLUE:JUNGLE",
    action: "BUY",
    slot: 2,
    item: item("kiem-muramasa"),
  },
  kill(388, "RED:DRAGON", "BLUE:SUPPORT", ["RED:MID", "RED:SUPPORT"]),
  kill(392, "BLUE:MID", "RED:DRAGON", ["BLUE:SUPPORT"]),
  { id: "fx-n1", kind: "NOTE", at: 455, title: "Giao tranh tổng ở hang Rồng" },
  kill(458, "BLUE:JUNGLE", "RED:SUPPORT", ["BLUE:TOP"]),
  kill(462, "BLUE:DRAGON", "RED:JUNGLE", ["BLUE:JUNGLE", "BLUE:MID"]),
  { id: "fx-o2", kind: "OBJECTIVE", at: 540, side: "RED", objective: "TURRET", by: "RED:DRAGON" },
  {
    id: "fx-o3",
    kind: "OBJECTIVE",
    at: 640,
    side: "RED",
    objective: "DARK_SLAYER",
    by: "RED:JUNGLE",
  },
  kill(702, "RED:MID", "BLUE:MID", ["RED:JUNGLE"]),
  kill(760, "BLUE:TOP", "RED:MID", ["BLUE:JUNGLE"]),
  {
    id: "fx-i4",
    kind: "ITEM",
    at: 790,
    seat: "BLUE:JUNGLE",
    action: "SELL",
    slot: 1,
    item: item("guom-loki"),
  },
  {
    id: "fx-i5",
    kind: "ITEM",
    at: 800,
    seat: "BLUE:JUNGLE",
    action: "BUY",
    slot: 1,
    item: item("nanh-fenrir"),
  },
  { id: "fx-o4", kind: "OBJECTIVE", at: 812, side: "BLUE", objective: "ABYSSAL_DRAGON" },
  kill(905, "BLUE:DRAGON", "RED:TOP", ["BLUE:SUPPORT"]),
  kill(911, "BLUE:JUNGLE", "RED:DRAGON"),
  kill(918, "RED:TOP", "BLUE:TOP", ["RED:MID"]),
  {
    id: "fx-o5",
    kind: "OBJECTIVE",
    at: 1000,
    side: "BLUE",
    objective: "DARK_SLAYER",
    by: "BLUE:JUNGLE",
  },
  kill(1060, "BLUE:MID", "RED:SUPPORT", ["BLUE:TOP", "BLUE:SUPPORT"]),
  { id: "fx-o6", kind: "OBJECTIVE", at: 1118, side: "BLUE", objective: "BASE", by: "BLUE:DRAGON" },
]

/** The stored game as the API returns it: kills, objectives and notes in `timeline`, item moves on participants. */
export const game = doc<GameContent>(
  GAME_ID,
  withPlayback(writeTimeline(baseGame.content, [...readTimeline(baseGame.content), ...moments]), {
    pauses: [{ atSeconds: 610, durationSeconds: 95 }],
  }),
)
