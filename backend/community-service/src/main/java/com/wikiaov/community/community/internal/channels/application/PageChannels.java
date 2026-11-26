package com.wikiaov.community.community.internal.channels.application;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.wikiaov.community.community.internal.channels.application.ChannelViews.Channel;
import com.wikiaov.community.community.internal.channels.application.ChannelViews.Video;
import com.wikiaov.community.community.internal.channels.application.ChannelViews.VideoPage;
import com.wikiaov.community.community.internal.channels.application.port.YouTubeSource;
import com.wikiaov.community.community.internal.channels.application.port.YouTubeSource.ChannelFacts;
import com.wikiaov.community.community.internal.channels.application.port.YouTubeSource.Unavailable;
import com.wikiaov.community.community.internal.channels.application.port.YouTubeSource.Upload;
import com.wikiaov.community.community.internal.channels.application.port.YouTubeSource.VideoFacts;
import com.wikiaov.community.community.internal.channels.domain.ChannelAddress;
import com.wikiaov.community.community.internal.pages.application.PageAccess;
import com.wikiaov.community.platform.ApiException;
import com.wikiaov.community.platform.ApiFieldError;
import com.wikiaov.community.platform.PlatformErrorCode;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * The YouTube channels pages link to, shown inside the site (ADR-034). Only a channel that a published page links to can
 * be read, so the quota is spent on the site's own channels. The newest uploads come from the free feed and are
 * completed by the Data API when it is on; older ones come from the Data API alone. Answers are kept in memory: a
 * channel's facts for a day, lists of videos for half an hour.
 */
@Service
public class PageChannels {
    /** Uploads in one page of older videos. */
    static final int PAGE_SIZE = 24;
    /** Uploads asked of the Data API when the feed cannot be read, as many as the feed lists. */
    static final int FEED_SIZE = 15;
    /** How long a request that failed waits before YouTube is asked again for it. */
    static final Duration FAILURE_PAUSE = Duration.ofMinutes(1);
    static final int MAX_URL = 2048;
    /** The longest page token the Data API hands out is far below this. */
    static final int MAX_PAGE_TOKEN = 200;
    private static final Logger LOG = LoggerFactory.getLogger(PageChannels.class);
    private final PageAccess access;
    private final YouTubeSource source;
    private final YouTubeBudget budget;
    private final Cache<String, Optional<ChannelFacts>> channels;
    private final Cache<String, Newest> newest;
    private final Cache<String, VideoPage> pages;
    private final Cache<String, Boolean> failures;

    PageChannels(PageAccess access, YouTubeSource source, YouTubeBudget budget, YouTubeSettings settings) {
        this.access = access;
        this.source = source;
        this.budget = budget;
        this.channels = Caffeine.newBuilder().expireAfterWrite(settings.channelTtl()).maximumSize(2_000).build();
        this.newest = Caffeine.newBuilder().expireAfterWrite(settings.videosTtl()).maximumSize(2_000).build();
        this.pages = Caffeine.newBuilder().expireAfterWrite(settings.videosTtl()).maximumSize(5_000).build();
        this.failures = Caffeine.newBuilder().expireAfterWrite(FAILURE_PAUSE).maximumSize(5_000).build();
    }

    /** The channel behind one of the page's links, with its newest uploads. */
    public Channel channel(UUID pageId, String url) {
        var address = linked(pageId, url);
        var facts = facts(address);
        var id = facts.map(ChannelFacts::id).orElse(address.value());
        var latest = newest(id);

        var shown = facts.orElse(null);
        var title = shown != null ? shown.title() : latest.title();
        boolean more = source.dataApi() && !latest.videos().isEmpty()
                && (shown == null || shown.videoCount() == null || shown.videoCount() > latest.videos().size());
        return new Channel(id, title == null || title.isBlank() ? address.value() : title,
                shown == null ? null : shown.handle(), shown == null ? null : shown.description(),
                shown == null ? null : shown.avatarUrl(), shown == null ? null : shown.bannerUrl(),
                shown == null ? null : shown.subscriberCount(), shown == null ? null : shown.videoCount(),
                "https://www.youtube.com/channel/" + id, latest.videos(), more);
    }

    /** Older uploads of the channel, from the start of its list when no token is given. */
    public VideoPage videos(UUID pageId, String url, @Nullable String pageToken) {
        if (pageToken != null && (pageToken.length() > MAX_PAGE_TOKEN || !pageToken.matches("[\\w-]*"))) {
            throw invalid("pageToken", "The page token is not one the service handed out.");
        }
        var address = linked(pageId, url);
        if (!source.dataApi()) {
            throw unavailable("Older videos need the YouTube Data API, which is off.");
        }
        var id = facts(address).map(ChannelFacts::id).orElse(address.value());
        var token = pageToken == null || pageToken.isEmpty() ? null : pageToken;

        return cached("pages", pages, id + "|" + (token == null ? "" : token), () -> {
            var page = api(() -> source.uploads(id, token, PAGE_SIZE));
            return page.map(found -> new VideoPage(completed(found.uploads()), found.nextPageToken()))
                    .orElseGet(() -> new VideoPage(List.of(), null));
        });
    }

