import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/public-overlay"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/public-select"
import { PublicDateFormatSelect } from "@aov/ui/components/public-date-format-select"
import { PublicCurrencySelect } from "@aov/ui/components/public-currency-select"
import { PublicTimeZoneSelect } from "@aov/ui/components/public-time-zone-select"
import { WikiIcon } from "../components/wiki-icon"
import { useWikiContext, type WikiRegion } from "./wiki-context"
import { isEnglishLocale, localeText, marketName } from "@aov/ui/lib/locale-text"

const FLAGS = new Set(["VN", "US", "TH", "TW", "ID"])

function MarketFlag({ code }: { code: string }) {
  return FLAGS.has(code) ? (
    <img
      className="wiki-preference-flag"
      src={`/icons/flags/${code.toLowerCase()}.svg`}
      alt=""
      width="20"
      height="14"
    />
  ) : (
    <WikiIcon name="globe" size={16} />
  )
}
function MarketName({ region, english }: { region: WikiRegion; english: boolean }) {
  return <>{marketName(region.code, english ? "en-US" : "vi-VN", region.displayName)}</>
}

/** Each language is named in itself, so a reader finds their own whichever language the page is in. */
const LANGUAGE_NAMES: Record<string, string> = { "vi-VN": "Tiếng Việt", "en-US": "English" }

export function WikiPreferenceControls({ mobile = false }: { mobile?: boolean }) {
  const context = useWikiContext()
  const { region, locale, regions, regionsPending, regionsError, setRegion } = context
  const t = localeText(locale)
  const [marketOpen, setMarketOpen] = useState(false)
  const current = regions.find((market) => market.code === region)
  const english = isEnglishLocale(locale)

  if (mobile)
    return (
      <div className="wiki-preferences-mobile">
        <div className="wiki-preference-row">
          <span>
            <WikiIcon name="globe" size={16} />
            {t("Ngôn ngữ", "Language")}
          </span>
          <LanguageSwitch />
        </div>
        <div className="wiki-preference-row">
          <span>
            <WikiIcon name="clock" size={16} />
            {t("Múi giờ", "Time zone")}
          </span>
          <PublicTimeZoneSelect
            locale={locale}
            product="wiki"
            triggerClassName="wiki-preference-mobile-select wiki-preference-time-zone-select"
          />
        </div>
        <div className="wiki-preference-row">
          <span>
            <WikiIcon name="clock" size={16} />
            {t("Định dạng ngày", "Date format")}
          </span>
          <PublicDateFormatSelect
            locale={locale}
            product="wiki"
            triggerClassName="wiki-preference-mobile-select wiki-preference-time-zone-select"
          />
        </div>
        <div className="wiki-preference-row">
          <span>
            <WikiIcon name="coins" size={16} />
            {t("Tiền tệ", "Currency")}
          </span>
          <PublicCurrencySelect
            locale={locale}
            product="wiki"
            triggerClassName="wiki-preference-mobile-select wiki-preference-time-zone-select"
          />
        </div>
        <div className="wiki-preference-row">
          <span>
            <MarketFlag code={region} />
            {t("Thị trường dữ liệu", "Game market")}
          </span>
          <Select value={region} disabled={regionsPending} onValueChange={setRegion}>
            <SelectTrigger
              className="wiki-preference-mobile-select"
              aria-label={t("Thị trường dữ liệu", "Game market")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent drawerTitle={t("Thị trường dữ liệu", "Game market")}>
              {!current && <SelectItem value={region}>{region}</SelectItem>}
              {regions.map((market) => (
                <SelectItem key={market.code} value={market.code} disabled={!market.available}>
                  {marketName(market.code, english ? "en-US" : "vi-VN", market.displayName)}
                  {!market.available ? ` · ${t("Chưa hỗ trợ", "Unavailable")}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {regionsError && (
          <button className="wiki-preference-retry" type="button" onClick={() => void context.retryRegions()}>
            {t("Chưa tải được thị trường.", "Markets could not be loaded.")} {t("Thử lại", "Retry")}
          </button>
        )}
      </div>
    )

  const languageName = LANGUAGE_NAMES[locale] ?? locale
  const marketLabel = current ? marketName(current.code, english ? "en-US" : "vi-VN", current.displayName) : region

  return (
    <div className="wiki-preferences-desktop">
      <Popover open={marketOpen} onOpenChange={setMarketOpen}>
        <PopoverTrigger
          className="wiki-preference-trigger"
          aria-label={`${t("Thị trường và ngôn ngữ", "Market and language")}: ${marketLabel}, ${languageName}`}
        >
          <MarketFlag code={region} />
          <span>{region}</span>
          <WikiIcon name="chevron" size={13} />
        </PopoverTrigger>
        <PopoverContent
          className="wiki-preference-panel"
          drawerTitle={t("Thị trường và ngôn ngữ", "Market and language")}
          align="end"
          sideOffset={10}
        >
          <h2 className="wiki-preference-heading">{t("Thị trường", "Market")}</h2>
          {regionsPending ? (
            <p className="wiki-preference-status" role="status">
              {t("Đang tải…", "Loading…")}
            </p>
          ) : regionsError ? (
            <button className="wiki-preference-retry" type="button" onClick={() => void context.retryRegions()}>
              {t("Chưa tải được thị trường.", "Markets could not be loaded.")} {t("Thử lại", "Retry")}
            </button>
          ) : (
            <div className="wiki-preference-options">
              {regions.map((market) => (
                <button
                  key={market.code}
                  type="button"
                  disabled={!market.available}
                  title={market.unavailableReason ?? undefined}
                  aria-pressed={market.code === region}
                  onClick={() => {
                    setRegion(market.code)
                    setMarketOpen(false)
                  }}
                >
                  <MarketFlag code={market.code} />
                  <span>
                    <MarketName region={market} english={english} />
                  </span>
                  {market.available ? (
                    market.code === region && <WikiIcon name="check" size={16} />
                  ) : (
                    <small>{t("Chưa hỗ trợ", "Unavailable")}</small>
                  )}
                </button>
              ))}
            </div>
          )}
          <h2 className="wiki-preference-heading">{t("Ngôn ngữ", "Language")}</h2>
          <LanguageSwitch />
          <h2 className="wiki-preference-heading">{t("Hiển thị", "Display")}</h2>
          <div className="wiki-preference-display">
            <label>
              <span>{t("Múi giờ", "Time zone")}</span>
              <PublicTimeZoneSelect locale={locale} product="wiki" triggerClassName="wiki-preference-select" />
            </label>
            <label>
              <span>{t("Định dạng ngày", "Date format")}</span>
              <PublicDateFormatSelect locale={locale} product="wiki" triggerClassName="wiki-preference-select" />
            </label>
            <label>
              <span>{t("Tiền tệ", "Currency")}</span>
              <PublicCurrencySelect locale={locale} product="wiki" triggerClassName="wiki-preference-select" />
            </label>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

/** The two languages side by side, the current one filled; each is named in itself. */
function LanguageSwitch() {
  const { locale, setLocale } = useWikiContext()
  const t = localeText(locale)
  return (
    <div className="wiki-preference-segment" role="group" aria-label={t("Ngôn ngữ", "Language")}>
      {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
        <button key={code} type="button" lang={code} aria-pressed={code === locale} onClick={() => setLocale(code)}>
          {name}
        </button>
      ))}
    </div>
  )
}
