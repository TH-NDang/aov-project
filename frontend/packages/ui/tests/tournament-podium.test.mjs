import assert from "node:assert/strict"
import { test } from "node:test"
import { tournamentPodium } from "../src/lib/tournament-podium.ts"

const line = (place, teamName, extra = {}) => ({ place, teamName, teamId: `id-${teamName}`, ...extra })
const recorded = (winnerName, runnerUpName, winnerScore = null, runnerUpScore = null) => ({
  winnerName,
  runnerUpName,
  winnerScore,
  runnerUpScore,
  sourceUrl: "",
  verification: "PRIMARY",
})

test("the final table names the champion and the runner-up when nothing was typed in the result form", () => {
  const podium = tournamentPodium({ placements: [line("2", "BOOM"), line("1", "FPT Polytechnic"), line("3", "SGP")] })

  assert.deepEqual(podium, {
    winner: { teamId: "id-FPT Polytechnic", name: "FPT Polytechnic" },
    runnerUp: { teamId: "id-BOOM", name: "BOOM" },
    score: null,
  })
})

test("the final table wins over an older result that names another champion", () => {
  const podium = tournamentPodium({
    placements: [line("1", "FPT Polytechnic"), line("2", "BOOM")],
    result: recorded("Saigon Phantom", "BOOM", 4, 1),
  })

  assert.equal(podium?.winner.name, "FPT Polytechnic")
  assert.equal(podium?.score, null)
})

test("the score is the champion's last result against the runner-up, written with an en dash", () => {
  const placements = [line("1", "FPT Polytechnic", { lastOpponent: "boom ", lastScore: "4 : 2" }), line("2", "BOOM")]

  assert.equal(tournamentPodium({ placements })?.score, "4–2")
  assert.equal(
    tournamentPodium({ placements: [{ ...placements[0], lastOpponent: "SGP" }, placements[1]] })?.score,
    null,
  )
  assert.equal(tournamentPodium({ placements: [{ ...placements[0], lastScore: "W" }, placements[1]] })?.score, null)
})

test("a recorded score is kept when the recorded champion is the table's champion", () => {
  const podium = tournamentPodium({
    placements: [line("1", "FPT Polytechnic"), line("2", "BOOM")],
    result: recorded("fpt polytechnic", "BOOM", 4, 2),
  })

  assert.equal(podium?.score, "4–2")
})

test("a table without one clear first place falls back to the recorded result", () => {
  const shared = [line("1", "A"), line("1", "B"), line("3", "C")]

  assert.deepEqual(tournamentPodium({ placements: shared, result: recorded("A", "B", 3, 1) }), {
    winner: { name: "A" },
    runnerUp: { name: "B" },
    score: "3–1",
  })
  assert.equal(tournamentPodium({ placements: shared }), null)
  assert.equal(tournamentPodium({ placements: [line("1", " ")] }), null)
})

test("a tournament without a table or a recorded champion has no podium", () => {
  assert.equal(tournamentPodium({}), null)
  assert.equal(tournamentPodium({ placements: [], result: null }), null)
  assert.equal(tournamentPodium({ result: recorded("", "BOOM") }), null)
})
