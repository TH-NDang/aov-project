import assert from "node:assert/strict"
import { test } from "node:test"

test("recording progress separates required data, source-dependent loadouts and the confirmed state", async () => {
  const { recordingProgress } = await import("../src/features/esports/model/recording-progress")
  const pick = (name: string) => ({ id: null, name })
  const seat = (lane: string, index: number, extra: Record<string, unknown> = {}) => ({
    playerId: `p${index}`,
    lane,
    hero: pick(`Hero ${index}`),
    spell: pick("Tốc biến"),
    arcana: { status: "UNKNOWN", entries: [] },
    enchantments: { status: "UNKNOWN", entries: [] },
    equipmentSnapshots: [],
    equipmentEvents: [],
    ...extra,
  })
  const lanes = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"]
  const side = (code: string, offset: number) => ({
    side: code,
    teamId: code,
    bans: [0, 1, 2, 3].map((index) => pick(`Ban ${offset + index}`)),
    participants: lanes.map((lane, index) => seat(lane, offset + index)),
  })
  const content = {
    seriesId: "s",
    number: 1,
    region: "VN",
    locale: "vi-VN",
    winner: "BLUE",
    durationSeconds: 1122,
    sides: [side("BLUE", 0), side("RED", 5)],
  }
  const entry = (extra: Record<string, unknown> = {}, patch: Record<string, unknown> = {}) =>
    ({
      id: "g",
      version: 3,
      createdAt: "2026-10-29T00:00:00Z",
      updatedAt: "2026-10-29T01:00:00Z",
      missingFields: [],
      content: { ...content, ...patch },
      ...extra,
    }) as Parameters<typeof recordingProgress>[0]

  const ready = recordingProgress(entry())
  assert.equal(ready.state, "ready", "loadouts that the source never showed do not block confirmation")
  assert.equal(ready.done, ready.total)
  assert.equal(ready.steps.find((step) => step.id === "arcana")?.status, "todo")
  assert.equal(ready.steps.find((step) => step.id === "arcana")?.required, false)

  const blue = content.sides[0]!
  const partial = recordingProgress(
    entry(
      { missingFields: ["sides[1].participants[0].spell"] },
      {
        winner: null,
        sides: [
          {
            ...blue,
            participants: blue.participants.map((participant, index) => ({
              ...participant,
              arcana:
                index === 0
                  ? { status: "PARTIAL", entries: [{ selection: {}, count: 10, color: "RED" }], observedAtSeconds: 27 }
                  : { status: "NOT_SHOWN", entries: [] },
            })),
          },
          content.sides[1],
        ],
      },
    ),
  )
  assert.equal(partial.state, "recording")
  assert.equal(partial.steps.find((step) => step.id === "result")?.status, "partial")
  assert.equal(partial.steps.find((step) => step.id === "checks")?.status, "todo")
  assert.equal(
    partial.steps.find((step) => step.id === "arcana")?.detail,
    "1 một phần · 4 không hiển thị · 5 chưa ghi · 1 có mốc",
  )

  assert.equal(recordingProgress(entry({ publishedAt: "2026-10-29T01:00:00Z" })).state, "confirmed")
  assert.equal(
    recordingProgress(entry({ publishedAt: "2026-10-29T00:30:00Z" })).state,
    "changed",
    "edits after confirming wait for a new confirmation",
  )
})

test("a match lists what it still needs: score, missing games, video and each game's gaps", async () => {
  const { matchRecording } = await import("../src/features/esports/model/match-recording")
  const pick = (name: string) => ({ id: null, name })
  const lanes = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"]
  const side = (code: string, spells: boolean) => ({
    side: code,
    teamId: code,
    bans: [0, 1, 2, 3].map((index) => pick(`${code} ban ${index}`)),
    participants: lanes.map((lane, index) => ({
      playerId: `${code}${index}`,
      lane,
      hero: pick(`${code} hero ${index}`),
      spell: spells ? pick("Tốc biến") : { id: null, name: null },
      arcana: { status: "UNKNOWN", entries: [] },
      enchantments: { status: "UNKNOWN", entries: [] },
      equipmentSnapshots: [],
      equipmentEvents: [],
    })),
  })
  const game = (number: number, extra: Record<string, unknown> = {}, spells = true) =>
    ({
      id: `g${number}`,
      version: 1,
      createdAt: "2026-10-29T00:00:00Z",
      updatedAt: "2026-10-29T01:00:00Z",
      missingFields: [],
      content: {
        seriesId: "s",
        number,
        region: "VN",
        locale: "vi-VN",
        winner: "BLUE",
        durationSeconds: 900,
        sourceUrl: "https://youtu.be/R5rCsGqDJIg",
        sides: [side("BLUE", spells), side("RED", spells)],
      },
      ...extra,
    }) as Parameters<typeof matchRecording>[1][number]
  const series = (extra: Record<string, unknown> = {}) => ({
    code: "s",
    tournamentId: "t",
    teamAId: "a",
    teamBId: "b",
    bestOf: 5,
    ...extra,
  })

  const later = matchRecording(series({ scheduledAt: "2026-12-01T10:00:00Z" }), [], Date.parse("2026-10-29T00:00:00Z"))
  assert.equal(later.state, "upcoming")
  assert.deepEqual(later.gaps, [])

  const played = matchRecording(series({ result: { scoreA: 3, scoreB: 1 } }), [
    game(1, { publishedAt: "2026-10-29T01:00:00Z" }),
    game(2, {}, false),
  ])
  assert.equal(played.state, "missing")
  assert.equal(played.expected, 4)
  assert.equal(played.confirmed, 1)
  assert.deepEqual(
    played.gaps.map((gap) => gap.text),
    ["Thiếu 2/4 ván", "Ván 2: thiếu phụ trợ"],
  )
  assert.equal(played.gaps[1]!.gameId, "g2", "a game's gap opens that game")

  const waiting = matchRecording(series({ result: { scoreA: 1, scoreB: 0 }, bestOf: 1 }), [game(1)])
  assert.equal(waiting.state, "unconfirmed")
  assert.deepEqual(
    waiting.gaps.map((gap) => gap.text),
    ["Ván 1 chờ xác nhận"],
  )

  const done = matchRecording(series({ result: { scoreA: 1, scoreB: 0 }, bestOf: 1 }), [
    game(1, { publishedAt: "2026-10-29T01:00:00Z" }),
  ])
  assert.equal(done.state, "complete")

  const noScore = matchRecording(
    series({ scheduledAt: "2026-10-01T10:00:00Z" }),
    [],
    Date.parse("2026-10-29T00:00:00Z"),
  )
  assert.deepEqual(
    noScore.gaps.map((gap) => gap.text),
    ["Chưa có tỉ số trận", "Chưa gắn video"],
    "a match that should have been played asks for its score and video",
  )
})
