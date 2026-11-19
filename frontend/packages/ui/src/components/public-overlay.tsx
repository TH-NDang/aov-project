import { createContext, useContext, useState, type ComponentProps } from "react"
import { Slot } from "radix-ui"
import { Drawer as DrawerPrimitive } from "vaul"
import { cn } from "@aov/ui/lib/utils"
import { usePageLayout } from "../hooks/use-page-layout"
import * as DialogBase from "./dialog"
import * as PopoverBase from "./popover"
import * as MenuBase from "./dropdown-menu"
import { DrawerContent, DrawerHandle, DrawerTitle, DrawerClose, DrawerTrigger } from "./drawer"
import { useLocaleText } from "@aov/ui/hooks/use-locale-text"

/** These overlays sit under every app, so the close button takes the app's language instead of a prop. */
const useCloseLabel = () => useLocaleText()("Đóng", "Close")

const DrawerDepth = createContext(false)
const OverlayContext = createContext({ mobile: false, close: () => {} })

/**
 * The phone's bottom sheet. It closes by a tap on the dimmed page above it, by Escape, or by dragging it down from
 * anywhere once its content is scrolled to the top. Nested choices stay in the current drawer's focus and dismissal
 * stack.
 */
export function PublicDrawer(props: ComponentProps<typeof DrawerPrimitive.Root>) {
  const nested = useContext(DrawerDepth)
  const Root = nested ? DrawerPrimitive.NestedRoot : DrawerPrimitive.Root
  return (
    <DrawerDepth.Provider value={true}>
      <Root direction="bottom" shouldScaleBackground={false} autoFocus {...props} />
    </DrawerDepth.Provider>
  )
}

/** No visible close button: the sheet closes by a tap above it or a drag down; this one is for screen readers. */
function HiddenClose() {
  return <DrawerClose className="sr-only">{useCloseLabel()}</DrawerClose>
}

export function PublicDrawerContent({
  children,
  className,
  title,
  ...props
}: ComponentProps<typeof DrawerContent> & { title?: string }) {
  return (
    <DrawerContent
      {...props}
      className={cn(className, "public-bottom-drawer")}
      overlayClassName="public-bottom-overlay"
      handle={<DrawerHandle className="public-bottom-handle" preventCycle />}
    >
      {title && (
        <div className="public-bottom-heading">
          <DrawerTitle>{title}</DrawerTitle>
        </div>
      )}
      <HiddenClose />
      <div className="public-bottom-body">{children}</div>
    </DrawerContent>
  )
}

type RootProps = ComponentProps<typeof DialogBase.Dialog> & { mobileDrawer?: boolean }

function OverlayRoot({
  kind,
  mobileDrawer = true,
  open: controlled,
  defaultOpen = false,
  onOpenChange,
  ...props
}: RootProps & { kind: "dialog" | "popover" | "menu" }) {
  const isMobile = usePageLayout() === "compact"
  const mobile = mobileDrawer && isMobile
  const [localOpen, setLocalOpen] = useState(defaultOpen)
  const open = controlled ?? localOpen
  const change = (next: boolean) => {
    setLocalOpen(next)
    onOpenChange?.(next)
  }
  const Root = mobile
    ? PublicDrawer
    : kind === "dialog"
      ? DialogBase.Dialog
      : kind === "menu"
        ? MenuBase.DropdownMenu
        : PopoverBase.Popover
  return (
    <OverlayContext.Provider value={{ mobile, close: () => change(false) }}>
      <Root {...props} open={open} onOpenChange={change} {...(mobile ? { modal: true } : {})} />
    </OverlayContext.Provider>
  )
}

export function Dialog(props: RootProps) {
  return <OverlayRoot kind="dialog" {...props} />
}

export function Popover(props: RootProps) {
  return <OverlayRoot kind="popover" {...props} />
}

export function DropdownMenu(props: RootProps) {
  return <OverlayRoot kind="menu" {...props} />
}

export function DialogTrigger(props: ComponentProps<typeof DialogBase.DialogTrigger>) {
  const { mobile } = useContext(OverlayContext)
  const Trigger = mobile ? DrawerTrigger : DialogBase.DialogTrigger
  return <Trigger {...props} />
}

export function PopoverTrigger(props: ComponentProps<typeof PopoverBase.PopoverTrigger>) {
  const { mobile } = useContext(OverlayContext)
  const Trigger = mobile ? DrawerTrigger : PopoverBase.PopoverTrigger
  return <Trigger {...props} />
}

export function DropdownMenuTrigger(props: ComponentProps<typeof MenuBase.DropdownMenuTrigger>) {
  const { mobile } = useContext(OverlayContext)
  const Trigger = mobile ? DrawerTrigger : MenuBase.DropdownMenuTrigger
  return <Trigger {...props} />
}

