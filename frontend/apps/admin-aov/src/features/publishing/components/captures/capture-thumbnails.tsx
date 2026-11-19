import type { RefObject } from "react"
import { cn } from "@aov/ui/lib/utils"
import type { CaptureGroup, CaptureImage } from "../../model/captures/patch-capture-model"

/** Shows only the card, since a row of whole shop screens would all look the same at this size. */
export function CaptureCardThumbnail({
  url,
  box,
  className = "w-16",
}: {
  /** Empty while the presigned link is on its way. */
  url: string | undefined
  box: NonNullable<CaptureImage["box"]>
  className?: string
}) {
  return (
    <span
      className={cn("relative block overflow-hidden bg-muted", className)}
      style={{ aspectRatio: box.width / box.height }}
    >
      {url && (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute max-w-none"
          style={{
            width: `${(box.imageWidth / box.width) * 100}%`,
            height: `${(box.imageHeight / box.height) * 100}%`,
            left: `${(-box.x / box.width) * 100}%`,
            top: `${(-box.y / box.height) * 100}%`,
          }}
        />
      )}
    </span>
  )
}

/** The pictures of the open group in a row; the one on screen is marked and scrolled into view by the panel. */
export function CaptureThumbnails({
  group,
  image,
  stripRef,
  urlOf,
  onPick,
}: {
  group: CaptureGroup
  image: CaptureImage
  stripRef: RefObject<HTMLDivElement | null>
  /** The presigned link of a picture; empty while it is on its way. */
  urlOf: (member: CaptureImage) => string | undefined
  onPick: (member: CaptureImage) => void
}) {
  return (
    <div
      ref={stripRef}
      role="group"
      aria-label={`Các ảnh của ${group.title}`}
      className="flex items-start gap-2 overflow-x-auto p-3"
    >
      {group.images.map((member, index) => (
        <button
          key={member.id}
          type="button"
          aria-current={member.id === image.id}
          aria-label={`Ảnh ${index + 1}: ${member.entryName ?? member.fileName}`}
          title={member.entryName ?? member.fileName}
          className={cn(
            "shrink-0 overflow-hidden rounded-md border-2 outline-none focus-visible:ring-2 focus-visible:ring-ring",
            !member.box && "w-28",
            member.id === image.id ? "border-primary" : "border-transparent opacity-80 hover:opacity-100",
          )}
          onClick={() => onPick(member)}
        >
          {member.box ? (
            <CaptureCardThumbnail url={urlOf(member)} box={member.box} />
          ) : urlOf(member) ? (
            <img
              src={urlOf(member)}
              alt=""
              loading="lazy"
              decoding="async"
              className="aspect-[20/9] w-full bg-muted object-cover"
            />
          ) : (
            <span className="block aspect-[20/9] w-full bg-muted" />
          )}
        </button>
      ))}
    </div>
  )
}
