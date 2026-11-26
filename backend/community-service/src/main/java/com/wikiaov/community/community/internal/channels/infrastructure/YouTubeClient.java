package com.wikiaov.community.community.internal.channels.infrastructure;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.wikiaov.community.community.internal.channels.application.ChannelViews.Broadcast;
import com.wikiaov.community.community.internal.channels.application.YouTubeSettings;
import com.wikiaov.community.community.internal.channels.application.port.YouTubeSource;
import com.wikiaov.community.community.internal.channels.domain.ChannelAddress;
import java.net.http.HttpClient;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import javax.xml.stream.XMLStreamException;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

/**
 * YouTube over HTTP: the Data API v3 and the channel feed. The key travels in the {@code X-Goog-Api-Key} header, never
 * in the address, so no error message or access log can show it.
 */
@Component
class YouTubeClient implements YouTubeSource {
    /** The crop YouTube itself uses for a channel's banner on wide screens. */
    private static final String BANNER_CROP = "=w1280-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj";
    private static final int MAX_DESCRIPTION = 1000;
    private static final Pattern REASON = Pattern.compile("\"reason\"\\s*:\\s*\"([^\"]+)\"");
    private static final List<String> QUOTA_REASONS = List.of("quotaExceeded", "dailyLimitExceeded",
            "rateLimitExceeded");
    private final RestClient api;
    private final RestClient feeds;
    private final boolean dataApi;

