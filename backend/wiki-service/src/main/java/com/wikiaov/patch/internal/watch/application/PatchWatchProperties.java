package com.wikiaov.patch.internal.watch.application;

import java.time.ZoneId;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Settings of the patch watch ({@code wiki.patch-watch}). How often each source is read is set in Admin.
 *
 * @param enabled       whether the schedule reads the sources; an editor's "check now" works either way. How often the
 *                      schedule looks for due sources is {@code wiki.patch-watch.tick-ms}.
 * @param zone          the zone of the daily reading times
 * @param userAgent     the User-Agent sent to the publishers
 * @param pageReaderUrl the headless browser of the server (infra/page-reader); empty where there is none, which
 *                      leaves the sources that need it unread
 */
@ConfigurationProperties("wiki.patch-watch")
public record PatchWatchProperties(
        @DefaultValue("false") boolean enabled,
        @DefaultValue("Asia/Ho_Chi_Minh") ZoneId zone,
        @DefaultValue("Mozilla/5.0 (compatible; aov-patch-watch/1.0)") String userAgent,
        @DefaultValue("") String pageReaderUrl
) {

    public boolean hasPageReader() {
        return !pageReaderUrl.isBlank();
    }
}
