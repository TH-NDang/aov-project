import { useState } from "react"
import { Languages, Plus, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Badge } from "@aov/ui/components/badge"
import { AdminRichTextPreview } from "../terminology/rich-text-field"
import { Field, control } from "../publishing/fields"
import { languageOptions } from "../users/profile-preference-picker"
import type { WarehouseTranslation } from "@aov/ui/lib/warehouse-content"
import { WithReference } from "./warehouse-translation-panel"

/** The floating reference for this editor's fields, read from the same kind of text in another language. */
const Reference = WithReference<WarehouseText>

export interface WarehouseText extends WarehouseTranslation {
  suitability?: string | null
}

export function WarehouseTranslations({
  value,
  onChange,
  locale,
  disabled = false,
  preview = false,
  onLanguageChange,
  showSummary = true,
  showEffects = false,
  statKeys = [],
  variantKeys = [],
  fixedLanguage = false,
}: {
  value: WarehouseText[]
  onChange: (translations: WarehouseText[]) => void
  locale: string
  disabled?: boolean
  preview?: boolean
  onLanguageChange?: (language: string) => void
  showSummary?: boolean
  showEffects?: boolean
  statKeys?: string[]
  variantKeys?: string[]
  /** Writes only `locale`: the page around it already chose the language. */
  fixedLanguage?: boolean
}) {
  const [chosen, setLanguage] = useState(locale)
  // With a fixed language the page decides, and a language not written yet opens empty instead of asking first.
  const language = fixedLanguage ? locale : chosen
  const written = value.find((entry) => entry.locale === language)
  const text: WarehouseText | undefined =
    written ?? (fixedLanguage ? { locale: language, name: "", summary: null, description: null } : undefined)
  const languages = [
    ...new Set([...languageOptions.map((option) => option.value), ...value.map((entry) => entry.locale)]),
  ]
  function update(patch: Partial<WarehouseText>) {
    onChange(
      written
        ? value.map((entry) => (entry.locale === language ? { ...entry, ...patch } : entry))
        : [...value, { ...text!, ...patch }],
    )
  }
  return (
    <section className="space-y-4" aria-label="Bản dịch nội dung">
      <div className={fixedLanguage ? "hidden" : "flex flex-wrap items-center gap-2"}>
        <Languages className="size-4 text-muted-foreground" />
        <label className="min-w-0 flex-1">
          <span className="sr-only">Ngôn ngữ bản dịch</span>
          <select
            className={control}
            value={language}
            disabled={disabled && !preview}
            aria-label="Ngôn ngữ bản dịch"
            onChange={(event) => {
              setLanguage(event.target.value)
              onLanguageChange?.(event.target.value)
            }}
          >
            {languages.map((code) => (
              <option key={code} value={code}>
                {languageOptions.find((option) => option.value === code)?.label ?? code}
                {value.some((entry) => entry.locale === code) ? " · Đã có" : " · Chưa có"}
              </option>
            ))}
          </select>
        </label>
        <Badge variant="outline">{value.length} bản dịch</Badge>
      </div>
      {preview ? (
        text ? (
          <div className="type-body space-y-2">
            <p className="font-semibold">{text.name}</p>
            {[...new Set([showSummary && text.summary, text.description])].map(
              (part) => part && <AdminRichTextPreview key={part} text={part} locale={language} />,
            )}
            {[
              ...statKeys.map((key) => [key, text.statLabels?.[key]]),
              ...variantKeys.map((key) => [key, text.variantLabels?.[key]]),
            ].map(
              ([key, label], index) =>
                label && (
                  <p key={index}>
                    <span className="type-meta">{key}</span> · {label}
                  </p>
                ),
            )}
            {showEffects &&
              text.effects?.map((effect, index) => (
                <div key={index}>
                  <strong>{effect.name || effect.key}</strong>
                  {effect.type && <span className="type-meta"> · {effect.type}</span>}
                  {effect.description && <AdminRichTextPreview text={effect.description} locale={language} />}
                </div>
              ))}
          </div>
        ) : (
          <p className="type-meta">Chưa có bản dịch cho ngôn ngữ này.</p>
        )
      ) : text ? (
        <div className="space-y-4">
          <Reference read={(other) => other?.name}>
            <Field
              label="Tên hiển thị"
              value={text.name}
              onChange={(name) => update({ name })}
              required
              disabled={disabled}
              maxLength={200}
            />
          </Reference>
          {showSummary && (
            <Reference read={(other) => other?.summary}>
              <Field
                label="Tóm tắt"
                value={text.summary ?? ""}
                onChange={(summary) => update({ summary: summary || null })}
                disabled={disabled}
              />
            </Reference>
          )}
          <Reference read={(other) => other?.description}>
            <Field
              label="Mô tả"
              value={text.description ?? ""}
              multiline
              richTextLocale={language}
              onChange={(description) => update({ description: description || null })}
              disabled={disabled}
            />
          </Reference>
          {statKeys.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-medium">Tên chỉ số · {language}</h3>
              {statKeys.map((key) => (
                <Reference key={key} read={(other) => other?.statLabels?.[key]}>
                  <Field
                    label={key}
                    value={text.statLabels?.[key] ?? ""}
                    disabled={disabled}
                    onChange={(label) => update({ statLabels: { ...text.statLabels, [key]: label } })}
                  />
                </Reference>
              ))}
            </div>
          )}
          {variantKeys.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-medium">Tên biến thể · {language}</h3>
              {variantKeys.map((key) => (
                <Reference key={key} read={(other) => other?.variantLabels?.[key]}>
                  <Field
                    label={key}
                    value={text.variantLabels?.[key] ?? ""}
                    disabled={disabled}
                    onChange={(label) => update({ variantLabels: { ...text.variantLabels, [key]: label } })}
                  />
                </Reference>
              ))}
            </div>
          )}
          {showEffects && (
            <section className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Hiệu ứng trang bị</h3>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  onClick={() =>
                    update({ effects: [...(text.effects ?? []), { key: "", name: "", description: "", type: null }] })
                  }
                >
                  <Plus className="size-4" /> Thêm hiệu ứng
                </Button>
              </div>
              {text.effects?.map((effect, index) => (
                <div key={index} className="space-y-3 rounded-xl border p-3">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Field
                        label="Mã hiệu ứng"
                        value={effect.key}
                        disabled={disabled}
                        onChange={(key) =>
                          update({
                            effects: text.effects!.map((entry, n) => (n === index ? { ...entry, key } : entry)),
                          })
                        }
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Bỏ hiệu ứng ${index + 1}`}
                      disabled={disabled}
                      onClick={() => update({ effects: text.effects!.filter((_, n) => n !== index) })}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <Reference read={(other) => other?.effects?.find((entry) => entry.key === effect.key)?.name}>
                    <Field
                      label="Tên hiệu ứng"
                      value={effect.name}
                      disabled={disabled}
                      onChange={(name) =>
                        update({ effects: text.effects!.map((entry, n) => (n === index ? { ...entry, name } : entry)) })
                      }
                    />
                  </Reference>
                  <Field
                    label="Loại hiệu ứng"
                    value={effect.type ?? ""}
                    disabled={disabled}
                    onChange={(type) =>
                      update({
                        effects: text.effects!.map((entry, n) =>
                          n === index ? { ...entry, type: type || null } : entry,
                        ),
                      })
                    }
                  />
                  <Reference read={(other) => other?.effects?.find((entry) => entry.key === effect.key)?.description}>
                    <Field
                      label="Mô tả hiệu ứng"
                      value={effect.description}
                      multiline
                      richTextLocale={language}
                      disabled={disabled}
                      onChange={(description) =>
                        update({
                          effects: text.effects!.map((entry, n) => (n === index ? { ...entry, description } : entry)),
                        })
                      }
                    />
                  </Reference>
                </div>
              ))}
            </section>
          )}
          {!fixedLanguage && value.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={disabled}
              onClick={() => onChange(value.filter((entry) => entry.locale !== language))}
            >
              <Trash2 className="size-4" /> Bỏ bản dịch {language}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-dashed p-5">
          <p className="text-sm text-muted-foreground">Chưa có bản dịch cho ngôn ngữ này.</p>
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => onChange([...value, { locale: language, name: "", summary: null, description: null }])}
          >
            <Plus className="size-4" /> Tạo bản dịch
          </Button>
        </div>
      )}
    </section>
  )
}
