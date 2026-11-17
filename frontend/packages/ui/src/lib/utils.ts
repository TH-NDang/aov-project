/**
 * The one import path of the class merger, for the library and the apps alike: the `cn` package, a drop-in for
 * `twMerge(clsx(...))`, so apps do not ship tailwind-merge as a second merger. components.json points generated
 * components here too.
 */
export { cn } from "cn"
export type { ClassValue } from "clsx"
