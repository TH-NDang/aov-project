import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { CalendarDays, Clock3, Coins, Globe2, LogIn, LogOut, Moon, Sun } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "./public-overlay"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./public-select"
import { PublicCurrencySelect } from "./public-currency-select"
import { PublicDateFormatSelect } from "./public-date-format-select"
import { PublicTimeZoneSelect } from "./public-time-zone-select"
import { usePageLayout } from "../hooks/use-page-layout"
import { isEnglishLocale, localeText } from "@aov/ui/lib/locale-text"
import "./public-account-menu.css"

export type PublicAccountOptionsProps = {
  product: "wiki" | "stream"
  locale: string
  onLocaleChange: (locale: string) => void
  languages?: { code: string; name: string }[]
  theme?: "light" | "dark"
  onThemeChange?: (theme: "light" | "dark") => void
  name?: string
  avatarUrl?: string | null
  loading?: boolean
  onSignIn: () => Promise<void>
  onSignOut?: () => void
  children?: ReactNode
}
type Props = PublicAccountOptionsProps & {
  triggerClassName?: string
  /** False opens the menu on click only, like the other menus of an app that has no hover menus. */
  openOnHover?: boolean
}
/** `sheet` gives the settings and the links the roomier rows of the preferences sheet phones open. */
export type PublicAccountLayout = "menu" | "sheet"

export function PublicAccountMenu(props: Props) {
  const mobile = usePageLayout() === "compact"
  const { product, locale, name, avatarUrl, triggerClassName = "", openOnHover = true } = props
  const hoverable = openOnHover && !mobile
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const hovered = useRef(false)
  const panel = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const english = isEnglishLocale(locale)
  const text = (vi: string, en: string) => (english ? en : vi)
  const cancel = () => clearTimeout(timer.current)
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (!open) return
    const onResize = () => {
      if (!trigger.current?.getClientRects().length) setOpen(false)
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [open])
  function leave() {
    if (!hoverable) return
    cancel()
    timer.current = setTimeout(() => {
      if (panel.current?.querySelector('[data-slot="select-trigger"][data-state="open"]')) return
      if (!panel.current?.contains(document.activeElement)) setOpen(false)
    }, 220)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        ref={trigger}
        className={`public-account-trigger ${triggerClassName}`}
        data-product={product}
        data-account={name ? "signed-in" : "guest"}
        aria-label={text("Tài khoản và tùy chọn", "Account and preferences")}
        onPointerEnter={(event) => {
          if (!hoverable || event.pointerType !== "mouse") return
          cancel()
          if (!open)
            timer.current = setTimeout(() => {
              hovered.current = true
              setOpen(true)
            }, 100)
        }}
        onPointerLeave={leave}
        onClick={(event) => {
          cancel()
          if (open && hovered.current) event.preventDefault()
          hovered.current = false
        }}
      >
        <AccountAvatar name={name} avatarUrl={avatarUrl} className="public-account-trigger-user" />
      </PopoverTrigger>
      <PopoverContent
        drawerTitle={text("Tài khoản và tùy chọn", "Account and preferences")}
        ref={panel}
        align="end"
        side="bottom"
        sideOffset={10}
        collisionPadding={12}
        className="public-account-panel"
        data-product={product}
        aria-label={text("Tài khoản và tùy chọn", "Account and preferences")}
        onPointerEnter={cancel}
        onPointerLeave={leave}
        onFocusCapture={cancel}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) leave()
        }}
        onOpenAutoFocus={(event) => {
          if (hovered.current) event.preventDefault()
        }}
        onCloseAutoFocus={(event) => {
          if (hovered.current) event.preventDefault()
          hovered.current = false
        }}
        onClick={(event) => {
          if ((event.target as Element).closest("a")) setOpen(false)
        }}
      >
        <PublicAccountOptions {...props} />
      </PopoverContent>
    </Popover>
  )
}

