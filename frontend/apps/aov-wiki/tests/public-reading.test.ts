import test from "node:test"
import assert from "node:assert/strict"
import { ContactRequestError, sendContactRequest } from "../src/lib/contact-request.ts"

const suggestion = { name: "Reader", email: "reader@example.test", topic: "OTHER", message: "Suggested text" }

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
