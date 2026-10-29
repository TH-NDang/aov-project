import assert from "node:assert/strict"
import { test } from "node:test"
import { activeNavItem } from "../src/app/nav"

test("only the most specific navigation item is active", () => {
  assert.equal(activeNavItem("/hero/media")?.title, "Không gian ảnh")
  assert.equal(activeNavItem("/media/head")?.title, "Không gian ảnh")
  assert.equal(activeNavItem("/hero")?.title, "Tướng")
  assert.equal(activeNavItem("/hero/fixture-hero")?.title, "Tướng")
  assert.equal(activeNavItem("/")?.title, "Bảng điều khiển")
  assert.equal(activeNavItem("/unknown"), undefined)
})
