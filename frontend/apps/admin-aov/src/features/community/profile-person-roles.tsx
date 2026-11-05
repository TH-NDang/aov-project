import { personRoleLabels, type PersonRole } from "@aov/community-contracts"
import { Checkbox } from "@aov/ui/components/checkbox"
import { Button } from "@aov/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { Pencil, Plus } from "lucide-react"
import { ProfileRoleIcon } from "./profile-icons"

export function ProfilePersonRoles({
  value = [],
  onChange,
  disabled,
  required,
}: {
  value?: PersonRole[]
  onChange: (roles: PersonRole[]) => void
  disabled?: boolean
  required?: boolean
}) {
  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="type-label">{required ? "Vai trò *" : "Vai trò kiêm nhiệm"}</legend>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {value.map((role) => (
          <span key={role} className="type-meta flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
            <ProfileRoleIcon role={role} className="size-4" />
            {personRoleLabels[role]}
          </span>
        ))}
        {!value.length && (
          <span className="type-meta">{required ? "Chưa chọn vai trò" : "Chưa có vai trò kiêm nhiệm"}</span>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              aria-label={required ? "Thiết lập vai trò" : "Thiết lập vai trò kiêm nhiệm"}
            >
              {value.length ? <Pencil className="size-4" /> : <Plus className="size-4" />}
              {value.length ? "Sửa" : "Thêm vai trò"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 space-y-3">
            <p className="type-label">{required ? "Vai trò chuyên môn" : "Vai trò kiêm nhiệm ngoài tuyển thủ"}</p>
            <div className="grid gap-2">
              {(Object.keys(personRoleLabels) as PersonRole[]).map((role) => (
                <label key={role} className="type-body flex items-center gap-2 rounded-lg border px-3 py-2">
                  <Checkbox
                    checked={value.includes(role)}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                      onChange(
                        checked
                          ? [...value.filter((item) => item !== role), role]
                          : value.filter((item) => item !== role),
                      )
                    }
                  />
                  <ProfileRoleIcon role={role} className="size-4 shrink-0 text-muted-foreground" />
                  {personRoleLabels[role]}
                </label>
              ))}
            </div>
            <p className="type-meta">
              {required
                ? "Có thể chọn nhiều vai trò trên cùng một hồ sơ."
                : "Vị trí thi đấu được chọn khi thêm vào đội tuyển."}
            </p>
          </PopoverContent>
        </Popover>
      </div>
      {required && !value.length && (
        <p role="alert" className="type-meta text-destructive">
          Chọn ít nhất một vai trò để lưu hồ sơ.
        </p>
      )}
    </fieldset>
  )
}
