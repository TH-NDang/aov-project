package com.wikiaov.community.community.internal.channels.application;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** What readers get of a YouTube channel a page links to (03, ADR-034). */
public final class ChannelViews {
    private ChannelViews() {
    }

    /**
     * A channel with its newest uploads. {@code more} says whether older uploads can be asked for. Counts are absent
     * when the channel hides them or when only its feed could be read.
     */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Channel(
            String id,
            String title,
            @Nullable String handle,
            @Nullable String description,
            @Nullable String avatarUrl,
            @Nullable String bannerUrl,
            @Nullable Long subscriberCount,
            @Nullable Long videoCount,
            String url,
            List<Video> videos,
            boolean more
    ) {
        public Channel {
            videos = List.copyOf(videos);
        }
    }

    /**
     * An upload. {@code durationSeconds}, {@code viewCount} and {@code broadcast} come from the Data API and are absent
     * without it; {@code shortForm} is known only from the feed.
     */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Video(
            String id,
            String title,
            Instant publishedAt,
            @Nullable Integer durationSeconds,
            @Nullable Long viewCount,
            @Nullable Broadcast broadcast,
            boolean shortForm
    ) {
    }

    /** A live stream that is on, or one announced for later. */
    public enum Broadcast {
        LIVE,
        UPCOMING
    }

    /** Older uploads, newest first; {@code nextPageToken} asks for the ones after them. */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record VideoPage(
            List<Video> videos,
            @Nullable String nextPageToken
    ) {
        public VideoPage {
            videos = List.copyOf(videos);
        }
    }
}
