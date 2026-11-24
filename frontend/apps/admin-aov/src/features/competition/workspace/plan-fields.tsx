import type {
  CompetitionPlan,
  CompetitionSlot,
  CompetitionStage,
  PlannedMatch,
  TeamContent,
} from "@aov/community-contracts"
import { Field } from "@/features/community/components/profile-form-primitives"
import { CompetitionChoiceField } from "../competition-choice-field"
import { bestOfOptions, stageNameOptions } from "../competition-field-options"
import { FORMAT_NAMES, matchLabel } from "./model"
import { NativeSelect } from "@/components/native-select"
import { StageRulesFields } from "./stage-rules-fields"

export function BestOfField({
  label,
  value,
  disabled,
  bare,
  onChange,
}: {
  label: string
  value: number
  disabled?: boolean
  /** In a table the column names the field, so the label is only read out. */
  bare?: boolean
  onChange: (value: number) => void
}) {
  const select = (
    <NativeSelect
      aria-label={label}
      className="w-full"
      value={String(value)}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {bestOfOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {bare ? `BO${option.value}` : option.label}
        </option>
      ))}
    </NativeSelect>
  )
  if (bare) return select
  return (
    <label className="grid gap-2">
      <span className="type-label">{label}</span>
      {select}
    </label>
  )
}

type SlotProps = {
  label: string
  value: CompetitionSlot
  teams: Record<string, TeamContent>
  entrants: CompetitionPlan["entrants"]
  previous: PlannedMatch[]
  disabled: boolean
  onChange: (value: CompetitionSlot) => void
}

export function SlotEditor(props: SlotProps) {
  return (
    <label className="grid gap-2">
      <span className="type-label">{props.label}</span>
      <SlotSelect {...props} />
    </label>
  )
}

/** Who plays one side: a team, a seed, or the winner or loser of a match listed before. */
export function SlotSelect({ label, value, teams, entrants, previous, disabled, onChange }: SlotProps) {
  const selected =
    value.type === "TEAM"
      ? `TEAM:${value.teamId}`
      : value.type === "SEED"
        ? `SEED:${value.seed}`
        : value.type === "TBD"
          ? "TBD"
          : `${value.type}:${value.matchKey}`
  return (
    <NativeSelect
      aria-label={label}
      className="w-full truncate"
      disabled={disabled}
      value={selected}
      onChange={(event) => {
        const [type, id] = event.target.value.split(":")
        onChange(
          type === "TEAM"
            ? { type, teamId: id }
            : type === "SEED"
              ? { type, seed: Number(id) }
              : type === "WINNER" || type === "LOSER"
                ? { type, matchKey: id }
                : { type: "TBD" },
        )
      }}
    >
      <option value="TBD">Chưa xác định</option>
      <optgroup label="Đội đã đăng ký">
        {entrants.map((entry) => (
          <option key={entry.teamId} value={`TEAM:${entry.teamId}`}>
            {teams[entry.teamId]?.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="Hạt giống">
        {Array.from({ length: Math.max(6, entrants.length) }, (_, index) => (
          <option key={index} value={`SEED:${index + 1}`}>
            Hạt giống {index + 1}
          </option>
        ))}
      </optgroup>
      <optgroup label="Kết quả trận trước">
        {previous.flatMap((match) => [
          <option key={`${match.key}-W`} value={`WINNER:${match.key}`}>
            Thắng {matchLabel(match)}
          </option>,
          <option key={`${match.key}-L`} value={`LOSER:${match.key}`}>
            Thua {matchLabel(match)}
          </option>,
        ])}
      </optgroup>
    </NativeSelect>
  )
}

export const TIE_BREAK_PRESETS: Record<string, string> = {
  "GAME_DIFF,GAME_WINS": "Hiệu số ván → Số ván thắng",
  "HEAD_TO_HEAD,GAME_DIFF,GAME_WINS": "Đối đầu → Hiệu số ván → Số ván thắng",
  "GAME_DIFF,HEAD_TO_HEAD,GAME_WINS": "Hiệu số ván → Đối đầu → Số ván thắng",
  "": "Chưa phân hạng khi bằng điểm",
}

/** The fields of one stage, grouped the way an editor reads a rulebook: how it is played, how it ranks, its source. */
export function StageFields({
  stage,
  region,
  days,
  others,
  disabled,
  onChange,
}: {
  stage: CompetitionStage
  /** The market whose Wiki patches the stage can link to. */
  region: string
  days?: { first: string; last: string }
  others?: CompetitionStage[]
  disabled: boolean
  onChange: (value: CompetitionStage) => void
}) {
  const league = stage.format === "ROUND_ROBIN"
  return (
    <div className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="type-label text-muted-foreground">Cách đấu</legend>
        <div className="grid gap-4 md:grid-cols-4">
          <CompetitionChoiceField
            label="Tên giai đoạn"
            value={stage.name}
            options={stageNameOptions}
            allowCustom
            maxLength={200}
            disabled={disabled}
            onChange={(name) => onChange({ ...stage, name })}
          />
          <label className="grid gap-2">
            <span className="type-label">Thể thức</span>
            <NativeSelect
              className="w-full"
              value={stage.format}
              onChange={(event) => onChange({ ...stage, format: event.target.value })}
            >
              {Object.entries(FORMAT_NAMES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <BestOfField label="BO" value={stage.bestOf} onChange={(bestOf) => onChange({ ...stage, bestOf })} />
          {league && (
            <Field
              label="Số lượt"
              type="number"
              min={1}
              max={4}
              value={stage.legs}
              onChange={(event) => onChange({ ...stage, legs: Number(event.target.value) })}
            />
          )}
        </div>
      </fieldset>
      {league && (
        <fieldset className="space-y-3">
          <legend className="type-label text-muted-foreground">Xếp hạng</legend>
          <div className="grid gap-4 md:grid-cols-4">
            {(
              [
                ["winPoints", "Điểm thắng"],
                ["lossPoints", "Điểm thua"],
                ["advance", "Số đội đi tiếp"],
              ] as const
            ).map(([key, label]) => (
              <Field
                key={key}
                label={label}
                type="number"
                min={0}
                max={64}
                value={stage[key]}
                onChange={(event) => onChange({ ...stage, [key]: Number(event.target.value) })}
              />
            ))}
            <label className="grid gap-2">
              <span className="type-label">Khi bằng điểm, xét lần lượt</span>
              <NativeSelect
                className="w-full"
                value={stage.tieBreakers.join(",")}
                onChange={(event) =>
                  onChange({ ...stage, tieBreakers: event.target.value ? event.target.value.split(",") : [] })
                }
              >
                {Object.entries(TIE_BREAK_PRESETS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </label>
          </div>
        </fieldset>
      )}
      <fieldset className="space-y-3">
        <legend className="type-label text-muted-foreground">Nguồn</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Nguồn điều lệ"
            type="url"
            value={stage.sourceUrl}
            onChange={(event) => onChange({ ...stage, sourceUrl: event.target.value })}
          />
        </div>
      </fieldset>
      <StageRulesFields
        stage={stage}
        region={region}
        days={days}
        others={others}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  )
}