export function DialogClose(props: ComponentProps<typeof DialogBase.DialogClose>) {
  const { mobile } = useContext(OverlayContext)
  const Close = mobile ? DrawerClose : DialogBase.DialogClose
  return <Close {...props} />
}

export function DialogTitle(props: ComponentProps<typeof DialogBase.DialogTitle>) {
  const { mobile } = useContext(OverlayContext)
  return mobile ? <DrawerPrimitive.Title data-slot="dialog-title" {...props} /> : <DialogBase.DialogTitle {...props} />
}

export function DialogDescription(props: ComponentProps<typeof DialogBase.DialogDescription>) {
  const { mobile } = useContext(OverlayContext)
  return mobile ? (
    <DrawerPrimitive.Description data-slot="dialog-description" {...props} />
  ) : (
    <DialogBase.DialogDescription {...props} />
  )
}

export function DialogContent({
  showCloseButton = true,
  children,
  ...props
}: ComponentProps<typeof DialogBase.DialogContent>) {
  const { mobile } = useContext(OverlayContext)
  if (!mobile)
    return (
      <DialogBase.DialogContent showCloseButton={showCloseButton} {...props}>
        {children}
      </DialogBase.DialogContent>
    )
  return <PublicDrawerContent {...props}>{children}</PublicDrawerContent>
}

export function PopoverContent({
  drawerTitle,
  children,
  ...props
}: ComponentProps<typeof PopoverBase.PopoverContent> & { drawerTitle: string }) {
  const { mobile } = useContext(OverlayContext)
  if (!mobile) return <PopoverBase.PopoverContent {...props}>{children}</PopoverBase.PopoverContent>
  const {
    align,
    alignOffset,
    side,
    sideOffset,
    collisionPadding,
    avoidCollisions,
    collisionBoundary,
    sticky,
    hideWhenDetached,
    updatePositionStrategy,
    onOpenAutoFocus,
    onPointerEnter,
    onPointerLeave,
    onFocusCapture,
    onBlurCapture,
    "aria-labelledby": labelledBy,
    ...contentProps
  } = props
  return (
    <PublicDrawerContent {...contentProps} title={drawerTitle} aria-describedby={undefined}>
      {children}
    </PublicDrawerContent>
  )
}

export function DropdownMenuContent({
  drawerTitle,
  children,
  ...props
}: ComponentProps<typeof MenuBase.DropdownMenuContent> & { drawerTitle: string }) {
  const { mobile } = useContext(OverlayContext)
  if (!mobile) return <MenuBase.DropdownMenuContent {...props}>{children}</MenuBase.DropdownMenuContent>
  const {
    align,
    alignOffset,
    side,
    sideOffset,
    collisionPadding,
    avoidCollisions,
    collisionBoundary,
    sticky,
    hideWhenDetached,
    loop,
    ...contentProps
  } = props
  return (
    <PublicDrawerContent {...contentProps} title={drawerTitle} aria-describedby={undefined}>
      <div className="public-bottom-menu">{children}</div>
    </PublicDrawerContent>
  )
}

/** A title at the top of a menu. A drawer already shows its `drawerTitle` in its heading, so it leaves this out. */
export function DropdownMenuTitle(props: ComponentProps<"div">) {
  const { mobile } = useContext(OverlayContext)
  return mobile ? null : <div {...props} />
}

export function DropdownMenuItem({
  asChild,
  onSelect,
  disabled,
  className,
  ...props
}: Pick<
  ComponentProps<typeof MenuBase.DropdownMenuItem>,
  "asChild" | "onSelect" | "disabled" | "className" | "children" | "variant"
>) {
  const { mobile, close } = useContext(OverlayContext)
  if (!mobile)
    return (
      <MenuBase.DropdownMenuItem
        asChild={asChild}
        onSelect={onSelect}
        disabled={disabled}
        className={className}
        {...props}
      />
    )
  const { variant, ...itemProps } = props
  const Item = asChild ? Slot.Root : "button"
  return (
    <Item
      {...itemProps}
      type={asChild ? undefined : "button"}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      data-variant={variant}
      className={cn(className, "public-bottom-menu-item")}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault()
          return
        }
        const selection = new Event("select", { cancelable: true })
        onSelect?.(selection)
        if (!selection.defaultPrevented) close()
      }}
    />
  )
}

export function DropdownMenuSeparator(props: ComponentProps<typeof MenuBase.DropdownMenuSeparator>) {
  const { mobile } = useContext(OverlayContext)
  return mobile ? <div role="separator" {...props} /> : <MenuBase.DropdownMenuSeparator {...props} />
}
