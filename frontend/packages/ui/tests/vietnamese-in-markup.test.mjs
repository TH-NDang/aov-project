import assert from "node:assert/strict"
import { test } from "node:test"
import { vietnameseInMarkup } from "../lint/vietnamese-in-markup.ts"

const found = (source) => vietnameseInMarkup(source, "/app/page.tsx")

test("Vietnamese written as JSX text or an attribute is reported", () => {
  assert.deepEqual(found(`const A = () => <p title="Tiêu đề">Xin chào</p>`), [`:1 title="Tiêu đề"`, ":1 Xin chào"])
})

test("words passed to a text call are not reported", () => {
  assert.deepEqual(found(`const A = () => <p title={text("Tiêu đề", "Title")}>{text("Xin chào", "Hello")}</p>`), [])
})

test("Vietnamese in a branch of a choice is reported even when the other branch is translated", () => {
  const source = `const A = ({ on }) => <input placeholder={on ? "Tìm đội" : text("Tìm giải", "Search")} />`
  assert.deepEqual(found(source), [":1 Tìm đội"])
})

test("Vietnamese after && or ?? in braces is reported", () => {
  const source = `const A = ({ on, name }) => (\n  <p>\n    {on && "Đang tải"}\n    {name ?? "Chưa đặt tên"}\n  </p>\n)`
  assert.deepEqual(found(source), [":3 Đang tải", ":4 Chưa đặt tên"])
})

test("the words of a template in braces are reported without its values", () => {
  assert.deepEqual(found("const A = ({ n }) => <p>{`Xem thêm ${n} trận`}</p>"), [":1 Xem thêm trận"])
})
