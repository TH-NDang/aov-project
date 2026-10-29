import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import {
  importCounts,
  MAX_REGISTRY_IMPORT_BYTES,
  parseRegistryImport,
} from "../src/features/tournaments/registry-import-model"

const sampleDirectory = new URL("../../../../resources/esports/2026-post-apl/aog-sample/", import.meta.url)
const sample = (name: string) => readFileSync(new URL(name, sampleDirectory), "utf8")
const parse = (value: unknown) => parseRegistryImport(JSON.stringify(value))
const team = (code = "blue") => ({ content: { code, name: "Blue" } })
const series = () => ({
  tournamentCode: "event",
  teamACode: "blue",
  teamBCode: "red",
  content: {
    code: "final",
    name: "Final",
    bestOf: 7,
    scheduledAt: "2026-11-07T11:30:00Z",
    result: {
      scoreA: 4,
      scoreB: 0,
      sourceUrl: "https://source.example/final",
      verification: "SECONDARY_CAPTURE",
      verifiedOn: "2026-10-27",
    },
  },
})

test("the frozen AOG registry package imports 147 records without treating source metadata as API content", () => {
  const source = JSON.parse(sample("registries-and-rosters.json"))
  const parsed = parseRegistryImport(sample("registries-and-rosters.json"))

  assert.equal(parsed.asOf, "2026-10-27")
  assert.equal(parsed.rows.length, 147)
  assert.equal(parsed.skipped, 0)
  assert.deepEqual(
    importCounts(parsed.rows).map(({ kind, count }) => ({ kind, count })),
    [
      { kind: "teams", count: 9 },
      { kind: "players", count: 68 },
      { kind: "tournaments", count: 1 },
      { kind: "roster-memberships", count: 69 },
    ],
  )

  const teams = parsed.rows.filter((row) => row.kind === "teams")
  for (const row of teams) {
    const original = source.teams.find((entry: { content: { code: string } }) => entry.content.code === row.key)
    assert.deepEqual(row.content, original.content)
    assert.equal(row.matchCode, original.existingCode)
    assert.equal("logo" in row.content, false)
    assert.equal("verification" in row.content, false)
    assert.equal(row.content.logoUrl, null)
  }

  const players = parsed.rows.filter((row) => row.kind === "players")
  assert.equal(players.filter((row) => row.content.fullName === null).length, 68)
  assert.equal(
    players.every((row) => row.content.photoUrl === null),
    true,
  )
  assert.equal(
    players.some((row) => "playerSourceUrl" in row.content || "photo" in row.content),
    false,
  )

  const rosters = parsed.rows.filter((row) => row.kind === "roster-memberships")
  assert.equal(
    rosters.every((row) => row.references.tournamentCode === "aog-2026-winter"),
    true,
  )
  assert.equal(
    rosters.every((row) => row.references.teamCode && row.references.playerCode),
    true,
  )
  assert.deepEqual(
    rosters
      .filter((row) => row.references.playerCode === "maris")
      .map((row) => [row.references.teamCode, row.content.status])
      .sort(),
    [
      ["rex-regum-qeon-vn-vn", "ACTIVE"],
      ["team-flash-vn", "INACTIVE"],
    ],
  )
  assert.equal(
    rosters.some((row) => "sourceFlags" in row.content || "captain" in row.content),
    false,
  )
})

