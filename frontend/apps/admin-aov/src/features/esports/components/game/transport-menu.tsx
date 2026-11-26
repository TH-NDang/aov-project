import { Ellipsis, Gauge, Maximize, Minimize, SkipBack, SkipForward, Volume2, VolumeX, Youtube } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { formatClock } from "@/lib/clock"
import type { TransportProps } from "./transport"
import { usePlayheadValue } from "./use-playhead"
import { isSilent, otherSound, rateLabel, RATES } from "./use-video-settings"

export const YOUTUBE_ROW = "Hàng nút của YouTube"
export const YOUTUBE_ROW_WHY = `${YOUTUBE_ROW}: chất lượng hình, phụ đề. Khung video tải lại ở đúng giây này.`
export const youtubeLabel = (second: number) => `Mở trên YouTube lúc ${formatClock(second)}`

/** What a narrow row has no room for; the steps and the sound are in it only on the narrowest. */
export function TransportMenu(props: TransportProps & { steps: boolean }) {
  const { sound, rate, youtubeControls, fullscreen, onFullscreen } = props
  const second = usePlayheadValue(props.playhead, Math.floor)
  const silent = isSilent(sound)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="esp-transport-key" aria-label="Điều khiển khác" title="Điều khiển khác">
          <Ellipsis size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!props.steps && (
          <>
            <DropdownMenuItem onSelect={() => props.onStep(-1)}>
              <SkipBack /> Mốc trước
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => props.onStep(1)}>
              <SkipForward /> Mốc sau
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => props.onSound(otherSound(sound))}>
              {silent ? <VolumeX /> : <Volume2 />} {silent ? "Bật tiếng" : "Tắt tiếng"}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Gauge /> Tốc độ phát {rateLabel(rate)}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup value={String(rate)} onValueChange={(value) => props.onRate(Number(value))}>
                  {RATES.map((value) => (
                    <DropdownMenuRadioItem key={value} value={String(value)}>
                      {rateLabel(value)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
        <DropdownMenuCheckboxItem
          checked={youtubeControls}
          title={YOUTUBE_ROW_WHY}
          onCheckedChange={(checked) => props.onYoutubeControls(checked)}
        >
          {YOUTUBE_ROW}
        </DropdownMenuCheckboxItem>
        <DropdownMenuItem asChild>
          <a href={props.youtubeUrl(second)} target="_blank" rel="noreferrer">
            <Youtube /> {youtubeLabel(second)}
          </a>
        </DropdownMenuItem>
        {onFullscreen && (
          <DropdownMenuItem onSelect={onFullscreen}>
            {fullscreen ? <Minimize /> : <Maximize />} {fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
