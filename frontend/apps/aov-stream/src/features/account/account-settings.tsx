import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PublicCurrencySelect } from "@aov/ui/components/public-currency-select"
import { PublicDateFormatSelect } from "@aov/ui/components/public-date-format-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/public-select"
import { PublicTimeZoneSelect } from "@aov/ui/components/public-time-zone-select"
import { languageLabel } from "./account-profile"
import { LANGUAGE_CODES, profileDraft, profileRequest, type UserProfile } from "./profile-model"
import { profileKey, saveProfile, useOwnProfile, wikiRequest } from "./profile-api"
import { useCommunitySession } from "../community/community-auth"
import { useStreamLocale } from "../../components/stream-locale"

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
    onSuccess: (saved) => client.setQueryData(profileKey(session.revision), saved),
  })

  return (
    <section className="cp-panel account-settings" aria-labelledby="account-settings-title">
      <h2 id="account-settings-title">{text("Cài đặt", "Settings")}</h2>
      <p>
        {text(
          "Ngôn ngữ, múi giờ, cách hiển thị ngày và tiền tệ áp dụng trên cả Wiki, Stream và Admin.",
          "Language, time zone, date format and currency apply across Wiki, Stream and Admin.",
        )}
      </p>
      <div className="cp-form-grid">
        <label>
          {text("Ngôn ngữ", "Language")}
          <Select
            value={profile.data?.locale ?? ""}
            disabled={!profile.data || saveLanguage.isPending}
            onValueChange={(next) => saveLanguage.mutate(next)}
          >
            <SelectTrigger className="account-settings-select" aria-label={text("Ngôn ngữ", "Language")}>
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
        </label>
        <label>
          {text("Múi giờ", "Time zone")}
          <PublicTimeZoneSelect locale={locale} product="stream" triggerClassName="account-settings-select" />
        </label>
        <label>
          {text("Định dạng ngày", "Date format")}
          <PublicDateFormatSelect locale={locale} product="stream" triggerClassName="account-settings-select" />
        </label>
        <label>
          {text("Tiền tệ", "Currency")}
          <PublicCurrencySelect locale={locale} product="stream" triggerClassName="account-settings-select" />
        </label>
      </div>
      {saveLanguage.isError && (
        <p role="alert">
          {text("Chưa lưu được ngôn ngữ. Hãy thử lại.", "The language could not be saved. Please try again.")}
        </p>
      )}
    </section>
  )
}
