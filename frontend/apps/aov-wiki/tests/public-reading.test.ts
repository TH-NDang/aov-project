import test from "node:test"
import assert from "node:assert/strict"
import { skillIllustration } from "../src/features/hero/skill-illustration.ts"
import { ContactRequestError, sendContactRequest } from "../src/features/contact/contact-request.ts"

const skill = { skillKey: "skill-0-1", kind: "PASSIVE" as const, displayOrder: 0 }
const suggestion = { name: "Reader", email: "reader@example.test", topic: "OTHER", message: "Suggested text" }

test("skill artwork uses the hero, slot and variant independently of list position", () => {
  assert.equal(skillIllustration("aleister", skill), "/skill-artwork/aleister-0-1.png")
  assert.equal(skillIllustration("d-arcy", { ...skill, skillKey: "skill-2-3" }), "/skill-artwork/d-arcy-2-3.png")
  assert.equal(skillIllustration("aleister", { ...skill, skillKey: "unknown" }), null)
  assert.equal(skillIllustration("../aleister", skill), null)
})

test("conflicting source evidence prevents a misleading illustration", () => {
  for (const metadata of [
    { sourceHeroCode: "dolia" },
    { heroReviewFlags: [{ type: "source_filename_display_mismatch" }] },
  ])
    assert.equal(
      skillIllustration("aleister", { ...skill, effects: [{ effectType: "SOURCE_SNAPSHOT", metadata }] }),
      null,
    )
})

test("reader suggestions submit only to the contact inbox and require a receipt", async (t) => {
  const request = t.mock.method(globalThis, "fetch", async () => Response.json({ id: "received" }, { status: 201 }))
  assert.equal(await sendContactRequest(suggestion), "received")
  const [url, options] = request.mock.calls[0].arguments
  assert.equal(url, "/api/wiki/v1/media/contact-requests")
  assert.equal(options.method, "POST")
  assert.equal(options.credentials, "omit")
  assert.deepEqual(JSON.parse(options.body), suggestion)
  request.mock.mockImplementation(async () => Response.json({}))
  await assert.rejects(sendContactRequest(suggestion), ContactRequestError)
  request.mock.mockImplementation(async () => new Response(null, { status: 429 }))
  await assert.rejects(sendContactRequest(suggestion), { status: 429 })
})
