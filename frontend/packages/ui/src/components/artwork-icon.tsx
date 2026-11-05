import * as React from "react"

type ArtworkIconProps = React.SVGProps<SVGSVGElement> & { size?: number | string }

export function createArtworkIcon(artwork: string, symbol: string) {
  return function ArtworkIcon({ size = 24, ...props }: ArtworkIconProps) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false" {...props}>
        <use href={`${artwork}#${symbol}`} />
      </svg>
    )
  }
}
