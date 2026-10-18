import { Languages } from "lucide-react"
import { languageOptions } from "../users/profile-preference-picker"
import { control } from "./fields"
export function DataLanguage({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="flex items-center gap-2">
        <Languages className="size-4 text-muted-foreground" />
        Ngôn ngữ dữ liệu
      </span>
      <select className={control} value={value} onChange={(e) => onChange(e.target.value)}>
        {languageOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
