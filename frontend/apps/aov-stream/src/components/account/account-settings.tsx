import { useId, type ReactNode } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PublicCurrencySelect } from "@aov/ui/components/public-currency-select"
import { PublicDateFormatSelect } from "@aov/ui/components/public-date-format-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/public-select"
import { PublicTimeZoneSelect } from "@aov/ui/components/public-time-zone-select"
import { languageLabel } from "./account-profile"
import { LANGUAGE_CODES, profileDraft, profileRequest, type UserProfile } from "../../lib/profile-model"
import { accountKeys, saveProfile, useOwnProfile } from "../../lib/profile-api"
import { wikiRequest } from "../../lib/stream-api"
import { useCommunitySession } from "../../lib/stream-auth"
import { StreamIcon, type StreamIconName } from "../stream-icon"
import { useStreamLocale } from "../stream-locale"
import { useStreamTheme } from "../stream-theme"

/** One setting as a row: what it is and what it changes, with its control at the end of the row. */
function Preference({
  icon,
  id,
  label,
  hint,
  children,
}: {
  icon: StreamIconName
  id: string
  label: string
  hint: string
  children: ReactNode
}) {
  return (
    <div className="account-pref">
      <span className="account-pref-mark" aria-hidden="true">
        <StreamIcon name={icon} size={17} />
      </span>
      <label className="account-pref-words" htmlFor={id}>
        <b>{label}</b>
        <small>{hint}</small>
      </label>
      <div className="account-pref-control">{children}</div>
    </div>
  )
}

/** How the app reads for this person. These are not part of who they are, so they live apart from the profile. */
export function AccountSettings() {
  const session = useCommunitySession()
  const client = useQueryClient()
  const profile = useOwnProfile()
  const { locale, languageTag, text } = useStreamLocale()

  const saveLanguage = useMutation({
    mutationFn: async (next: string) => {
      // Wiki and Admin share this profile, so the copy on this page may be out of date.
      const latest = await wikiRequest<UserProfile>("/users/me")
      return saveProfile(profileRequest({ ...profileDraft(latest), locale: next }, latest.version))
    },
    onSuccess: (saved) => client.setQueryData(accountKeys.profile(session.revision), saved),
  })

  const ids = { language: useId(), timeZone: useId(), dateFormat: useId(), currency: useId() }
  const { theme, setTheme } = useStreamTheme()
  return (
    <section className="cp-section account-settings" aria-labelledby="account-settings-title">
      <div className="tn-heading" data-flush="">
        <h2 id="account-settings-title">{text("Cài đặt", "Settings")}</h2>
      </div>
      <p className="cp-section-lead">
        {text(
          "Lưu ngay khi đổi, dùng chung cho Wiki, Stream và Admin.",
          "Saved as you change them, across Wiki, Stream and Admin.",
        )}
      </p>
      <div className="account-prefs">
        <Preference
          icon="globe"
          id={ids.language}
          label={text("Ngôn ngữ", "Language")}
          hint={text("Chữ trên Wiki, Stream và Admin", "Text on Wiki, Stream and Admin")}
        >
          <Select
            value={profile.data?.locale ?? ""}
            disabled={!profile.data || saveLanguage.isPending}
            onValueChange={(next) => saveLanguage.mutate(next)}
          >
            <SelectTrigger id={ids.language} className="account-settings-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              drawerTitle={text("Ngôn ngữ", "Language")}
              data-product="stream"
              position="popper"
              align="end"
              sideOffset={4}
            >
              {LANGUAGE_CODES.map((code) => (
                <SelectItem key={code} value={code}>
                  {languageLabel(code, languageTag)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Preference>
        <Preference
          icon="clock"
          id={ids.timeZone}
          label={text("Múi giờ", "Time zone")}
          hint={text("Giờ thi đấu và giờ đăng bài", "Match and post times")}
        >
          <PublicTimeZoneSelect
            id={ids.timeZone}
            locale={locale}
            product="stream"
            triggerClassName="account-settings-select"
          />
        </Preference>
        <Preference
          icon="calendar"
          id={ids.dateFormat}
          label={text("Định dạng ngày", "Date format")}
          hint={text("Cách viết ngày tháng", "How dates are written")}
        >
          <PublicDateFormatSelect
            id={ids.dateFormat}
            locale={locale}
            product="stream"
            triggerClassName="account-settings-select"
          />
        </Preference>
        <Preference
          icon="coins"
          id={ids.currency}
          label={text("Tiền tệ", "Currency")}
          hint={text("Quy đổi tiền thưởng giải đấu", "For tournament prize money")}
        >
          <PublicCurrencySelect
            id={ids.currency}
            locale={locale}
            product="stream"
            triggerClassName="account-settings-select"
          />
        </Preference>
      </div>
      <fieldset className="account-themes">
        <legend>
          <b>{text("Giao diện", "Appearance")}</b>
          <small>{text("Chỉ trên thiết bị này", "On this device only")}</small>
        </legend>
        <div className="account-theme-row">
          {(["light", "dark"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className="account-theme"
              data-look={value}
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
            >
              <span className="account-theme-art" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="account-theme-name">
                <StreamIcon name={value === "light" ? "sun" : "moon"} size={15} />
                {value === "light" ? text("Sáng", "Light") : text("Tối", "Dark")}
                {theme === value && <StreamIcon name="check" size={15} />}
              </span>
            </button>
          ))}
        </div>
      </fieldset>
      {saveLanguage.isError && (
        <p className="cp-field-error" role="alert">
          {text("Chưa lưu được ngôn ngữ. Hãy thử lại.", "The language could not be saved. Please try again.")}
        </p>
      )}
    </section>
  )
}
