import assert from "node:assert/strict"
import { test } from "node:test"
import { ApiError } from "../src/lib/api/errors"
import { tournamentError } from "../src/features/tournaments/api/tournament-api"
import { sameNamePlayers } from "../src/features/tournaments/model/same-name-players"

const refused = new ApiError({
  status: 409,
  code: "TOURNAMENT_PLAYER_SAME_NAME",
  players: [{ id: "p1", code: "kiral", nickname: "Kiral", country: "VN" }],
} as ConstructorParameters<typeof ApiError>[0])

test("a refused create lists the players the server found under the same name", () => {
  assert.deepEqual(sameNamePlayers(refused), [{ id: "p1", code: "kiral", nickname: "Kiral", country: "VN" }])
})

test("another error is not read as a same-name refusal", () => {
  assert.equal(sameNamePlayers(new ApiError({ status: 409, code: "TOURNAMENT_VERSION_CONFLICT" })), null)
})

test("the import message names the existing profile to use instead", () => {
  assert.match(tournamentError(refused), /\(kiral\)/)
})
