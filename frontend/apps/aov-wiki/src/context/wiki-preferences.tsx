import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/public-overlay"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/public-select"
import { PublicTimeZoneSelect } from "@aov/ui/components/public-time-zone-select"
import { WikiIcon } from "../components/wiki-icon"
import { useWikiContext, type WikiRegion } from "./wiki-context"

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
  const current = regions.find((market) => market.code === region)
  const english = locale.startsWith("en")

  if (mobile)
    return (
      <div className="wiki-preferences-mobile">
        <div className="wiki-preference-row">
          <span>
            <WikiIcon name="globe" size={16} />
            {t("language")}
          </span>
          <Select value={locale} onValueChange={setLocale}>
            <SelectTrigger className="wiki-preference-mobile-select" aria-label={t("language")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent drawerTitle={t("language")}>
              <SelectItem value="vi-VN">Tiếng Việt</SelectItem>
              <SelectItem value="en-US">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="wiki-preference-row">
          <span>
            <WikiIcon name="clock" size={16} />
            {english ? "Time zone" : "Múi giờ"}
          </span>
          <PublicTimeZoneSelect
            locale={locale}
            product="wiki"
            triggerClassName="wiki-preference-mobile-select wiki-preference-time-zone-select"
          />
        </div>
        <div className="wiki-preference-row">
          <span>
            <MarketFlag code={region} />
            {t("market")}
          </span>
          <Select value={region} disabled={regionsPending} onValueChange={setRegion}>
            <SelectTrigger className="wiki-preference-mobile-select" aria-label={t("market")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent drawerTitle={t("market")}>
              {!current && <SelectItem value={region}>{region}</SelectItem>}
              {regions.map((market) => (
                <SelectItem key={market.code} value={market.code} disabled={!market.available}>
                  {english ? (MARKET_NAMES[market.code] ?? market.displayName) : market.displayName}
                  {!market.available ? ` · ${t("unavailable")}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {regionsError && (
          <button className="wiki-preference-retry" type="button" onClick={() => void context.retryRegions()}>
            {t("marketError")} {t("retry")}
          </button>
        )}
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
        <PopoverContent className="wiki-preference-panel" drawerTitle={t("market")} align="end" sideOffset={12}>
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
                        {!english && market.unavailableReason ? market.unavailableReason : t("unavailable")}
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
    </div>
  )
}