export function PublicAccountOptions({
  product,
  locale,
  onLocaleChange,
  languages = [
    { code: "vi", name: "Tiếng Việt" },
    { code: "en", name: "English" },
  ],
  theme,
  onThemeChange,
  name,
  avatarUrl,
  loading,
  onSignIn,
  onSignOut,
  children,
}: PublicAccountOptionsProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const text = localeText(locale)
  const signedIn = Boolean(name && onSignOut)
  return (
    <>
      <div className="public-account-heading">
        <AccountAvatar name={name} avatarUrl={avatarUrl} className="public-account-avatar" />
        <div>
          <strong>{name || text("Chào bạn!", "Welcome!")}</strong>
          <small>
            {signedIn
              ? text("Tài khoản AOV của bạn", "Your AOV account")
              : text("Một tài khoản cho Wiki và Stream", "One account for Wiki and Stream")}
          </small>
        </div>
      </div>
      {!signedIn && (
        <div className="public-account-signin">
          <button
            type="button"
            disabled={pending || loading}
            onClick={() => {
              setPending(true)
              setError(false)
              void onSignIn()
                .catch(() => setError(true))
                .finally(() => setPending(false))
            }}
          >
            <LogIn size={17} />
            {pending || loading ? text("Đang kết nối…", "Connecting…") : text("Đăng nhập", "Sign in")}
          </button>
        </div>
      )}
      {error && (
        <p className="public-account-error" role="alert">
          {text("Chưa mở được đăng nhập. Vui lòng thử lại.", "Could not open sign-in. Please try again.")}
        </p>
      )}
      {children && <PublicAccountLinks>{children}</PublicAccountLinks>}
      <p className="public-account-section-label">{text("Tùy chọn", "Preferences")}</p>
      <PublicAccountSettings
        product={product}
        locale={locale}
        onLocaleChange={onLocaleChange}
        languages={languages}
        theme={theme}
        onThemeChange={onThemeChange}
      />
      {signedIn && (
        <button className="public-account-logout" type="button" onClick={onSignOut}>
          <LogOut size={17} />
          {text("Đăng xuất", "Sign out")}
        </button>
      )}
    </>
  )
}

/**
 * A guest's picture: a filled head and shoulders that fill the disc and meet its bottom edge, as a default profile
 * picture does, rather than a thin outline floating in the middle.
 */
function GuestFigure() {
  return (
    <svg className="public-account-guest" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="15.5" r="7" fill="currentColor" />
      <path d="M5.5 40c0-8.6 6.5-14.5 14.5-14.5S34.5 31.4 34.5 40Z" fill="currentColor" />
    </svg>
  )
}

