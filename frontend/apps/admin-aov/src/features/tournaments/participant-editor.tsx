import { useState } from "react"
import type { Catalog, Participant } from "@aov/community-contracts"
import { Shield, Swords } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@aov/ui/components/sheet"
import { LoadoutEditor } from "./loadout-editor"
import { EquipmentEditor } from "./equipment-editor"
import { selectionName } from "./tournament-model"

export function ParticipantEditor({
  participant,
  name,
  catalog,
  open,
  disabled,
  onChange,
  onClose,
}: {
  participant: Participant
  name: string
  catalog: Catalog
  open: boolean
  disabled: boolean
  onChange: (participant: Participant) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<"loadout" | "equipment">("loadout")
  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent className="tournament-participant-sheet">
        <SheetTitle>
          {name} <span className="tournament-muted">· {selectionName(participant.hero, catalog.heroes)}</span>
        </SheetTitle>
        <SheetDescription>
          Nhập thông tin đã quan sát. Thay đổi được giữ trong bản nháp ván, bấm Lưu nháp ván để lưu lên máy chủ.
        </SheetDescription>
        <div className="tournament-editor-tabs">
          <button type="button" aria-pressed={tab === "loadout"} onClick={() => setTab("loadout")}>
            <Shield size={15} />
            Ngọc & phù hiệu
          </button>
          <button type="button" aria-pressed={tab === "equipment"} onClick={() => setTab("equipment")}>
            <Swords size={15} />
            Trang bị
          </button>
        </div>
        <fieldset className="tournament-participant-fields" disabled={disabled}>
          {tab === "loadout" ? (
            <LoadoutEditor {...{ participant, catalog, onChange }} />
          ) : (
            <EquipmentEditor {...{ participant, catalog, onChange }} />
          )}
          <label className="tournament-field">
            Ghi chú tuyển thủ
            <textarea
              value={participant.note ?? ""}
              maxLength={2000}
              onChange={(event) => onChange({ ...participant, note: event.target.value })}
            />
          </label>
        </fieldset>
      </SheetContent>
    </Sheet>
  )
}
