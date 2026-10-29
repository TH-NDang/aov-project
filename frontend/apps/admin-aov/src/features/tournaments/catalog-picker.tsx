import { useState } from "react"
import type { Reference, Selection } from "@aov/community-contracts"
import { Check, ChevronDown, ImageOff, Link2Off, Search, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { Input } from "@aov/ui/components/input"
import { selectionName } from "./tournament-model"

export function CatalogPicker({
  value,
  options,
  label,
  onChange,
  disabled = false,
  compact = false,
  allowManual = true,
  searchAliases,
}: {
  value: Selection | null | undefined
  options: Reference[]
  label: string
  onChange: (value: Selection) => void
  disabled?: boolean
  compact?: boolean
  allowManual?: boolean
  searchAliases?: Record<string, string>
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const selected = options.find((option) => option.id === value?.id)
  const name = selected?.name || selectionName(value)
  const normalized = search
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLocaleLowerCase()
  const shown = options.filter((option) =>
    `${option.name} ${option.code} ${searchAliases?.[option.id] ?? ""}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/gi, "d")
      .toLocaleLowerCase()
      .includes(normalized),
  )
  const choose = (selection: Selection) => {
    onChange(selection)
    setOpen(false)
    setSearch("")
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="tournament-catalog-trigger"
          data-compact={compact || undefined}
          disabled={disabled}
          aria-label={`${label}: ${name}`}
          title={`${label}: ${name}`}
        >
          <span className="tournament-reference-image">
            {selected?.iconUrl ? <img src={selected.iconUrl} alt="" loading="lazy" /> : <ImageOff size={15} />}
          </span>
          <span className="tournament-catalog-label">{value?.id || value?.name ? name : label}</span>
          {value?.name && !value.id ? <Link2Off size={12} /> : <ChevronDown size={12} />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="tournament-picker" align="start" sideOffset={6}>
        <div className="tournament-picker-search">
          <Search size={15} />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Tìm ${label.toLocaleLowerCase()}…`}
            aria-label={`Tìm ${label.toLocaleLowerCase()}`}
          />
        </div>
        <div className="tournament-picker-options">
          {shown.map((option) => (
            <button key={option.id} type="button" onClick={() => choose({ id: option.id, name: option.name })}>
              <span className="tournament-reference-image">
                {option.iconUrl ? <img src={option.iconUrl} alt="" loading="lazy" /> : <ImageOff size={16} />}
              </span>
              <span>{option.name}</span>
              {option.id === value?.id && <Check size={14} />}
            </button>
          ))}
          {!shown.length && (
            <p>
              {allowManual ? "Không có mục tương ứng trong danh mục công khai tại mốc này." : "Không có hồ sơ phù hợp."}
            </p>
          )}
        </div>
        {allowManual && search.trim() && (
          <button
            type="button"
            className="tournament-picker-manual"
            onClick={() => choose({ id: null, name: search.trim() })}
          >
            <Link2Off size={15} />
            <span>
              Dùng “{search.trim()}”<small>Ghi nhận thủ công · chưa liên kết Wiki</small>
            </span>
          </button>
        )}
        <div className="tournament-picker-footer">
          <small>
            {allowManual
              ? "Chưa có trong Wiki? Gõ tên rồi chọn ghi nhận thủ công."
              : "Chọn hồ sơ có sẵn trong danh sách."}
          </small>
          {(value?.id || value?.name) && (
            <button type="button" onClick={() => choose({})} aria-label={`Bỏ chọn ${label}`}>
              <X size={14} />
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
