import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { WikiIcon } from "../components/wiki-icon"
import { useWikiContext, type WikiRegion, type WikiLanguage } from "./wiki-context"

const LANGUAGES: WikiLanguage[] = [
  { code: "vi-VN", name: "Tiếng Việt" },
  { code: "en-US", name: "English" },
]
const FLAGS = new Set(["VN", "US", "TH", "TW", "ID"])
const MARKET_NAMES: Record<string, string> = {
  VN: "Vietnam",
  TH: "Thailand",
  TW: "Taiwan",
  ID: "Indonesia",
  GLOBAL: "Global",
}

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
  return <>{english ? (MARKET_NAMES[region.code] ?? region.displayName) : region.displayName}</>
}

export function WikiPreferenceControls({ mobile = false }: { mobile?: boolean }) {
  const context = useWikiContext()
  const { region, locale, regions, regionsPending, regionsError, setRegion, setLocale, t } = context
  const [marketOpen, setMarketOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  const current = regions.find((market) => market.code === region)
  const english = locale.startsWith("en")
  const languages = context.options?.languages.length ? context.options.languages : LANGUAGES

  if (mobile)
    return (
      <div className="wiki-preferences-mobile">
        <label>
          <span>
            <WikiIcon name="globe" size={18} />
            {t("market")}
          </span>
          <select value={region} disabled={regionsPending} onChange={(event) => setRegion(event.target.value)}>
            {!current && <option value={region}>{region}</option>}
            {regions.map((market) => (
              <option key={market.code} value={market.code} disabled={!market.available}>
                {english ? (MARKET_NAMES[market.code] ?? market.displayName) : market.displayName}
                {!market.available ? ` · ${t("unavailable")}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>
            <WikiIcon name="globe" size={18} />
            {t("language")}
          </span>
          <select value={locale} onChange={(event) => setLocale(event.target.value)}>
            {languages.map((language) => (
              <option key={language.code} value={language.code}>
                {language.nativeName ?? language.name}
              </option>
            ))}
          </select>
        </label>
        {regionsError && (
          <button className="wiki-preference-retry" type="button" onClick={() => void context.retryRegions()}>
            {t("marketError")} {t("retry")}
          </button>
        )}
        <p>{t("marketNote")}</p>
      </div>
    )

  return (
    <div className="wiki-preferences-desktop">
      <Popover open={marketOpen} onOpenChange={setMarketOpen}>
        <PopoverTrigger className="wiki-preference-trigger" aria-label={`${t("market")}: ${region}`}>
          <MarketFlag code={region} />
          <span>{region}</span>
          <WikiIcon name="chevron" size={13} />
        </PopoverTrigger>
        <PopoverContent className="wiki-preference-panel" align="end" sideOffset={12}>
          <h2>{t("market")}</h2>
          {regionsPending ? (
            <p role="status">{t("loading")}</p>
          ) : regionsError ? (
            <button className="wiki-preference-retry" type="button" onClick={() => void context.retryRegions()}>
              {t("marketError")} {t("retry")}
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
                    <strong>
                      <MarketName region={market} english={english} />
                    </strong>
                    {!market.available && (
                      <small>
                        {t("unavailable")}
                        {!english && market.unavailableReason ? ` · ${market.unavailableReason}` : ""}
                      </small>
                    )}
                  </span>
                  {market.code === region && <WikiIcon name="check" size={15} />}
                </button>
              ))}
            </div>
          )}
          <p className="wiki-preference-note">{t("marketNote")}</p>
        </PopoverContent>
      </Popover>
      <Popover open={languageOpen} onOpenChange={setLanguageOpen}>
        <PopoverTrigger className="wiki-preference-trigger" aria-label={t("language")}>
          <WikiIcon name="globe" size={16} />
          <span>{locale.startsWith("en") ? "EN" : locale === "vi-VN" ? "VI" : locale}</span>
          <WikiIcon name="chevron" size={13} />
        </PopoverTrigger>
        <PopoverContent className="wiki-preference-panel wiki-preference-language" align="end" sideOffset={12}>
          <h2>{t("language")}</h2>
          <div className="wiki-preference-options">
            {languages.map((language) => (
              <button
                key={language.code}
                type="button"
                aria-pressed={language.code === locale}
                onClick={() => {
                  setLocale(language.code)
                  setLanguageOpen(false)
                }}
              >
                <span>
                  <strong>{language.nativeName ?? language.name}</strong>
                </span>
                {language.code === locale && <WikiIcon name="check" size={15} />}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
