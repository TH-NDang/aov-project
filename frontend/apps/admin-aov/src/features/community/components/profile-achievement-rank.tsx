import { useState } from "react"
import type { ProfileAchievement } from "@aov/community-contracts"
import { chooseRank, RANK_CHOICES, rankChoice, typedPlace, type RankChoice } from "../model/achievement-rank-model"
import { Field } from "./profile-form-primitives"

type Rank = Pick<ProfileAchievement, "place" | "placeTo" | "award">

/** The rank Stream orders and marks an achievement by; the wording beside it stays as the editor wrote it. */
export function ProfileAchievementRank({ value, onChange }: { value: Rank; onChange: (rank: Rank) => void }) {
  const [other, setOther] = useState(rankChoice(value) === "OTHER")
  const choice: RankChoice = other ? "OTHER" : rankChoice(value)
  return (
    <>
      <label className="grid min-w-0 gap-2">
        <span className="type-label">Xếp hạng</span>
        <select
          className="type-body h-10 w-full rounded-md border bg-background px-3"
          value={choice}
          onChange={(event) => {
            const next = event.target.value as RankChoice
            setOther(next === "OTHER")
            onChange(chooseRank(next, value))
          }}
        >
          {RANK_CHOICES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {choice === "OTHER" && (
        <div className="grid min-w-0 grid-cols-2 gap-3">
          <Field
            label="Hạng"
            type="number"
            min={1}
            max={999}
            value={value.place ?? ""}
            onChange={(event) => onChange({ ...value, place: typedPlace(event.target.value) })}
          />
          <Field
            label="Đến hạng"
            type="number"
            min={2}
            max={999}
            value={value.placeTo ?? ""}
            onChange={(event) => onChange({ ...value, placeTo: typedPlace(event.target.value) })}
          />
        </div>
      )}
    </>
  )
}
