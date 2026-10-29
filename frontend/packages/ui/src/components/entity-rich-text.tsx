import * as React from "react"
import { ArrowUpRight, BookOpen, Swords, UserRound, Users, Globe2, X, Gem, Shield, Zap } from "lucide-react"
import {
  createEntityIndex,
  entityKindLabels,
  parseRichText,
  resolveEntityRoute,
  safeLinkUrl,
  safeEntityIconUrl,
  referenceTranslation,
  validSkillReference,
  defaultEntityColor,
  type EntityReference,
  type RichTextNode,
} from "../lib/entity-rich-text"
import { Slot } from "radix-ui"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { observeReferenceIcon } from "../lib/observe-reference-icon"
import { countryReferenceFlag, countryReferences } from "../lib/country-references"

export interface EntityRichTextProps {
  text: string
  entities?: EntityReference[]
  index?: ReturnType<typeof createEntityIndex>
  locale: string
  fallbackLocale?: string
  autoRecognize?: boolean
  firstOccurrenceOnly?: boolean
  icons?: boolean
  resolveIcon?: EntityIconResolver
  context: "admin" | "wiki"
  className?: string
}

const emptyEntities: EntityReference[] = []
const kindLabels = entityKindLabels
const hexColor = /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i

export type EntityIconResolver = ((entity: EntityReference) => Promise<string | null | undefined>) & {
  subscribe?: (entity: EntityReference, update: (url: string | null | undefined) => void) => () => void
}

type ReferenceIconProps = {
  entity: EntityReference
  resolveIcon?: EntityIconResolver
  className?: string
  defer?: boolean
}

export function EntityReferenceIcon(props: ReferenceIconProps) {
  return props.defer ? <DeferredReferenceIcon {...props} /> : <ResolvedReferenceIcon {...props} />
}

function DeferredReferenceIcon(props: ReferenceIconProps) {
  const element = React.useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = React.useState(false)
  React.useEffect(() => {
    if (visible || !element.current) return
    return observeReferenceIcon(element.current, () => setVisible(true))
  }, [visible])
  return (
    <span ref={element} aria-hidden="true" className={`inline-flex shrink-0 ${props.className ?? "size-4"}`}>
      <ResolvedReferenceIcon {...props} resolveIcon={visible ? props.resolveIcon : undefined} className="size-full" />
    </span>
  )
}

function ResolvedReferenceIcon({ entity, resolveIcon, className = "size-4" }: ReferenceIconProps) {
  const [resolved, setResolved] = React.useState<string | undefined>(undefined)
  const [failed, setFailed] = React.useState<string | null>(null)
  React.useEffect(() => {
    setResolved(undefined)
    if (!resolveIcon || !entity.iconAssetId) return
    if (resolveIcon.subscribe) return resolveIcon.subscribe(entity, (url) => setResolved(safeEntityIconUrl(url)))
    let active = true
    void resolveIcon(entity).then(
      (value) => {
        if (active) setResolved(safeEntityIconUrl(value))
      },
      () => {},
    )
    return () => {
      active = false
    }
  }, [entity.id, entity.kind, entity.iconAssetId, resolveIcon])
  const icon = safeEntityIconUrl(entity.icon) ?? resolved
  const Fallback = {
    hero: UserRound,
    skill: Zap,
    item: Swords,
    enchantment: Shield,
    arcana: Gem,
    spell: Zap,
    team: Users,
    player: UserRound,
    country: Globe2,
    term: BookOpen,
  }[entity.kind]
  if (entity.kind === "country") {
    const flag = countryReferenceFlag(entity.id)
    if (flag)
      return (
        <img
          src={flag}
          alt=""
          aria-hidden="true"
          className={`inline shrink-0 rounded-sm object-contain align-text-bottom ${className}`}
        />
      )
    if (entity.id !== "GLOBAL")
      return (
        <span
          aria-hidden="true"
          className={`inline-flex shrink-0 items-center justify-center rounded-sm bg-muted text-[0.55em] font-semibold text-muted-foreground ${className}`}
        >
          {entity.id}
        </span>
      )
  }
  return icon && failed !== icon ? (
    <img
      src={icon}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      className={`inline shrink-0 rounded-sm bg-muted object-cover align-text-bottom ${className}`}
      onError={() => setFailed(icon)}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground align-text-bottom ${className}`}
      data-slot="entity-icon-placeholder"
    >
      <Fallback className="size-[70%]" />
    </span>
  )
}

export function EntityReferenceArtwork(props: ReferenceIconProps) {
  if (props.entity.kind !== "skill" || !validSkillReference(props.entity)) return <EntityReferenceIcon {...props} />
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex shrink-0 align-text-bottom ${props.className ?? "size-5"}`}
    >
      <EntityReferenceIcon {...props} className="size-full overflow-hidden rounded-full" />
      <EntityReferenceIcon
        entity={props.entity.owner!}
        resolveIcon={props.resolveIcon}
        defer={props.defer}
        className="absolute -bottom-[12%] -right-[15%] size-[55%] overflow-hidden rounded-full border-2 border-background bg-background"
      />
    </span>
  )
}

