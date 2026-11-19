import { Info, ExternalLink, Copyright, CircleAlert } from "lucide-react"
import type { ReactNode } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "./public-overlay"
import { creditHttpUrl, needsMediaCredit, type MediaCredit } from "../lib/media-credit"
import { localeText } from "@aov/ui/lib/locale-text"

/** Render as a sibling of image links and preview buttons, never inside an interactive card. */
export function ImageCredit({
  sources = [],
  contactHref,
  manageHref,
  flagMissing = false,
  className = "",
  pageBaseHref,
  renderPageReference,
  mobileDrawer = false,
  locale = "vi-VN",
}: {
  sources?: MediaCredit[]
  contactHref?: string
  /** Admin only: where the image's source can be corrected. */
  manageHref?: string
  /** Admin only: highlight the button while the image lacks a verified source or owner. */
  flagMissing?: boolean
  className?: string
  pageBaseHref?: string
  renderPageReference?: (id: string, label: string) => ReactNode
  mobileDrawer?: boolean
  /** The reader's language; source and owner names stay as they were recorded. */
  locale?: string
}) {
  const t = localeText(locale)
  const missing = flagMissing && needsMediaCredit(sources)
  const reference = (id: string, label: string) =>
    renderPageReference ? (
      renderPageReference(id, label)
    ) : pageBaseHref ? (
      <a
        className="underline decoration-dotted underline-offset-4"
        href={`${pageBaseHref.replace(/\/$/, "")}/${encodeURIComponent(id)}`}
      >
        {label}
      </a>
    ) : (
      label
    )
  return (
    <Popover mobileDrawer={mobileDrawer}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            missing
              ? t("Nguồn ảnh · chưa đủ nguồn hoặc chủ sở hữu", "Image source · source or owner incomplete")
              : t("Nguồn ảnh", "Image source")
          }
          title={
            missing ? t("Chưa đủ nguồn hoặc chủ sở hữu", "Source or owner incomplete") : t("Nguồn ảnh", "Image source")
          }
          className={`absolute right-1 bottom-1 z-30 grid size-7 place-items-center rounded-full border shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${missing ? "border-amber-200/60 bg-amber-500 text-black hover:bg-amber-400" : "border-white/30 bg-black/75 text-white hover:bg-black"} ${className}`}
          onClick={(event) => event.stopPropagation()}
        >
          {missing ? (
            <CircleAlert className="size-4" aria-hidden="true" />
          ) : (
            <Info className="size-4" aria-hidden="true" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        drawerTitle={t("Nguồn ảnh", "Image source")}
        align="end"
        className="z-[100] max-h-[min(30rem,80dvh)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto text-sm"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-3 font-semibold">{t("Nguồn ảnh", "Image source")}</h2>
        {sources.length ? (
          <ul className="space-y-4">
            {sources.map((source, index) => {
              const url = creditHttpUrl(source.url)
              const contact = creditHttpUrl(source.contactUrl)
              return (
                <li key={index} className="space-y-1.5 break-words">
                  <p className="text-xs text-muted-foreground">{t("Thuộc về", "Belongs to")}</p>
                  {source.ownerName ? (
                    <p className="flex items-center gap-1.5 font-semibold">
                      <Copyright className="size-4 shrink-0" aria-hidden="true" />
                      {source.ownerPageId ? reference(source.ownerPageId, source.ownerName) : source.ownerName}
                    </p>
                  ) : (
                    <p className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
                      <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
                      {t("Chưa xác nhận chủ sở hữu", "Owner not confirmed")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t("Lấy từ:", "Taken from:")}{" "}
                    {source.unverified ? t("Chưa xác minh nguồn", "Source not verified") : source.label}
                  </p>
                  {source.relatedPageId && (pageBaseHref || renderPageReference) && (
                    <p>{reference(source.relatedPageId, t("Xem hồ sơ nội dung liên quan", "See the related page"))}</p>
                  )}
                  {url && (
                    <a
                      className="flex items-center gap-1 underline underline-offset-4"
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                    >
                      {t("Xem nguồn gốc", "View the original")} <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  )}
                  {contact && (
                    <a className="block text-xs underline" href={contact} target="_blank" rel="noopener noreferrer">
                      {t("Liên hệ bên cung cấp", "Contact the provider")}
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground">
            {t(
              "Chưa xác minh nguồn ảnh. Bạn có thể gửi thông tin bổ sung.",
              "This image's source has not been verified. You can send more information.",
            )}
          </p>
        )}
        {contactHref && (
          <a className="mt-4 block border-t pt-3 text-xs underline underline-offset-4" href={contactHref}>
            {t("Liên hệ về ảnh / đính chính nguồn", "Contact us about this image or correct its source")}
          </a>
        )}
        {manageHref && (
          <a className="mt-4 block border-t pt-3 text-xs underline underline-offset-4" href={manageHref}>
            {t("Sửa nguồn trong Quản lý tệp", "Edit the source in File management")}
          </a>
        )}
      </PopoverContent>
    </Popover>
  )
}
