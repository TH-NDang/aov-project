import assert from "node:assert/strict"
import { test } from "node:test"
import { QueryClient } from "@tanstack/react-query"
import type { EntityIcon } from "@aov/ui/components/entity-rich-text"
import type { EntityKind, EntityReference } from "@aov/ui/lib/entity-rich-text"
import { withGlobals } from "./fixtures/dom"

const [{ createStreamIconResolver }, { streamReferenceKeys }] = await withGlobals({ BroadcastChannel: undefined }, () =>
  Promise.all([
    import("../src/features/terminology/stream-icons"),
    import("../src/features/terminology/stream-reference-api"),
  ]),
)

const entity = (kind: EntityKind): EntityReference => ({ id: "box", kind, iconAssetId: "box", translations: [] })

function iconOf(kind: EntityKind, logos: { logoUrl?: string; logoDarkUrl?: string }, darkTheme: boolean) {
  const client = new QueryClient()
  client.setQueryData(streamReferenceKeys.preview("TEAM", "box"), logos)
  let shown: EntityIcon | null | undefined
  const stop = createStreamIconResolver(client, darkTheme).subscribe!(entity(kind), (icon) => (shown = icon))
  stop()
  client.clear()
  return shown
}

test("a record shows the logo of its preview", () => {
  assert.deepEqual(iconOf("team", { logoUrl: "/box.png" }, false), { url: "/box.png", plate: undefined })
})

test("the dark theme takes the logo drawn for it", () => {
  assert.deepEqual(iconOf("team", { logoUrl: "/box.png", logoDarkUrl: "/box-dark.png" }, true), {
    url: "/box-dark.png",
    plate: undefined,
  })
})

test("a logo drawn for the other theme stands on the plate it was drawn for", () => {
  assert.deepEqual(iconOf("team", { logoUrl: "/box.png" }, true), { url: "/box.png", plate: "light" })
})

test("a record without a logo and an entry of the game ask for none", () => {
  assert.equal(iconOf("team", {}, false), undefined)
  assert.equal(iconOf("hero", { logoUrl: "/box.png" }, false), undefined)
})
