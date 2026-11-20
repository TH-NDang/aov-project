import assert from "node:assert/strict"
import { test } from "node:test"
import * as React from "react"
import type { ItemEffectGameplay } from "@aov/ui/lib/item-description"
import { withWarehouseUi } from "./fixtures/warehouse-ui"

const ROBE =
  "+120 Công phép\n\nNội tại duy nhất – Linh thể: Nhận 26–40 công phép.\n\nNội tại duy nhất – Thuật sư: +35% Công phép"

test("the effects editor fills one card per effect of the description and warns when the lists drift apart", async () => {
  await withWarehouseUi(async ({ document, render, click }) => {
    const { ItemEffectsEditor } = await import("../src/features/warehouse/components/items/item-effects-editor")
    let latest: ItemEffectGameplay[] = []
    function Harness() {
      const [effects, setEffects] = React.useState<ItemEffectGameplay[]>([])
      latest = effects
      return <ItemEffectsEditor effects={effects} description={ROBE} onChange={setEffects} />
    }
    await render(<Harness />)

    await click("Điền 2 hiệu ứng từ mô tả")

    assert.deepEqual(
      latest.map((effect) => [effect.key, effect.grants?.map((grant) => grant.stat)]),
      [
        ["linh-the", []],
        ["thuat-su", ["magic-attack"]],
      ],
    )
    assert.match(document.body.textContent ?? "", /Thêm chỉ số từ hiệu ứng/)

    await click("Thêm hiệu ứng")

    assert.match(document.body.textContent ?? "", /Mô tả viết 2 hiệu ứng nhưng ở đây có 3/)
  })
})
