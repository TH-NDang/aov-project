import { useLayoutEffect, useState, type RefObject } from "react"
import { routeItemWire, type CardRect, type selectedItemEdges } from "@aov/ui/lib/item-graph"
import type { ItemShopLayout } from "@aov/ui/lib/item-shop-layout"
import { warehouseName } from "@aov/ui/lib/warehouse-content"
import { useWarehouseText } from "../warehouse-view"
import { portInset, portRadius, type Entry } from "./shop-geometry"
import type { ShopConnections } from "./use-shop-connections"

type Edge = ReturnType<typeof selectedItemEdges>[number]
export type RecipeWire = { key: string; d: string; label: string; to: string; direct: boolean }

/**
 * The wires of the selected item's recipe, routed between the cards as the board lays them out, and measured again
 * when a card or the board changes size, or when the cards move.
 */
export function useRecipeWires({
  canvas,
  edges,
  byId,
  locale,
  placements,
  external,
  extraRows,
  onReset,
}: {
  canvas: RefObject<HTMLDivElement | null>
  edges: Edge[]
  byId: Map<string, Entry>
  locale: string
  placements: ItemShopLayout["placements"]
  external: ItemShopLayout["external"]
  extraRows: number
  /** Runs when the board is laid out again, which ends any link being dragged. */
  onReset: () => void
}) {
  const [paths, setPaths] = useState<RecipeWire[]>([])
  useLayoutEffect(() => {
    const element = canvas.current
    if (!element) return
    if (!edges.length) {
      setPaths((previous) => (previous.length ? [] : previous))
      return
    }
    let frame = 0
    let previousGeometry = ""
    function measure() {
      if (!element) return
      const bounds = element.getBoundingClientRect(),
        nodes = [...element.querySelectorAll<HTMLElement>("[data-item-node]")]
      const rect = (r: DOMRect): CardRect => ({
        left: r.left - bounds.left,
        right: r.right - bounds.left,
        top: r.top - bounds.top,
        bottom: r.bottom - bounds.top,
      })
      const rects = nodes.map((node) => rect(node.getBoundingClientRect()))
      const geometry = JSON.stringify(rects)
      if (geometry === previousGeometry) return
      previousGeometry = geometry
      const map = new Map<string, CardRect>()
      nodes.forEach((node, i) => {
        if (!map.has(node.dataset.itemNode!)) map.set(node.dataset.itemNode!, rects[i])
      })
      setPaths(
        edges.flatMap((edge, index) => {
          const source = map.get(edge.from),
            target = map.get(edge.to)
          if (!source || !target) return []
          const route = routeItemWire(source, target, rects, index)
          const points = route && [
            { x: source.right - portInset + portRadius, y: (source.top + source.bottom) / 2 },
            ...route,
            { x: target.left + portInset - portRadius, y: (target.top + target.bottom) / 2 },
          ]
          return points
            ? [
                {
                  key: `${edge.from}:${edge.to}`,
                  to: edge.to,
                  direct: edge.direct,
                  d: points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" "),
                  label: `${warehouseName(byId.get(edge.from)!, locale)} ×${edge.quantity} → ${warehouseName(byId.get(edge.to)!, locale)}`,
                },
              ]
            : []
        }),
      )
    }
    const resize = new ResizeObserver(() => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0
          measure()
        })
    })
    resize.observe(element)
    element.querySelectorAll("[data-item-node]").forEach((node) => resize.observe(node))
    measure()
    return () => {
      resize.disconnect()
      cancelAnimationFrame(frame)
      onReset()
    }
  }, [canvas, placements, external, edges, byId, locale, extraRows, onReset])
  return paths
}

/** The wires over the board, each one a button to the item it leads to, and the link being dragged. */
export function RecipeWires({
  paths,
  marker,
  preview,
  onFocus,
}: {
  paths: RecipeWire[]
  /** The id of the arrowhead, unique on the page. */
  marker: string
  preview: ShopConnections["preview"]
  onFocus: (id: string) => void
}) {
  const t = useWarehouseText()
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10 size-full"
      aria-label={t("Đường ghép của trang bị được chọn", "Recipe links of the selected item")}
    >
      <defs>
        <marker
          id={marker}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="10"
          markerHeight="10"
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path d="M0 0 L10 5 L0 10 Z" fill="context-stroke" />
        </marker>
      </defs>
      <g aria-hidden="true" fill="none" stroke="var(--background)" strokeWidth="7" strokeLinejoin="round">
        {paths.map((path) => (
          <path key={path.key} d={path.d} data-recipe-halo="" />
        ))}
      </g>
      {paths.map((path) => (
        <g key={path.key} className="text-primary" opacity={path.direct ? 1 : 0.65}>
          <path
            d={path.d}
            fill="none"
            stroke="currentColor"
            strokeWidth={path.direct ? 3.2 : 1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={path.direct ? undefined : "6 5"}
            markerEnd={`url(#${marker})`}
            data-recipe-line={path.direct ? "direct" : "indirect"}
          />
          <path
            d={path.d}
            fill="none"
            stroke="transparent"
            strokeWidth="12"
            className="pointer-events-auto cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label={path.label}
            onClick={() => onFocus(path.to)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onFocus(path.to)
              }
            }}
          >
            <title>{path.label}</title>
          </path>
        </g>
      ))}
      <g ref={preview.group} visibility="hidden" aria-hidden="true" className="text-primary">
        <path ref={preview.halo} fill="none" stroke="var(--background)" strokeWidth="7" />
        <path
          ref={preview.wire}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          markerEnd={`url(#${marker})`}
        />
        <circle ref={preview.tip} fill="var(--background)" stroke="currentColor" strokeWidth="2" />
      </g>
    </svg>
  )
}
