import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarDays, Clock3, Coins, Languages } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { chooseCurrency, useUserCurrency } from "@aov/ui/lib/currency"
import {
  DATE_FORMATS,
  canonicalTimeZone,
  chooseDateFormat,
  chooseTimeZone,
  dateFormatLabel,
  isDateFormat,
  useDateFormat,
  useUserTimeZone,
  type DateFormat,
} from "@aov/ui/lib/time-zone"
import { useSession } from "@/app/auth/auth-gate"
import { Page, PageHeader } from "@/components/page-header"
import { ProfilePreferencePicker, currencyOptions, languageOptions, timeZoneOptions } from "./profile-preference-picker"
import { profileError, saveProfile, selfProfile, userKeys, type UserProfile } from "./user-api"

const dateFormatOptions = DATE_FORMATS.map((value) => ({ value, label: dateFormatLabel(value) }))

type Preferences = Pick<UserProfile, "locale" | "timeZone" | "currency"> & { dateFormat?: DateFormat }

/** How the app reads for this person. These are not part of who they are, so they live apart from the profile. */
export function SettingsPage() {
  const { actor } = useSession()
  const client = useQueryClient()
  const key = userKeys.selfOf(actor?.issuer, actor?.subject)
  const profile = useQuery({ queryKey: key, queryFn: ({ signal }) => selfProfile(signal) })
  const timeZone = useUserTimeZone()
  const dateFormat = useDateFormat()
  const currency = useUserCurrency()
  const save = useMutation({
    mutationFn: async (change: Partial<Preferences>) => {
      // The other apps share this profile, so the copy on this page may be out of date.
      const latest = await selfProfile()
      return saveProfile(latest.id, {
        displayName: latest.displayName,
        biography: latest.biography,
        locale: latest.locale,
        timeZone: latest.timeZone,
        avatarAssetId: latest.avatarAssetId,
        dateFormat: latest.dateFormat,
        currency: latest.currency,
        ...change,
        expectedVersion: latest.version,
      })
    },
    meta: { successMessage: "Đã lưu cài đặt." },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: userKeys.all })
    },
  })
  return (
    <Page>
      <PageHeader
        title="Cài đặt"
        description="Ngôn ngữ, múi giờ, cách hiển thị ngày và tiền tệ cho tài khoản của bạn."
      />
      {profile.isError ? (
        <div role="alert" className="space-y-2">
          <p className="type-body">{profileError(profile.error)}</p>
          <Button variant="outline" onClick={() => void profile.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : (
        <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
          <ProfilePreferencePicker
            label="Ngôn ngữ"
            icon={Languages}
            value={profile.data?.locale ?? ""}
            options={languageOptions}
            disabled={!profile.data || save.isPending}
            onChange={(value) => save.mutate({ locale: value })}
          />
          <ProfilePreferencePicker
            label="Múi giờ"
            showTime
            icon={Clock3}
            value={canonicalTimeZone(timeZone)}
            options={timeZoneOptions}
            disabled={!profile.data || save.isPending}
            onChange={(value) => {
              void chooseTimeZone(value)
              save.mutate({ timeZone: value })
            }}
          />
          <ProfilePreferencePicker
            label="Định dạng ngày"
            icon={CalendarDays}
            value={dateFormat}
            options={dateFormatOptions}
            disabled={!profile.data || save.isPending}
            onChange={(value) => {
              if (!isDateFormat(value)) return
              void chooseDateFormat(value)
              save.mutate({ dateFormat: value })
            }}
          />
          <ProfilePreferencePicker
            label="Tiền tệ"
            icon={Coins}
            value={currency}
            options={currencyOptions}
            disabled={!profile.data || save.isPending}
            onChange={(value) => {
              void chooseCurrency(value)
              save.mutate({ currency: value })
            }}
          />
        </div>
      )}
    </Page>
  )
}
