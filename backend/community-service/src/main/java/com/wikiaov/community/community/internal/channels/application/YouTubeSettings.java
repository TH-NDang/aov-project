package com.wikiaov.community.community.internal.channels.application;

import java.time.Duration;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * How the service reads YouTube channels (ADR-034).
 *
 * @param apiKey
 *            key of the YouTube Data API; without one only channels linked by id are shown, from their feed
 * @param apiUrl
 *            base URL of the Data API
 * @param feedUrl
 *            URL of the channel feed, which lists the 15 newest uploads
 * @param dailyUnits
 *            Data API units the service spends at most per day, below Google's free 10,000
 * @param channelTtl
 *            how long a channel's name, pictures and counts are kept
 * @param videosTtl
 *            how long a list of videos is kept
 */
@ConfigurationProperties("community.youtube")
public record YouTubeSettings(
        @Nullable String apiKey,
        String apiUrl,
        String feedUrl,
        int dailyUnits,
        Duration channelTtl,
        Duration videosTtl
) {
    public YouTubeSettings {
        if (apiUrl == null || apiUrl.isBlank() || feedUrl == null || feedUrl.isBlank()) {
            throw new IllegalArgumentException("YouTube needs the URLs of its Data API and of its feeds.");
        }
        if (dailyUnits < 0 || channelTtl == null || channelTtl.isNegative() || videosTtl == null
                || videosTtl.isNegative()) {
            throw new IllegalArgumentException("YouTube limits and lifetimes must not be negative.");
        }
        apiKey = apiKey == null || apiKey.isBlank() ? null : apiKey.strip();
    }

    public boolean dataApi() {
        return apiKey != null;
    }

    /** Never prints the key, so a log of the settings does not leak it. */
    @Override
    public String toString() {
        return "YouTubeSettings[dataApi=" + dataApi() + ", apiUrl=" + apiUrl + ", feedUrl=" + feedUrl
                + ", dailyUnits=" + dailyUnits + ", channelTtl=" + channelTtl + ", videosTtl=" + videosTtl + "]";
    }
}
