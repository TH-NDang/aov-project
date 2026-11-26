package com.wikiaov.community.community.internal.channels.application.port;

import com.wikiaov.community.community.internal.channels.application.ChannelViews.Broadcast;
import com.wikiaov.community.community.internal.channels.domain.ChannelAddress;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.jspecify.annotations.Nullable;

/**
 * Reads YouTube: the Data API, which costs one unit of the daily quota per call, and the free channel feed. Every
 * method throws {@link Unavailable} when YouTube cannot be read now.
 */
public interface YouTubeSource {
    /** Whether the Data API can be called at all, that is, a key is configured. */
    boolean dataApi();

    /** The channel an address names; empty when no channel has it. One unit. */
    Optional<ChannelFacts> channel(ChannelAddress address);

    /** The newest uploads from the channel's feed; empty when the channel has no feed. Free. */
    Optional<Feed> feed(String channelId);

    /** A page of the channel's uploads, newest first; empty when the channel has no uploads list. One unit. */
    Optional<UploadPage> uploads(String channelId, @Nullable String pageToken, int size);

    /** The public videos among these ids (at most 50); private and removed ones are left out. One unit. */
    List<VideoFacts> videos(Collection<String> ids);

    record ChannelFacts(
            String id,
            String title,
            @Nullable String handle,
            @Nullable String description,
            @Nullable String avatarUrl,
            @Nullable String bannerUrl,
            @Nullable Long subscriberCount,
            @Nullable Long videoCount
    ) {
    }

    /** The channel's title as its feed gives it, with the uploads the feed lists. */
    record Feed(
            String title,
            List<Upload> uploads
    ) {
        public Feed {
            uploads = List.copyOf(uploads);
        }
    }

    /** A public upload; the feed also gives its views and whether it is a short, the uploads list neither. */
    record Upload(
            String id,
            String title,
            Instant publishedAt,
            @Nullable Long viewCount,
            boolean shortForm
    ) {
    }

    record UploadPage(
            List<Upload> uploads,
            @Nullable String nextPageToken
    ) {
        public UploadPage {
            uploads = List.copyOf(uploads);
        }
    }

    record VideoFacts(
            String id,
            String title,
            Instant publishedAt,
            @Nullable Integer durationSeconds,
            @Nullable Long viewCount,
            @Nullable Broadcast broadcast
    ) {
    }

    /** YouTube did not answer, answered with an error, or refused because today's quota is spent. */
    class Unavailable extends RuntimeException {
        private final boolean quota;

        public Unavailable(String message, boolean quota, @Nullable Throwable cause) {
            super(message, cause);
            this.quota = quota;
        }

        /** Google refused for the quota: no further Data API call succeeds before its day ends. */
        public boolean quota() {
            return quota;
        }
    }
}
