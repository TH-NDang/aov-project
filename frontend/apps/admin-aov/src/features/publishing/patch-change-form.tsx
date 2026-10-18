import { randomId } from "@/lib/random-id"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Button } from "@aov/ui/components/button"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { Box, control } from "./fields"
import { createPublishingApi } from "./publishing-api"
import { ROLES, type Revision } from "./types"
const api = createPublishingApi(backendRequest)
const labels = { STAT: "Chỉ số", SKILL: "Kỹ năng", ROLE: "Vai trò", VISUAL: "Ảnh", MECHANIC: "Cơ chế", OTHER: "Khác" }
type ChangeType = keyof typeof labels
export function PatchChangeForm({ revision, locale }: { revision: Revision; locale: string }) {
  const cache = useQueryClient()
  const [rows, setRows] = useState<{ id: string; type: ChangeType }[]>([{ id: randomId(), type: "SKILL" }])
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  return (
    <Box title="Ghi lịch sử thay đổi gameplay">
      <p className="text-sm text-muted-foreground">
        Đối chiếu bản nguồn và bản vừa publish. Sửa nội dung thông thường không tạo lịch sử cân bằng. Mỗi tướng/variant
        chỉ có một change set.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const form = new FormData(e.currentTarget)
          const text = (name: string) => String(form.get(name) ?? "")
          const nullable = (name: string) => text(name) || null
          const changes = rows.map((row, i) => {
            const base = { type: row.type, changeKind: text(`kind-${i}`) }
            switch (row.type) {
              case "STAT":
                return {
                  ...base,
                  statKey: text(`key-${i}`),
                  oldValue: nullable(`old-${i}`) === null ? null : Number(text(`old-${i}`)),
                  newValue: nullable(`new-${i}`) === null ? null : Number(text(`new-${i}`)),
                  unit: text(`unit-${i}`),
                }
              case "SKILL":
                return {
                  ...base,
                  skillKey: text(`key-${i}`),
                  fieldKey: text(`field-${i}`),
                  oldValue: nullable(`old-${i}`),
                  newValue: nullable(`new-${i}`),
                }
              case "ROLE":
                return { ...base, roleCode: text(`key-${i}`), added: form.has(`added-${i}`) }
              case "VISUAL":
                return {
                  ...base,
                  mediaRole: text(`key-${i}`),
                  oldAssetId: nullable(`old-${i}`),
                  newAssetId: nullable(`new-${i}`),
                }
              case "MECHANIC":
                return { ...base, mechanicKey: text(`key-${i}`), description: text(`description-${i}`) }
              case "OTHER":
                return { ...base, description: text(`description-${i}`) }
            }
          })
          setBusy(true)
          setError("")
          void api
            .send(`/admin/patch-variants/${revision.effectiveFromPatchVariantId}/hero-changes`, "POST", {
              heroId: revision.heroId,
              fromHeroRevisionId: revision.sourceRevisionId,
              toHeroRevisionId: revision.id,
              summaryTranslations: [{ locale: text("locale"), summary: text("summary") }],
              changes,
            })
            .then(() => {
              setSaved(true)
              void cache.invalidateQueries({ queryKey: ["patch-changes"] })
              void cache.invalidateQueries({ queryKey: ["publishing-heroes"] })
            })
            .catch((error) => setError(errorMessage(error)))
            .finally(() => setBusy(false))
        }}
      >
        <fieldset className="space-y-4" disabled={busy || saved}>
          <label className="grid gap-1 text-sm">
            Ngôn ngữ tóm tắt
            <input className={control} name="locale" defaultValue={locale} required />
          </label>
          <label className="grid gap-1 text-sm">
            Tóm tắt
            <textarea className={control} name="summary" required />
          </label>
          {rows.map((row, i) => (
            <div key={row.id + row.type} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                Phần thay đổi
                <select
                  className={control}
                  value={row.type}
                  onChange={(e) =>
                    setRows(rows.map((v, n) => (n === i ? { ...v, type: e.target.value as ChangeType } : v)))
                  }
                >
                  {Object.entries(labels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Tính chất
                <select className={control} name={`kind-${i}`}>
                  {["BUFF", "NERF", "ADJUSTMENT", "REWORK", "FIX", "OTHER"].map((kind) => (
                    <option key={kind}>{kind}</option>
                  ))}
                </select>
              </label>
              {row.type !== "OTHER" && (
                <label className="grid gap-1 text-sm">
                  {row.type === "ROLE"
                    ? "Vai trò"
                    : row.type === "VISUAL"
                      ? "Loại ảnh"
                      : "Khóa chỉ số / kỹ năng / cơ chế"}
                  {row.type === "ROLE" ? (
                    <select className={control} name={`key-${i}`}>
                      {Object.entries(ROLES).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : row.type === "VISUAL" ? (
                    <select className={control} name={`key-${i}`}>
                      <option>HEAD</option>
                      <option>PORTRAIT</option>
                      <option>SPLASH</option>
                    </select>
                  ) : (
                    <input className={control} name={`key-${i}`} required />
                  )}
                </label>
              )}
              {row.type === "SKILL" && (
                <label className="grid gap-1 text-sm">
                  Trường thay đổi (ví dụ cooldown)
                  <input className={control} name={`field-${i}`} required />
                </label>
              )}
              {row.type === "STAT" && (
                <label className="grid gap-1 text-sm">
                  Đơn vị
                  <input className={control} name={`unit-${i}`} defaultValue="POINT" required />
                </label>
              )}
              {["STAT", "SKILL", "VISUAL"].includes(row.type) &&
                ["old", "new"].map((which) => (
                  <label key={which} className="grid gap-1 text-sm">
                    {which === "old" ? "Giá trị trước" : "Giá trị sau"}
                    {row.type === "VISUAL" ? " (Asset UUID)" : ""}
                    <input
                      className={control}
                      name={`${which}-${i}`}
                      type={row.type === "STAT" ? "number" : "text"}
                      step={row.type === "STAT" ? "any" : undefined}
                    />
                  </label>
                ))}
              {row.type === "ROLE" && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={`added-${i}`} defaultChecked />
                  Thêm vai trò (bỏ chọn để ghi nhận loại bỏ)
                </label>
              )}
              {["MECHANIC", "OTHER"].includes(row.type) && (
                <label className="grid gap-1 text-sm">
                  Mô tả
                  <textarea className={control} name={`description-${i}`} required />
                </label>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={rows.length === 1}
                onClick={() => setRows(rows.filter((_, n) => n !== i))}
              >
                Bỏ mục
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRows([...rows, { id: randomId(), type: "SKILL" }])}
            >
              Thêm mục
            </Button>
            <Button>Ghi change set</Button>
          </div>
        </fieldset>
      </form>
      {saved && <p role="status">Đã ghi lịch sử. Wiki sẽ hiển thị khi patch có hiệu lực ở vùng đã chọn.</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </Box>
  )
}
