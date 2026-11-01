import { Info, ExternalLink, Copyright, CircleAlert } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { creditHttpUrl, needsMediaCredit, type MediaCredit } from "../lib/media-credit"

/** Render as a sibling of image links and preview buttons, never inside an interactive card. */
export function ImageCredit({
  sources = [],
  contactHref,
  manageHref,
  flagMissing = false,
  className = "",
}: {
  sources?: MediaCredit[]
  contactHref?: string
  /** Admin only: where the image's source can be corrected. */
  manageHref?: string
  /** Admin only: highlight the button while the image lacks a verified source or owner. */
  flagMissing?: boolean
  className?: string
}) {
  const missing = flagMissing && needsMediaCredit(sources)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={missing ? "Nguồn ảnh · chưa đủ nguồn hoặc chủ sở hữu" : "Nguồn ảnh"}
          title={missing ? "Chưa đủ nguồn hoặc chủ sở hữu" : "Nguồn ảnh"}
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
        align="end"
        className="z-[100] max-h-[min(30rem,80dvh)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto text-sm"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-3 font-semibold">Nguồn ảnh</h2>
        {sources.length ? (
          <ul className="space-y-4">
            {sources.map((source, index) => {
              const url = creditHttpUrl(source.url)
              const contact = creditHttpUrl(source.contactUrl)
              return (
                <li key={index} className="space-y-1.5 break-words">
                  <p className="text-xs text-muted-foreground">Thuộc về</p>
                  {source.ownerName ? (
                    <p className="flex items-center gap-1.5 font-semibold">
                      <Copyright className="size-4 shrink-0" aria-hidden="true" />
                      {source.ownerName}
                    </p>
                  ) : (
                    <p className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
                      <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
                      Chưa xác nhận chủ sở hữu
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Lấy từ: {source.label}</p>
                  {url && (
                    <a
                      className="flex items-center gap-1 underline underline-offset-4"
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                    >
                      Xem nguồn gốc <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  )}
                  {contact && (
                    <a className="block text-xs underline" href={contact} target="_blank" rel="noopener noreferrer">
                      Liên hệ bên cung cấp
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground">Chưa xác minh nguồn ảnh. Bạn có thể gửi thông tin bổ sung.</p>
        )}
        {contactHref && (
          <a className="mt-4 block border-t pt-3 text-xs underline underline-offset-4" href={contactHref}>
            Liên hệ về ảnh / đính chính nguồn
          </a>
        )}
        {manageHref && (
          <a className="mt-4 block border-t pt-3 text-xs underline underline-offset-4" href={manageHref}>
            Sửa nguồn trong Quản lý ảnh
          </a>
        )}
      </PopoverContent>
    </Popover>
  )
}