export function skillReferenceContext(entity: EntityReference, locale: string, fallbackLocale = "vi-VN") {
  if (entity.kind !== "skill" || !validSkillReference(entity)) return undefined
  const owner = referenceTranslation(entity.owner!, locale, fallbackLocale)
  const slot =
    Number.isInteger(entity.sourceSlot) && entity.sourceSlot! >= 0
      ? entity.sourceSlot === 0
        ? "Nội tại"
        : `Chiêu ${entity.sourceSlot}`
      : undefined
  const variant =
    Number.isInteger(entity.variantNo) && entity.variantNo! > 0 ? `Biến thể ${entity.variantNo}` : undefined
  return {
    ownerName: owner?.name ?? entity.heroId!,
    ownerLocale: owner?.locale,
    detail: [slot, typeof entity.formKey === "string" && entity.formKey ? entity.formKey : variant]
      .filter(Boolean)
      .join(" · "),
  }
}

function renderDescriptionNodes(nodes: RichTextNode[]): React.ReactNode {
  return nodes.map((node, position) => {
    if (node.type === "text") return <React.Fragment key={position}>{node.text}</React.Fragment>
    if (node.type === "reference") return <React.Fragment key={position}>{node.label}</React.Fragment>
    if (node.type === "strong") return <strong key={position}>{renderDescriptionNodes(node.children)}</strong>
    if (node.type === "emphasis") return <em key={position}>{renderDescriptionNodes(node.children)}</em>
    return (
      <span key={position} style={hexColor.test(node.color) ? { color: node.color } : undefined}>
        {renderDescriptionNodes(node.children)}
      </span>
    )
  })
}

export type EntityReferencePopoverProps = {
  entity: EntityReference
  locale: string
  /** Locale the label was matched in; defaults to the best translation for `locale`. */
  actualLocale?: string
  fallbackLocale?: string
  context: "admin" | "wiki"
  /** Used to render references inside the description; an empty index is used when omitted. */
  index?: ReturnType<typeof createEntityIndex>
  resolveIcon?: EntityIconResolver
  /** Name shown when the entity has no translation. */
  label?: string
  /** The element that opens the card on hover, focus or click; must accept a ref and DOM handlers. */
  children: React.ReactElement
}

const emptyIndex = createEntityIndex([], "vi-VN", "vi-VN")

/**
 * The wiki reference card (artwork, kind, name, description and a link to the entry) around any trigger, so other
 * screens show heroes, items or terms exactly like rich-text mentions do.
 */