/** The reader's picture, else the first letter of their name, else a figure; round and tinted with the app's accent. */
function AccountAvatar({
  name,
  avatarUrl,
  className,
}: {
  name?: string
  avatarUrl?: string | null
  className: string
}) {
  const initial = name ? Array.from(name.trim())[0]?.toUpperCase() : undefined
  return (
    <span className={className} data-avatar={avatarUrl ? "picture" : initial ? "initial" : "guest"} aria-hidden="true">
      {avatarUrl ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer" /> : initial ? initial : <GuestFigure />}
    </span>
  )
}

/** The pages an app adds to the account panel, such as the reader's profile. */
export function PublicAccountLinks({
  layout = "menu",
  children,
}: {
  layout?: PublicAccountLayout
  children: ReactNode
}) {
  return (
    <div className="public-account-links" data-layout={layout}>
      {children}
    </div>
  )
}

export function PublicAccountSettings({
  product,
  locale,
  onLocaleChange,
  languages = [
    { code: "vi", name: "Tiếng Việt" },
    { code: "en", name: "English" },
  ],
  theme,
  onThemeChange,
  layout = "menu",
}: Pick<
  PublicAccountOptionsProps,
  "product" | "locale" | "onLocaleChange" | "languages" | "theme" | "onThemeChange"
> & {
  layout?: PublicAccountLayout
}) {
  const languageId = useId()
  const timeZoneId = useId()
  const dateFormatId = useId()
  const currencyId = useId()
  const text = localeText(locale)
  return (
    <div className="public-account-settings" data-layout={layout}>
      <div className="public-account-language">
        <label htmlFor={languageId}>
          <Globe2 size={17} aria-hidden="true" />
          {text("Ngôn ngữ", "Language")}
        </label>
        <Select value={locale} onValueChange={onLocaleChange}>
          <SelectTrigger
            id={languageId}
            className="public-account-language-trigger"
            aria-label={text("Ngôn ngữ", "Language")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            drawerTitle={text("Ngôn ngữ", "Language")}
            className="public-account-theme public-account-language-menu"
            data-product={product}
            position="popper"
            align="end"
            sideOffset={4}
          >
            {languages.map((language) => (
              <SelectItem key={language.code} value={language.code}>
                {language.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="public-account-language">
        <label htmlFor={timeZoneId}>
          <Clock3 size={17} aria-hidden="true" />
          {text("Múi giờ", "Time zone")}
        </label>
        <PublicTimeZoneSelect
          id={timeZoneId}
          locale={locale}
          product={product}
          triggerClassName="public-account-language-trigger public-account-time-zone-trigger"
          contentClassName="public-account-theme public-account-language-menu"
        />
      </div>
      <div className="public-account-language">
        <label htmlFor={dateFormatId}>
          <CalendarDays size={17} aria-hidden="true" />
          {text("Định dạng ngày", "Date format")}
        </label>
        <PublicDateFormatSelect
          id={dateFormatId}
          locale={locale}
          product={product}
          triggerClassName="public-account-language-trigger public-account-time-zone-trigger"
          contentClassName="public-account-theme public-account-language-menu"
        />
      </div>
      <div className="public-account-language">
        <label htmlFor={currencyId}>
          <Coins size={17} aria-hidden="true" />
          {text("Tiền tệ", "Currency")}
        </label>
        <PublicCurrencySelect
          id={currencyId}
          locale={locale}
          product={product}
          triggerClassName="public-account-language-trigger public-account-time-zone-trigger"
          contentClassName="public-account-theme public-account-language-menu"
        />
      </div>
      {theme && onThemeChange && (
        <fieldset className="public-account-appearance">
          <legend>
            <Sun size={17} aria-hidden="true" />
            {text("Hiển thị", "Appearance")}
          </legend>
          <div>
            <button type="button" aria-pressed={theme === "light"} onClick={() => onThemeChange("light")}>
              <Sun size={16} />
              {text("Sáng", "Light")}
            </button>
            <button type="button" aria-pressed={theme === "dark"} onClick={() => onThemeChange("dark")}>
              <Moon size={16} />
              {text("Tối", "Dark")}
            </button>
          </div>
        </fieldset>
      )}
    </div>
  )
}

export function PublicAccountSummary({
  locale,
  name,
  avatarUrl,
  loading,
  onSignIn,
  onSignOut,
  children,
  layout = "menu",
}: Pick<
  PublicAccountOptionsProps,
  "locale" | "name" | "avatarUrl" | "loading" | "onSignIn" | "onSignOut" | "children"
> & {
  layout?: PublicAccountLayout
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const text = localeText(locale)
  const summary = (
    <>
      <AccountAvatar name={name} avatarUrl={avatarUrl} className="public-account-avatar" />
      <span className="public-account-summary-copy">
        <strong>
          {name ||
            (pending || loading ? text("Đang kết nối…", "Connecting…") : text("Đăng nhập AOV", "Sign in to AOV"))}
        </strong>
        <small>
          {name
            ? text("Tài khoản của bạn", "Your account")
            : text("Dùng chung cho Wiki và Stream", "One account for Wiki and Stream")}
        </small>
      </span>
    </>
  )
  return (
    <>
      {name ? (
        <div className="public-account-summary">
          {summary}
          <button
            className="public-account-summary-exit"
            type="button"
            onClick={onSignOut}
            aria-label={text("Đăng xuất", "Sign out")}
            title={text("Đăng xuất", "Sign out")}
          >
            <LogOut size={18} />
          </button>
        </div>
      ) : (
        <button
          className="public-account-summary"
          type="button"
          disabled={pending || loading}
          onClick={() => {
            setPending(true)
            setError(false)
            void onSignIn()
              .catch(() => setError(true))
              .finally(() => setPending(false))
          }}
        >
          {summary}
          <LogIn className="public-account-summary-action" size={19} aria-hidden="true" />
        </button>
      )}
      {name && children && <PublicAccountLinks layout={layout}>{children}</PublicAccountLinks>}
      {error && (
        <p className="public-account-error" role="alert">
          {text("Chưa mở được đăng nhập. Vui lòng thử lại.", "Could not open sign-in. Please try again.")}
        </p>
      )}
    </>
  )
}