    /** The address of a YouTube channel the published page links to; anything else is not found. */
    private ChannelAddress linked(UUID pageId, String url) {
        if (url == null || url.isBlank() || url.length() > MAX_URL) {
            throw invalid("url", "The channel link is missing or too long.");
        }
        var page = access.published(pageId);
        var content = page.getPublishedContent();
        if (PageAccess.community(page)) {
            content = content.present(page.getPresentation());
        }

        boolean linked = content.links().stream().anyMatch(link -> url.equals(link.url()));
        return Optional.of(linked).filter(Boolean::booleanValue).flatMap(yes -> ChannelAddress.of(url))
                .orElseThrow(() -> new ApiException(ChannelErrorCode.CHANNEL_NOT_FOUND,
                        "The page does not link to this YouTube channel."));
    }

    /**
     * The channel's name, pictures and counts from the Data API. A channel linked by its id can do without them and
     * is then shown from its feed; one linked by a handle cannot be found otherwise.
     */
    private Optional<ChannelFacts> facts(ChannelAddress address) {
        boolean byId = address.kind() == ChannelAddress.Kind.ID;
        if (!source.dataApi()) {
            if (byId) {
                return Optional.empty();
            }
            throw unavailable("A channel linked by its handle needs the YouTube Data API, which is off.");
        }

        Optional<ChannelFacts> facts;
        try {
            facts = cached("channels", channels, address.key(), () -> api(() -> source.channel(address)));
        } catch (ApiException failure) {
            if (byId && failure.getErrorCode() == ChannelErrorCode.CHANNEL_UNAVAILABLE) {
                return Optional.empty();
            }
            throw failure;
        }
        if (facts.isEmpty()) {
            throw new ApiException(ChannelErrorCode.CHANNEL_NOT_FOUND, "YouTube has no channel at this link.");
        }
        return facts;
    }

    /** The newest uploads: the feed, or the start of the uploads list when the feed cannot be read. */
    private Newest newest(String channelId) {
        return cached("newest", newest, channelId, () -> {
            Optional<YouTubeSource.Feed> feed;
            try {
                feed = source.feed(channelId);
            } catch (Unavailable failure) {
                if (!source.dataApi()) {
                    throw failure;
                }
                LOG.warn("YouTube feed of {} could not be read, using the Data API: {}", channelId,
                        failure.getMessage());
                feed = Optional.empty();
            }
            if (feed.isPresent()) {
                return new Newest(feed.get().title(), completed(feed.get().uploads()));
            }
            if (!source.dataApi()) {
                return new Newest(null, List.of());
            }

            var page = api(() -> source.uploads(channelId, null, FEED_SIZE));
            return new Newest(null, page.map(found -> completed(found.uploads())).orElse(List.of()));
        });
    }

    /**
     * Adds what only the Data API knows: length, views and whether a stream is on. When the call succeeds, uploads it
     * does not return are no longer public and are left out; when it cannot be made, the uploads are shown as they are.
     */
    private List<Video> completed(List<Upload> uploads) {
        if (uploads.isEmpty() || !source.dataApi() || !budget.spend()) {
            return uploads.stream().map(upload -> video(upload, null)).toList();
        }

        Map<String, VideoFacts> facts;
        try {
            facts = source.videos(uploads.stream().map(Upload::id).toList()).stream()
                    .collect(Collectors.toMap(VideoFacts::id, Function.identity(), (first, second) -> first));
        } catch (Unavailable failure) {
            noted(failure);
            return uploads.stream().map(upload -> video(upload, null)).toList();
        }
        return uploads.stream().filter(upload -> facts.containsKey(upload.id()))
                .map(upload -> video(upload, facts.get(upload.id()))).toList();
    }

    private static Video video(Upload upload, @Nullable VideoFacts facts) {
        if (facts == null) {
            return new Video(upload.id(), upload.title(), upload.publishedAt(), null, upload.viewCount(), null,
                    upload.shortForm());
        }
        return new Video(upload.id(), facts.title().isBlank() ? upload.title() : facts.title(), upload.publishedAt(),
                facts.durationSeconds(), facts.viewCount() != null ? facts.viewCount() : upload.viewCount(),
                facts.broadcast(), upload.shortForm());
    }

    /** One Data API call, when a unit is left today. */
    private <T> T api(Supplier<T> call) {
        if (!budget.spend()) {
            throw new Unavailable("Today's share of the YouTube Data API quota is spent.", false, null);
        }
        return call.get();
    }

    /**
     * The kept answer, or a new one. A request that failed is not asked again for {@link #FAILURE_PAUSE}, so YouTube
     * being down does not turn every page view into a call.
     */
    private <T> T cached(String name, Cache<String, T> cache, String key, Supplier<T> load) {
        var kept = cache.getIfPresent(key);
        if (kept != null) {
            return kept;
        }
        var failureKey = name + "|" + key;
        if (failures.getIfPresent(failureKey) != null) {
            throw unavailable("YouTube could not be read a moment ago.");
        }

        try {
            return cache.get(key, ignored -> load.get());
        } catch (Unavailable failure) {
            failures.put(failureKey, true);
            noted(failure);
            throw unavailable("YouTube cannot be read now.");
        }
    }

    private void noted(Unavailable failure) {
        if (failure.quota()) {
            budget.exhaust();
        }
        LOG.warn("YouTube could not be read: {}", failure.getMessage());
    }

    private static ApiException unavailable(String detail) {
        return new ApiException(ChannelErrorCode.CHANNEL_UNAVAILABLE, detail);
    }

    private static ApiException invalid(String parameter, String detail) {
        return new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER, detail,
                List.of(new ApiFieldError(parameter, "INVALID_VALUE", "Invalid value.")));
    }

    /** The newest uploads of a channel, with the title its feed gives when the Data API gave none. */
    private record Newest(
            @Nullable String title,
            List<Video> videos
    ) {
    }
}