test("the frozen series package preserves all 79 timestamps and 78 sourced results without importing the TBD final", () => {
  const source = JSON.parse(sample("series-import.json"))
  const parsed = parseRegistryImport(sample("series-import.json"))

  assert.equal(parsed.rows.length, 79)
  assert.equal(parsed.skipped, 0)
  assert.equal(
    parsed.rows.every((row) => row.kind === "series"),
    true,
  )
  assert.equal(parsed.rows.filter((row) => row.content.result !== null).length, 78)
  assert.equal(source.blocked.length, 1)
  assert.equal(
    parsed.rows.some((row) => row.key === source.blocked[0].code),
    false,
  )

  for (const row of parsed.rows) {
    const original = source.series.find((entry: { content: { code: string } }) => entry.content.code === row.key)
    assert.deepEqual(row.content, original.content)
    assert.deepEqual(row.references, {
      tournamentCode: original.tournamentCode,
      teamACode: original.teamACode,
      teamBCode: original.teamBCode,
    })
    assert.ok(row.content.scheduledAt)
    assert.equal("timeEvidence" in row.content, false)
    assert.equal("sourceDate" in row.content, false)
    if (row.content.result) {
      const result = row.content.result as Record<string, unknown>
      assert.equal(result.verification, "SECONDARY_CAPTURE")
      assert.equal(result.verifiedOn, "2026-10-27")
      assert.match(String(result.sourceUrl), /^https:\/\/liquipedia\.net\//)
    }
  }
})

test("stable reference codes trim whitespace while existingCode remains a distinct matching key", () => {
  const parsed = parse({
    schemaVersion: 1,
    scope: { eventCode: " event " },
    teams: [{ existingCode: " previous-blue ", content: { code: " blue ", name: " Blue " } }],
    rosters: [
      {
        teamCode: " blue ",
        playerCode: " player ",
        content: { lane: "TOP", status: "UNKNOWN", verification: "UNVERIFIED" },
      },
    ],
  })

  assert.equal(parsed.rows[0].key, "blue")
  assert.equal(parsed.rows[0].matchCode, "previous-blue")
  assert.deepEqual(parsed.rows[1].references, { tournamentCode: "event", teamCode: "blue", playerCode: "player" })
  assert.equal(parsed.rows[1].key, "event/blue/player")
  assert.throws(() => parse({ schemaVersion: 1, teams: [team("Blue")] }), /mã cần chữ thường/)
})

test("explicitly unready records skip before validating their missing data and never produce placeholder identities", () => {
  const parsed = parse({
    schemaVersion: 1,
    teams: [team(), { importReady: false, content: null }],
    series: [{ importReady: false, tournamentCode: null, teamACode: null, teamBCode: null, content: null }],
    blocked: [{ content: { code: "tbd" } }],
  })

  assert.equal(parsed.rows.length, 1)
  assert.equal(parsed.skipped, 2)
  assert.throws(
    () => parse({ schemaVersion: 1, teams: [{ ...team(), importReady: "true" }] }),
    /importReady cần true hoặc false/,
  )
})

test("duplicate record identities fail while different registry kinds can share a code", () => {
  assert.throws(() => parse({ schemaVersion: 1, teams: [team(), team(" blue ")] }), /Trùng mục/)
  assert.equal(
    parse({ schemaVersion: 1, teams: [team()], players: [{ content: { code: "blue", nickname: "Player" } }] }).rows
      .length,
    2,
  )

  const roster = { teamCode: "blue", playerCode: "player", content: { status: "UNKNOWN" } }
  assert.throws(
    () => parse({ schemaVersion: 1, scope: { eventCode: "event" }, rosters: [roster, roster] }),
    /Trùng mục/,
  )
})

test("unsupported schemas, synthetic game imports and unknown content fields are rejected", () => {
  assert.throws(() => parseRegistryImport("{"), /Không đọc được JSON/)
  assert.throws(() => parse({ schemaVersion: 2, teams: [team()] }), /schemaVersion: 1/)
  assert.throws(() => parse({ schemaVersion: 1, games: [], teams: [team()] }), /không nhập hoặc tự tạo ván đấu/)
  assert.throws(
    () => parse({ schemaVersion: 1, teams: [{ content: { code: "blue", name: "Blue", credential: "secret" } }] }),
    /credential.*chưa được hỗ trợ/,
  )
  const row = series()
  assert.throws(
    () =>
      parse({
        schemaVersion: 1,
        series: [{ ...row, content: { ...row.content, result: { ...row.content.result, winnerTeamCode: "blue" } } }],
      }),
    /winnerTeamCode.*chưa được hỗ trợ/,
  )
})

test("the byte limit counts UTF-8 bytes and rejects oversized input before parsing records", () => {
  const text = JSON.stringify({ schemaVersion: 1, ignoredEvidence: "ấ".repeat(MAX_REGISTRY_IMPORT_BYTES / 2) })
  assert.ok(text.length < MAX_REGISTRY_IMPORT_BYTES)
  assert.ok(new TextEncoder().encode(text).byteLength > MAX_REGISTRY_IMPORT_BYTES)
  assert.throws(() => parseRegistryImport(text), /không được lớn hơn 1 MB/)
})

test("unsafe URL schemes and invalid sourced dates cannot enter registry or result content", () => {
  for (const logoUrl of [
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "file:///logo.png",
    "//cdn.example/logo.png",
  ]) {
    assert.throws(
      () => parse({ schemaVersion: 1, teams: [{ content: { code: "blue", name: "Blue", logoUrl } }] }),
      /http hoặc https/,
    )
  }
  const row = series()
  assert.throws(
    () =>
      parse({
        schemaVersion: 1,
        series: [{ ...row, content: { ...row.content, result: { ...row.content.result, verifiedOn: "2026-02-30" } } }],
      }),
    /ngày chưa hợp lệ/,
  )
  assert.throws(
    () =>
      parse({ schemaVersion: 1, series: [{ ...row, content: { ...row.content, scheduledAt: "2026-11-07T18:30" } }] }),
    /thời gian có múi giờ/,
  )
  assert.equal(
    parse({ schemaVersion: 1, teams: [{ content: { code: "blue", name: "Blue", logoUrl: null } }] }).rows[0].content
      .logoUrl,
    null,
  )
})

test("preflight rejects unfinished results, missing result sources and reversed membership dates", () => {
  const row = series()
  assert.throws(
    () =>
      parse({
        schemaVersion: 1,
        series: [{ ...row, content: { ...row.content, result: { ...row.content.result, scoreA: 3 } } }],
      }),
    /thắng 4 ván/,
  )
  assert.throws(
    () =>
      parse({
        schemaVersion: 1,
        series: [{ ...row, content: { ...row.content, result: { ...row.content.result, sourceUrl: "" } } }],
      }),
    /link nguồn/,
  )
  assert.throws(
    () =>
      parse({
        schemaVersion: 1,
        scope: { eventCode: "event" },
        rosters: [
          {
            teamCode: "blue",
            playerCode: "player",
            content: { status: "UNKNOWN", startsOn: "2026-10-01", endsOn: "2026-09-01" },
          },
        ],
      }),
    /ngày kết thúc không được trước ngày bắt đầu/,
  )
})

test("short names and scheduled calendar dates are checked before import", () => {
  assert.equal(
    parse({ schemaVersion: 1, teams: [{ content: { code: "blue", name: "Blue", shortName: "a".repeat(100) } }] }).rows
      .length,
    1,
  )
  assert.throws(
    () => parse({ schemaVersion: 1, teams: [{ content: { code: "blue", name: "Blue", shortName: "a".repeat(101) } }] }),
    /100 ký tự/,
  )
  const row = series()
  for (const scheduledAt of ["2026-02-30T00:00:00Z", "2026-02-29T00:00:00+07:00"])
    assert.throws(
      () => parse({ schemaVersion: 1, series: [{ ...row, content: { ...row.content, scheduledAt } }] }),
      /ngày lịch thi đấu chưa hợp lệ/,
    )
  const scheduledAt = "2024-02-29T23:00:00+07:00"
  assert.equal(
    parse({ schemaVersion: 1, series: [{ ...row, content: { ...row.content, scheduledAt } }] }).rows[0].content
      .scheduledAt,
    scheduledAt,
  )
})

test("nullable aliases and enum fields use backend defaults without altering unknown lane or media", () => {
  const parsed = parse({
    schemaVersion: 1,
    scope: { eventCode: "event" },
    teams: [{ content: { code: "blue", name: "Blue", aliases: null, logoUrl: null } }],
    tournament: {
      content: {
        code: "event",
        name: "Event",
        region: "VN",
        tier: null,
        competitionType: null,
        venueMode: null,
        status: null,
      },
    },
    rosters: [{ teamCode: "blue", playerCode: "player", content: { lane: null, status: null, verification: null } }],
  })
  assert.deepEqual(parsed.rows[0].content.aliases, [])
  assert.equal(parsed.rows[0].content.logoUrl, null)
  assert.deepEqual(
    Object.fromEntries(
      ["tier", "competitionType", "venueMode", "status"].map((key) => [key, parsed.rows[1].content[key]]),
    ),
    { tier: "UNKNOWN", competitionType: "UNKNOWN", venueMode: "UNKNOWN", status: "UNKNOWN" },
  )
  assert.equal(parsed.rows[2].content.lane, null)
  assert.equal(parsed.rows[2].content.status, "UNKNOWN")
  assert.equal(parsed.rows[2].content.verification, "UNVERIFIED")
  const row = series()
  assert.equal(
    (
      parse({
        schemaVersion: 1,
        series: [{ ...row, content: { ...row.content, result: { ...row.content.result, verification: null } } }],
      }).rows[0].content.result as { verification: string }
    ).verification,
    "UNVERIFIED",
  )
})
