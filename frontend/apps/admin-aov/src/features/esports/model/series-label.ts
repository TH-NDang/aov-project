import { matchName, type SeriesContent } from "@aov/community-contracts"
import { localeText } from "@aov/ui/lib/locale-text"

/** What a series is called in Admin, which reads Vietnamese: the name an editor typed or its match's title. */
export const seriesLabel = (series: Pick<SeriesContent, "name" | "title">) => matchName(series, localeText("vi-VN"))
