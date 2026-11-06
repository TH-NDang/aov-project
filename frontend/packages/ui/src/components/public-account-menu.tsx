import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { Clock3, Globe2, LogIn, LogOut, Moon, Sun, UserRound } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "./public-overlay"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./public-select"
import { PublicTimeZoneSelect } from "./public-time-zone-select"
import { useIsMobile } from "../hooks/use-mobile"
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
type Props = PublicAccountOptionsProps & { triggerClassName?: string }

export function PublicAccountMenu(props: Props) {
  const mobile = useIsMobile()
  const { product, locale, name, avatarUrl, triggerClassName = "" } = props
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const hovered = useRef(false)
  const panel = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const english = locale.startsWith("en")
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
    if (mobile) return
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
        aria-label={text("Tài khoản và tùy chọn", "Account and preferences")}
        onPointerEnter={(event) => {
          if (mobile || event.pointerType !== "mouse") return
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
        <span className="public-account-trigger-user" aria-hidden="true">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : name ? (
            Array.from(name.trim())[0]?.toUpperCase()
          ) : (
            <UserRound size={19} />
          )}
        </span>
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
  loading,
  onSignIn,
  onSignOut,
  children,
}: PublicAccountOptionsProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const text = (vi: string, en: string) => (locale.startsWith("en") ? en : vi)
  return (
    <>
      <div className="public-account-heading">
        <span className="public-account-avatar">
          <UserRound size={21} aria-hidden="true" />
        </span>
        <div>
          <strong>{name || text("Chào bạn!", "Welcome!")}</strong>
          <small>{text("Tài khoản AOV của bạn", "Your AOV account")}</small>
        </div>
      </div>
      {children && <div className="public-account-links">{children}</div>}
      <PublicAccountSettings
        product={product}
        locale={locale}
        onLocaleChange={onLocaleChange}
        languages={languages}
        theme={theme}
        onThemeChange={onThemeChange}
      />
      {name && onSignOut ? (
        <button className="public-account-logout" type="button" onClick={onSignOut}>
          <LogOut size={17} />
          {text("Đăng xuất", "Sign out")}
        </button>
      ) : (
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
          <p>{text("Một tài khoản cho Wiki và Stream.", "One account for Wiki and Stream.")}</p>
        </div>
      )}
      {error && (
        <p className="public-account-error" role="alert">
          {text("Chưa mở được đăng nhập. Vui lòng thử lại.", "Could not open sign-in. Please try again.")}
        </p>
      )}
    </>
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
}: Pick<PublicAccountOptionsProps, "product" | "locale" | "onLocaleChange" | "languages" | "theme" | "onThemeChange">) {
  const languageId = useId()
  const timeZoneId = useId()
  const text = (vi: string, en: string) => (locale.startsWith("en") ? en : vi)
  return (
    <div className="public-account-settings">
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
  loading,
  onSignIn,
  onSignOut,
}: Pick<PublicAccountOptionsProps, "locale" | "name" | "loading" | "onSignIn" | "onSignOut">) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const text = (vi: string, en: string) => (locale.startsWith("en") ? en : vi)
  const summary = (
    <>
      <span className="public-account-avatar">
        <UserRound size={19} aria-hidden="true" />
      </span>
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
      {error && (
        <p className="public-account-error" role="alert">
          {text("Chưa mở được đăng nhập. Vui lòng thử lại.", "Could not open sign-in. Please try again.")}
        </p>
      )}
    </>
  )
}
