import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react"
import { Check, ChevronDown } from "lucide-react"
import { RadioGroup } from "radix-ui"
import { usePageLayout } from "../hooks/use-page-layout"
import { cn } from "@aov/ui/lib/utils"
import * as SelectBase from "./select"
import { DrawerTrigger } from "./drawer"
import { PublicDrawer, PublicDrawerContent } from "./public-overlay"

const SelectContext = createContext({
  mobile: false,
  value: "",
  disabled: false,
  labels: new Map<string, ReactNode>(),
  select: (_value: string) => {},
  close: () => {},
})

function collectLabels(children: ReactNode, labels = new Map<string, ReactNode>()) {
  Children.forEach(children, (child) => {
    if (!isValidElement<{ children?: ReactNode; value?: string }>(child)) return
    if (child.type === SelectItem && child.props.value) labels.set(child.props.value, child.props.children)
    else if (child.props.children) collectLabels(child.props.children, labels)
  })
  return labels
}

export function Select({ children, ...props }: ComponentProps<typeof SelectBase.Select>) {
  const mobile = usePageLayout() === "compact"
  const [localOpen, setOpen] = useState(props.defaultOpen ?? false)
  const [localValue, setValue] = useState(props.defaultValue ?? "")
  const value = props.value ?? localValue
  const changeOpen = (open: boolean) => {
    setOpen(open)
    props.onOpenChange?.(open)
  }
  const select = (next: string) => {
    setValue(next)
    props.onValueChange?.(next)
    changeOpen(false)
  }
  return (
    <SelectContext.Provider
      value={{
        mobile,
        value,
        disabled: !!props.disabled,
        labels: collectLabels(children),
        select,
        close: () => changeOpen(false),
      }}
    >
      {mobile ? (
        <PublicDrawer open={props.open ?? localOpen} onOpenChange={changeOpen}>
          {children}
          {props.name && <input type="hidden" name={props.name} value={value} disabled={props.disabled} />}
        </PublicDrawer>
      ) : (
        <SelectBase.Select {...props}>{children}</SelectBase.Select>
      )}
    </SelectContext.Provider>
  )
}

export function SelectTrigger({
  children,
  className,
  size,
  disabled,
  ...props
}: ComponentProps<typeof SelectBase.SelectTrigger>) {
  const context = useContext(SelectContext)
  if (!context.mobile)
    return (
      <SelectBase.SelectTrigger className={className} size={size} disabled={disabled} {...props}>
        {children}
      </SelectBase.SelectTrigger>
    )
  return (
    <DrawerTrigger
      {...props}
      data-slot="select-trigger"
      disabled={disabled || context.disabled}
      className={cn("flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm", className)}
    >
      {children}
      <ChevronDown size={14} aria-hidden="true" />
    </DrawerTrigger>
  )
}

export function SelectValue({ children, placeholder, ...props }: ComponentProps<typeof SelectBase.SelectValue>) {
  const context = useContext(SelectContext)
  if (!context.mobile)
    return (
      <SelectBase.SelectValue placeholder={placeholder} {...props}>
        {children}
      </SelectBase.SelectValue>
    )
  return (
    <span data-slot="select-value" {...props}>
      {children ?? context.labels.get(context.value) ?? placeholder}
    </span>
  )
}

export function SelectContent({
  drawerTitle,
  children,
  className,
  ...props
}: ComponentProps<typeof SelectBase.SelectContent> & { drawerTitle: string }) {
  const context = useContext(SelectContext)
  if (!context.mobile)
    return (
      <SelectBase.SelectContent className={className} {...props}>
        {children}
      </SelectBase.SelectContent>
    )
  return (
    <PublicDrawerContent className={className} title={drawerTitle} aria-describedby={undefined}>
      <RadioGroup.Root
        value={context.value}
        onValueChange={context.select}
        aria-label={drawerTitle}
        className="public-bottom-menu"
      >
        {children}
      </RadioGroup.Root>
    </PublicDrawerContent>
  )
}

export function SelectItem({
  children,
  className,
  ...props
}: Pick<ComponentProps<typeof SelectBase.SelectItem>, "value" | "children" | "className" | "disabled" | "textValue">) {
  const context = useContext(SelectContext)
  if (!context.mobile)
    return (
      <SelectBase.SelectItem className={className} {...props}>
        {children}
      </SelectBase.SelectItem>
    )
  const { textValue, ...itemProps } = props
  return (
    <RadioGroup.Item
      {...itemProps}
      className={cn(className, "public-bottom-menu-item public-bottom-choice")}
      onClick={() => {
        if (context.value === props.value) context.close()
      }}
    >
      <span>{children}</span>
      {context.value === props.value && <Check size={16} aria-hidden="true" />}
    </RadioGroup.Item>
  )
}
