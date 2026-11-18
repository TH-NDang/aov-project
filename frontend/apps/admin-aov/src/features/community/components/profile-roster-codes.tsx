import { useState } from "react"
import type { Lane, ProfileMember, RosterStanding } from "@aov/community-contracts"
import { Input } from "@aov/ui/components/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/select"
import { LANE_ORDER } from "@/features/esports/model/labels"
import {
  choosePosition,
  chooseStanding,
  positionChoice,
  rosterLaneLabels,
  rosterStaffLabels,
  rosterStandingLabels,
  statusNote,
  writeStatusNote,
  type PositionChoice,
  type RosterStaff,
} from "../model/profile-roster-model"
import { RosterRoleIcon } from "./profile-roster-lineup"
import { NativeSelect } from "@/components/native-select"

const STANDINGS: RosterStanding[] = ["ACTIVE", "SUBSTITUTE", "STAFF", "LEFT"]
const STAFF = Object.keys(rosterStaffLabels) as RosterStaff[]

/**
 * The member's position: a lane or a staff role writes its code with Admin's words for it; wording of the editor's
 * own keeps a separate lane choice so the member still has a code.
 */
export function RosterPositionField({
  member,
  disabled,
  onChange,
}: {
  member: ProfileMember
  disabled?: boolean
  onChange: (member: ProfileMember) => void
}) {
  const [custom, setCustom] = useState(positionChoice(member) === "CUSTOM")
  const choice: PositionChoice = custom ? "CUSTOM" : positionChoice(member)
  const iconOf = (value: PositionChoice) =>
    value in rosterLaneLabels ? (
      <RosterRoleIcon lane={value as Lane} size={18} />
    ) : value === "COACH" || value === "ANALYST" ? (
      <RosterRoleIcon staff={value === "ANALYST" ? "analyst" : "coach"} size={18} />
    ) : (
      <RosterRoleIcon size={18} />
    )
  return (
    <div className="grid gap-2">
      <label className="grid gap-2">
        <span className="type-label">Vị trí trong đội *</span>
        <Select
          value={choice || undefined}
          disabled={disabled}
          required={!custom}
          onValueChange={(next) => {
            setCustom(next === "CUSTOM")
            if (next !== "CUSTOM") onChange(choosePosition(member, next as Exclude<PositionChoice, "" | "CUSTOM">))
          }}
        >
          <SelectTrigger aria-label="Vị trí trong đội" className="h-10 w-full">
            <SelectValue placeholder="Chọn vị trí" />
          </SelectTrigger>
          <SelectContent position="popper">
            {[...LANE_ORDER, ...STAFF, "CUSTOM" as const].map((value) => (
              <SelectItem key={value} value={value}>
                <span aria-hidden="true">{iconOf(value)}</span>
                {value === "CUSTOM"
                  ? "Tùy chỉnh…"
                  : value in rosterLaneLabels
                    ? rosterLaneLabels[value as Lane]
                    : rosterStaffLabels[value as RosterStaff]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      {custom && (
        <div className="grid gap-2">
          <Input
            aria-label="Vị trí trong đội tùy chỉnh"
            required
            maxLength={100}
            disabled={disabled}
            value={member.role}
            onChange={(event) => onChange({ ...member, role: event.target.value })}
          />
          <NativeSelect
            className="w-full"
            aria-label="Vị trí thi đấu"
            disabled={disabled || member.standing === "STAFF"}
            value={member.lane ?? ""}
            onChange={(event) => onChange({ ...member, lane: (event.target.value || null) as Lane | null })}
          >
            <option value="">Không có vị trí thi đấu</option>
            {LANE_ORDER.map((lane) => (
              <option key={lane} value={lane}>
                {rosterLaneLabels[lane]}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
    </div>
  )
}

/** The member's standing as a code, written first in the status, and the status's own notes after it. */
export function RosterStandingFields({
  member,
  disabled,
  onChange,
}: {
  member: ProfileMember
  disabled?: boolean
  onChange: (member: ProfileMember) => void
}) {
  return (
    <>
      <label className="grid gap-2">
        <span className="type-label">Trạng thái</span>
        <NativeSelect
          className="w-full"
          disabled={disabled}
          value={member.standing ?? ""}
          onChange={(event) => onChange(chooseStanding(member, (event.target.value || null) as RosterStanding | null))}
        >
          <option value="">Chưa rõ</option>
          {STANDINGS.map((standing) => (
            <option key={standing} value={standing}>
              {rosterStandingLabels[standing]}
            </option>
          ))}
        </NativeSelect>
      </label>
      <label className="grid gap-2">
        <span className="type-label">Ghi chú trạng thái</span>
        <Input
          maxLength={80}
          disabled={disabled}
          placeholder="Cho mượn, thử việc, mùa giải…"
          value={statusNote(member)}
          onChange={(event) => onChange(writeStatusNote(member, event.target.value))}
        />
      </label>
    </>
  )
}