    YouTubeClient(YouTubeSettings settings) {
        var factory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build());
        factory.setReadTimeout(Duration.ofSeconds(8));
        var apiClient = RestClient.builder().baseUrl(settings.apiUrl()).requestFactory(factory)
                .defaultHeader("User-Agent", "aov-community-service");
        if (settings.apiKey() != null) {
            apiClient.defaultHeader("X-Goog-Api-Key", settings.apiKey());
        }
        api = apiClient.build();
        feeds = RestClient.builder().baseUrl(settings.feedUrl()).requestFactory(factory)
                .defaultHeader("User-Agent", "aov-community-service").build();
        dataApi = settings.dataApi();
    }

    @Override
    public boolean dataApi() {
        return dataApi;
    }

    @Override
    public Optional<ChannelFacts> channel(ChannelAddress address) {
        var parameter = switch (address.kind()) {
            case ID -> "id";
            case HANDLE -> "forHandle";
            case USERNAME -> "forUsername";
        };
        ChannelList list;
        try {
            list = call("YouTube channels", () -> api.get()
                    .uri(uri -> uri.path("/channels").queryParam("part", "snippet,statistics,brandingSettings")
                            .queryParam(parameter, address.value()).build())
                    .retrieve().body(ChannelList.class));
        } catch (Missing missing) {
            return Optional.empty();
        }
        return items(list == null ? null : list.items()).filter(item -> item.id() != null && item.snippet() != null)
                .findFirst().map(YouTubeClient::facts);
    }

    @Override
    public Optional<Feed> feed(String channelId) {
        byte[] document;
        try {
            document = call("YouTube feed",
                    () -> feeds.get().uri(uri -> uri.queryParam("channel_id", channelId).build())
                            .retrieve().body(byte[].class));
        } catch (Missing missing) {
            return Optional.empty();
        }
        if (document == null || document.length == 0) {
            return Optional.empty();
        }
        try {
            return Optional.of(YouTubeFeedReader.read(document));
        } catch (XMLStreamException failure) {
            throw new Unavailable("YouTube feed of " + channelId + " could not be read as XML", false, failure);
        }
    }

    @Override
    public Optional<UploadPage> uploads(String channelId, @Nullable String pageToken, int size) {
        var playlist = "UU" + channelId.substring(2);
        PlaylistItems page;
        try {
            page = call("YouTube uploads", () -> api.get().uri(uri -> {
                uri.path("/playlistItems").queryParam("part", "snippet,contentDetails,status")
                        .queryParam("playlistId", playlist).queryParam("maxResults", size);
                if (pageToken != null) {
                    uri.queryParam("pageToken", pageToken);
                }
                return uri.build();
            }).retrieve().body(PlaylistItems.class));
        } catch (Missing missing) {
            return Optional.empty();
        }
        if (page == null) {
            return Optional.empty();
        }

        var uploads = items(page.items()).map(YouTubeClient::upload).flatMap(Optional::stream).toList();
        var next = page.nextPageToken() == null || page.nextPageToken().isBlank() ? null : page.nextPageToken();
        return Optional.of(new UploadPage(uploads, next));
    }

    @Override
    public List<VideoFacts> videos(Collection<String> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        var joined = String.join(",", ids.stream().limit(50).toList());
        VideoList list;
        try {
            list = call("YouTube videos", () -> api.get()
                    .uri(uri -> uri.path("/videos").queryParam("part", "snippet,contentDetails,statistics")
                            .queryParam("id", joined).queryParam("maxResults", 50).build())
                    .retrieve().body(VideoList.class));
        } catch (Missing missing) {
            return List.of();
        }
        return items(list == null ? null : list.items()).map(YouTubeClient::video).flatMap(Optional::stream)
                .toList();
    }

    private static ChannelFacts facts(ChannelItem item) {
        var snippet = item.snippet();
        var statistics = item.statistics();
        var handle = snippet.customUrl() == null || snippet.customUrl().isBlank()
                ? null
                : snippet.customUrl().startsWith("@") ? snippet.customUrl() : "@" + snippet.customUrl();
        var description = snippet.description() == null ? null : snippet.description().strip();
        if (description != null && description.length() > MAX_DESCRIPTION) {
            description = description.substring(0, MAX_DESCRIPTION).strip() + "…";
        }
        var thumbnails = snippet.thumbnails();
        var avatar = thumbnails == null
                ? null
                : Stream.of(thumbnails.medium(), thumbnails.high(), thumbnails.standard()).filter(Objects::nonNull)
                        .map(Thumbnail::url).filter(YouTubeClient::secure).findFirst().orElse(null);
        var banner = item.brandingSettings() == null || item.brandingSettings().image() == null
                ? null
                : item.brandingSettings().image().bannerExternalUrl();
        boolean hidden = statistics != null && Boolean.TRUE.equals(statistics.hiddenSubscriberCount());

        return new ChannelFacts(item.id(), snippet.title() == null ? "" : snippet.title().strip(), handle,
                description == null || description.isEmpty() ? null : description, avatar,
                secure(banner) ? banner + BANNER_CROP : null,
                statistics == null || hidden ? null : YouTubeFeedReader.count(statistics.subscriberCount()),
                statistics == null ? null : YouTubeFeedReader.count(statistics.videoCount()));
    }

    private static Optional<Upload> upload(PlaylistItem item) {
        var details = item.contentDetails();
        if (details == null || details.videoId() == null || details.videoPublishedAt() == null) {
            return Optional.empty();
        }
        if (item.status() != null && !"public".equals(item.status().privacyStatus())) {
            return Optional.empty();
        }
        var title = item.snippet() == null || item.snippet().title() == null ? "" : item.snippet().title().strip();
        return instant(details.videoPublishedAt())
                .map(at -> new Upload(details.videoId(), title, at, null, false));
    }

    private static Optional<VideoFacts> video(VideoItem item) {
        if (item.id() == null || item.snippet() == null) {
            return Optional.empty();
        }
        var snippet = item.snippet();
        var broadcast = switch (snippet.liveBroadcastContent() == null ? "" : snippet.liveBroadcastContent()) {
            case "live" -> Broadcast.LIVE;
            case "upcoming" -> Broadcast.UPCOMING;
            default -> null;
        };
        var published = instant(snippet.publishedAt()).orElse(Instant.EPOCH);
        return Optional.of(new VideoFacts(item.id(), snippet.title() == null ? "" : snippet.title().strip(),
                published, seconds(item.contentDetails() == null ? null : item.contentDetails().duration()),
                item.statistics() == null ? null : YouTubeFeedReader.count(item.statistics().viewCount()),
                broadcast));
    }

    /** An ISO 8601 length such as {@code PT1H2M3S}; a stream that has not ended has {@code P0D}, which is none. */
    static @Nullable Integer seconds(@Nullable String duration) {
        if (duration == null || duration.isBlank()) {
            return null;
        }
        try {
            long seconds = Duration.parse(duration).toSeconds();
            return seconds <= 0 || seconds > Integer.MAX_VALUE ? null : (int) seconds;
        } catch (DateTimeException failure) {
            return null;
        }
    }

    private static Optional<Instant> instant(@Nullable String value) {
        if (value == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(OffsetDateTime.parse(value).toInstant());
        } catch (DateTimeException failure) {
            return Optional.empty();
        }
    }

    private static boolean secure(@Nullable String url) {
        return url != null && url.startsWith("https://");
    }

    private static <T> Stream<T> items(@Nullable List<T> items) {
        return items == null ? Stream.empty() : items.stream().filter(Objects::nonNull);
    }

    /**
     * One request. A 404 is {@link Missing}; any other failure is {@link Unavailable}, marked as a quota refusal when
     * Google says so.
     */
    private static <T> T call(String what, Supplier<T> request) {
        try {
            return request.get();
        } catch (RestClientResponseException failure) {
            if (failure.getStatusCode().value() == HttpStatus.NOT_FOUND.value()) {
                throw new Missing();
            }
            var matcher = REASON.matcher(failure.getResponseBodyAsString());
            var reason = matcher.find() ? matcher.group(1) : "";
            throw new Unavailable(what + " answered " + failure.getStatusCode().value()
                    + (reason.isEmpty() ? "" : " (" + reason + ")"), QUOTA_REASONS.contains(reason), null);
        } catch (ResourceAccessException failure) {
            throw new Unavailable(what + " could not be reached", false, null);
        } catch (RestClientException failure) {
            throw new Unavailable(what + " answered something unreadable", false, null);
        }
    }

    /** YouTube answered 404: the channel, its feed or its uploads list does not exist. */
    private static final class Missing extends RuntimeException {
        Missing() {
            super(null, null, false, false);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ChannelList(
            List<ChannelItem> items
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ChannelItem(
            String id,
            ChannelSnippet snippet,
            ChannelStatistics statistics,
            Branding brandingSettings
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ChannelSnippet(
            String title,
            String description,
            String customUrl,
            Thumbnails thumbnails
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Thumbnails(
            Thumbnail medium,
            Thumbnail high,
            @JsonProperty("default") Thumbnail standard
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Thumbnail(
            String url
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ChannelStatistics(
            String subscriberCount,
            Boolean hiddenSubscriberCount,
            String videoCount
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Branding(
            BrandingImage image
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record BrandingImage(
            String bannerExternalUrl
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record PlaylistItems(
            List<PlaylistItem> items,
            String nextPageToken
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record PlaylistItem(
            PlaylistSnippet snippet,
            PlaylistDetails contentDetails,
            PlaylistStatus status
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record PlaylistSnippet(
            String title
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record PlaylistDetails(
            String videoId,
            String videoPublishedAt
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record PlaylistStatus(
            String privacyStatus
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record VideoList(
            List<VideoItem> items
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record VideoItem(
            String id,
            VideoSnippet snippet,
            VideoDetails contentDetails,
            VideoStatistics statistics
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record VideoSnippet(
            String title,
            String publishedAt,
            String liveBroadcastContent
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record VideoDetails(
            String duration
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record VideoStatistics(
            String viewCount
    ) {
    }
}
