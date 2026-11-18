import { ChevronDown, Send } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { cn } from "@aov/ui/lib/utils"
import type { Content, Revision, Ruleset } from "../api/types"
import { HeroLanguageIcon, HeroLanguageItems } from "./hero-language-picker"

export const REVISION_STATES: Record<Revision["state"], string> = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã xuất bản",
  DISCARDED: "Đã hủy",
}

/**
 * The version of a hero as "#n" with the list of its versions. On a narrow header the menu also holds the reading
 * language and the main action, passed as `language` and `publish`.
 */
export function HeroVersionMenu({
  revision,
  revisions,
  rulesets,
  selectedId,
  busy,
  narrow,
  onChoose,
  language,
  publish,
}: {
  revision: Revision
  revisions: Revision[] | undefined
  rulesets: Ruleset[] | undefined
  selectedId: string
  busy: boolean
  narrow: boolean
  onChoose: (revisionId: string) => void
  language?: { content: Content; locale: string; disabled: boolean; onChange: (locale: string) => void }
  publish?: { publishing: boolean; onSelect: () => void }
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label="Phiên bản dữ liệu"
          title={`Phiên bản #${revision.revisionNo} · ${REVISION_STATES[revision.state]}`}
          data-revision={selectedId}
          disabled={busy}
          className={cn("h-8 shrink-0 bg-background font-normal", narrow ? "gap-1 px-2" : "gap-1.5 px-2.5")}
        >
          <span className="type-meta whitespace-nowrap tabular-nums">
            Bản {revision.revisionNo}
            {!narrow && ` · ${REVISION_STATES[revision.state]}`}
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="type-label">Phiên bản dữ liệu</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={selectedId} onValueChange={onChoose}>
          {(revisions ?? [revision]).map((row) => (
            <DropdownMenuRadioItem key={row.id} value={row.id}>
              #{row.revisionNo} · {REVISION_STATES[row.state]}
              {new Set(revisions?.map((item) => item.rulesetId)).size > 1
                ? ` · ${rulesets?.find((item) => item.id === row.rulesetId)?.code ?? "Bộ quy tắc khác"}`
                : ""}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {language && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger
                disabled={language.disabled}
                className="gap-2"
                aria-label="Ngôn ngữ hiển thị nội dung"
              >
                <HeroLanguageIcon locale={language.locale} />
                Ngôn ngữ
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-80 max-w-[calc(100vw-2rem)] rounded-xl p-1.5">
                <HeroLanguageItems content={language.content} locale={language.locale} onChange={language.onChange} />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
        {publish && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={busy} onSelect={publish.onSelect}>
              <Send />
              {publish.publishing ? "Đang xuất bản…" : "Xuất bản"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
