import assert from "node:assert/strict"
import { test } from "node:test"
import { foreignRules } from "../lint/stylesheet-owners.ts"

const sheet = (path, text) => ({ path: `/app/${path}`, text })
const found = (checked, owners = []) =>
  foreignRules(checked, owners, "/app").map((rule) => `${rule.sheet}:${rule.line} ${rule.classes.join(",")}`)

test("a rule that styles a class another sheet declares is reported", () => {
  const card = sheet("card.css", ".app-card {\n  padding: 8px;\n}")
  const page = sheet("page.css", ".app-page {\n  display: grid;\n}\n.app-page > .app-card {\n  padding: 0;\n}")
  assert.deepEqual(found([card, page]), ["page.css:4 app-card"])
})

test("a sheet may style its own class in the context of another sheet's class", () => {
  const card = sheet("card.css", ".app-card {\n  padding: 8px;\n}\n.app-page > .app-card {\n  padding: 0;\n}")
  const page = sheet("page.css", ".app-page {\n  display: grid;\n}")
  assert.deepEqual(found([card, page]), [])
})

test("a modifier written only beside its class belongs to the sheet that declares it there", () => {
  const button = sheet("button.css", ".app-button {\n  width: 36px;\n}\n.app-button.with-label {\n  width: auto;\n}")
  const footer = sheet(
    "footer.css",
    ".app-footer {\n  display: flex;\n}\n.app-footer > .app-button.with-label {\n  gap: 8px;\n}",
  )
  assert.deepEqual(found([button, footer]), ["footer.css:4 app-button,with-label"])
})

test("a class no sheet declares belongs to the shared library when the library names it", () => {
  const library = sheet("ui/overlay.css", ".app-drawer > .app-drawer-body {\n  padding: 16px;\n}")
  const page = sheet("page.css", ".app-page .app-drawer-body {\n  padding: 0;\n}")
  assert.deepEqual(found([page], [library]), ["page.css:1 app-drawer-body"])
})