export function EntityReferencePopover({
  entity,
  locale,
  actualLocale,
  fallbackLocale = "vi-VN",
  context,
  index = emptyIndex,
  resolveIcon,
  label,
  children,
}: EntityReferencePopoverProps) {
  const [open, setOpen] = React.useState(false)
  const trigger = React.useRef<HTMLElement>(null)
  const content = React.useRef<HTMLDivElement>(null)
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const titleId = React.useId()
  const descriptionId = React.useId()
  const suppressFocus = React.useRef(false)
  React.useEffect(() => () => clearTimeout(closeTimer.current), [])
  const cancelClose = () => clearTimeout(closeTimer.current)
  const show = () => {
    cancelClose()
    setOpen(true)
  }
  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = setTimeout(() => {
      const active = trigger.current?.ownerDocument.activeElement
      if (active !== trigger.current && !content.current?.contains(active ?? null)) setOpen(false)
    }, 180)
  }
  const matched = actualLocale ?? referenceTranslation(entity, locale, fallbackLocale)?.locale ?? locale
  const skill = skillReferenceContext(entity, locale, matched)
  const translation = Array.isArray(entity.translations)
    ? entity.translations.find((entry) => entry.locale === matched)
    : undefined
  const description = translation?.description || "Chưa có mô tả cho mục này."
  const descriptionNodes = React.useMemo(
    () => (open ? parseRichText(description, index, { autoRecognize: false }) : []),
    [open, description, index],
  )
  const name = translation?.name || label || entity.id
  const kind = kindLabels[entity.kind] || kindLabels.term
  const route = safeLinkUrl(resolveEntityRoute(entity, context, locale))
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Slot.Root
          ref={trigger}
          onPointerEnter={(event: React.PointerEvent) => {
            if (event.pointerType !== "touch") show()
          }}
          onPointerLeave={scheduleClose}
          onFocus={() => {
            if (!suppressFocus.current) show()
          }}
          onBlur={scheduleClose}
          onClick={(event: React.MouseEvent) => {
            event.preventDefault()
            show()
          }}
          onKeyDown={(event: React.KeyboardEvent) => {
            if (event.key === "Escape") {
              cancelClose()
              setOpen(false)
              event.preventDefault()
            }
          }}
        >
          {children}
        </Slot.Root>
      </PopoverTrigger>
      <PopoverContent
        ref={content}
        align="start"
        collisionPadding={12}
        sideOffset={8}
        className="w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl p-0 break-words shadow-xl"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onPointerEnter={cancelClose}
        onPointerLeave={scheduleClose}
        onFocusCapture={cancelClose}
        onBlurCapture={scheduleClose}
        onEscapeKeyDown={() => {
          suppressFocus.current = true
          trigger.current?.focus()
          queueMicrotask(() => {
            suppressFocus.current = false
          })
        }}
      >
        <div className="flex items-start gap-3 border-b bg-muted/30 p-4">
          <EntityReferenceArtwork entity={entity} resolveIcon={resolveIcon} className="size-11 rounded-lg" />
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-xs font-medium text-muted-foreground">{skill ? skill.ownerName : kind}</div>
            <div id={titleId} className="font-semibold leading-snug">
              {name}
            </div>
            {skill?.detail && <div className="mt-1 text-xs text-muted-foreground">{skill.detail}</div>}
          </div>
          <button
            type="button"
            aria-label={`Đóng thông tin ${name}`}
            className="-mr-2 -mt-2 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
            onClick={() => setOpen(false)}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          {skill && entity.iconSource === "LIBRARY" && (
            <div className="text-xs text-muted-foreground">Ảnh tham khảo từ thư viện kỹ năng</div>
          )}
          {matched.toLowerCase() !== locale.toLowerCase() && (
            <div className="text-xs text-muted-foreground">Ngôn ngữ dự phòng: {matched}</div>
          )}
          <p
            id={descriptionId}
            className="max-h-52 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-muted-foreground"
          >
            {renderDescriptionNodes(descriptionNodes)}
          </p>
          {route && (
            <a
              href={route}
              className="flex min-h-10 items-center justify-between gap-3 rounded-md border px-3 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
            >
              Mở trang {name}
              <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
            </a>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function EntityMention({
  node,
  locale,
  context,
  explicitColor,
  index,
  icons,
  resolveIcon,
}: {
  node: Extract<RichTextNode, { type: "reference" }>
  locale: string
  context: "admin" | "wiki"
  explicitColor?: string
  index: ReturnType<typeof createEntityIndex>
  icons: boolean
  resolveIcon?: EntityIconResolver
}) {
  const entity = node.entity
  const skill = skillReferenceContext(entity, locale, node.actualLocale)
  const kind = kindLabels[entity.kind] || kindLabels.term
  const color = explicitColor ?? entity.display?.color
  const validColor = typeof color === "string" && hexColor.test(color) ? color : defaultEntityColor(entity)
  const style: React.CSSProperties = {
    fontWeight: "inherit",
    fontStyle: "inherit",
    textAlign: "inherit",
    ...(validColor ? { color: validColor } : {}),
    ...(entity.display?.underline === false ? {} : { borderBottom: "1px dotted currentColor" }),
  }
  return (
    <EntityReferencePopover
      entity={entity}
      locale={locale}
      actualLocale={node.actualLocale}
      context={context}
      index={index}
      resolveIcon={resolveIcon}
      label={node.label}
    >
      <button
        type="button"
        aria-label={`${kind}: ${skill ? `${skill.ownerName} · ` : ""}${node.label}${skill?.detail ? ` · ${skill.detail}` : ""}`}
        className="inline-block max-w-full cursor-pointer rounded-sm align-baseline hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        style={style}
      >
        {icons && entity.display?.showIcon !== false && entity.kind !== "term" && (
          <EntityReferenceArtwork
            entity={entity}
            resolveIcon={resolveIcon}
            className={skill ? "mr-1.5 size-[1.25em]" : "mr-1 size-[1.1em]"}
          />
        )}
        {skill && (
          <>
            <span className="opacity-75">{skill.ownerName}</span>
            <span aria-hidden="true" className="mx-1 opacity-50">
              ›
            </span>
          </>
        )}
        {node.label}
      </button>
    </EntityReferencePopover>
  )
}

export function EntityRichText({
  text,
  entities = emptyEntities,
  index,
  locale,
  fallbackLocale = "vi-VN",
  autoRecognize = true,
  firstOccurrenceOnly = false,
  icons = true,
  resolveIcon,
  context,
  className,
}: EntityRichTextProps) {
  const resolvedIndex = React.useMemo(() => {
    const base = index ?? createEntityIndex(entities, locale, fallbackLocale)
    const countries = createEntityIndex(countryReferences, locale, fallbackLocale)
    return { ...base, byId: new Map([...countries.byId, ...base.byId]) }
  }, [index, entities, locale, fallbackLocale])
  const nodes = React.useMemo(
    () => parseRichText(text, resolvedIndex, { autoRecognize, firstOccurrenceOnly }),
    [text, resolvedIndex, autoRecognize, firstOccurrenceOnly],
  )
  const renderNodes = (items: RichTextNode[], explicitColor?: string): React.ReactNode =>
    items.map((node, position) => {
      if (node.type === "text") return <React.Fragment key={position}>{node.text}</React.Fragment>
      if (node.type === "strong") return <strong key={position}>{renderNodes(node.children, explicitColor)}</strong>
      if (node.type === "emphasis") return <em key={position}>{renderNodes(node.children, explicitColor)}</em>
      if (node.type === "color")
        return (
          <span key={position} style={hexColor.test(node.color) ? { color: node.color } : undefined}>
            {renderNodes(node.children, hexColor.test(node.color) ? node.color : explicitColor)}
          </span>
        )
      return (
        <EntityMention
          key={`${node.entity.id}-${position}`}
          node={node}
          locale={locale}
          context={context}
          explicitColor={explicitColor}
          index={resolvedIndex}
          icons={icons}
          resolveIcon={resolveIcon}
        />
      )
    })
  return (
    <span className={className} data-slot="entity-rich-text">
      {renderNodes(nodes)}
    </span>
  )
}
