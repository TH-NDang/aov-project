package com.wikiaov.community.community.internal.channels.domain;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * The YouTube channel a page's link points to: by its id ({@code /channel/UC…}), its handle ({@code /@name}, and the
 * older {@code /c/name} or {@code /name} addresses, which mostly match the handle) or its legacy user name
 * ({@code /user/name}). A link to a video, a playlist or another site names no channel.
 */
public record ChannelAddress(
        Kind kind,
        String value
) {
    public enum Kind {
        ID,
        HANDLE,
        USERNAME
    }

    private static final Pattern CHANNEL_ID = Pattern.compile("UC[\\w-]{22}");
    /** Handles take letters of any script, digits, underscores, hyphens and periods, 3 to 30 of them. */
    private static final Pattern NAME = Pattern.compile("[\\p{L}\\p{M}\\p{N}_.\\-]{3,30}");
    private static final Set<String> HOSTS = Set.of("youtube.com", "www.youtube.com", "m.youtube.com");
    /** First path segments that are YouTube's own pages, never a channel's old vanity address. */
    private static final Set<String> RESERVED = Set.of("watch", "shorts", "live", "embed", "playlist", "results",
            "feed", "redirect", "hashtag", "post", "v", "t", "gaming", "premium", "music", "kids", "account", "signin",
            "logout", "about", "channel", "c", "user", "attribution_link", "source", "sounds", "trending", "upload");

    public ChannelAddress {
        if (kind == null || value == null || value.isBlank()) {
            throw new IllegalArgumentException("A channel address needs a kind and a value.");
        }
    }

    /** The channel a link names, or empty when the link is not one of a YouTube channel. */
    public static Optional<ChannelAddress> of(String url) {
        if (url == null || url.isBlank()) {
            return Optional.empty();
        }
        URI uri;
        try {
            uri = new URI(url.strip());
        } catch (URISyntaxException failure) {
            return Optional.empty();
        }
        var scheme = uri.getScheme();
        var host = uri.getHost();
        if (scheme == null || !Set.of("http", "https").contains(scheme.toLowerCase(Locale.ROOT)) || host == null
                || !HOSTS.contains(host.toLowerCase(Locale.ROOT)) || uri.getPath() == null) {
            return Optional.empty();
        }

        var segments = Arrays.stream(uri.getPath().split("/")).filter(segment -> !segment.isEmpty()).toList();
        if (segments.isEmpty()) {
            return Optional.empty();
        }
        var first = segments.getFirst();
        var second = segments.size() > 1 ? segments.get(1) : null;
        if (first.startsWith("@")) {
            return named(Kind.HANDLE, first.substring(1));
        }
        if (first.equals("channel")) {
            return second != null && CHANNEL_ID.matcher(second).matches()
                    ? Optional.of(new ChannelAddress(Kind.ID, second))
                    : Optional.empty();
        }
        if (first.equals("user")) {
            return second == null ? Optional.empty() : named(Kind.USERNAME, second);
        }
        if (first.equals("c")) {
            return second == null ? Optional.empty() : named(Kind.HANDLE, second);
        }
        return RESERVED.contains(first.toLowerCase(Locale.ROOT)) ? Optional.empty() : named(Kind.HANDLE, first);
    }

    private static Optional<ChannelAddress> named(Kind kind, String name) {
        return NAME.matcher(name).matches() ? Optional.of(new ChannelAddress(kind, name)) : Optional.empty();
    }

    /** Handles and user names are case-insensitive on YouTube, so one channel keeps one key in a cache. */
    public String key() {
        return kind.name() + ":" + (kind == Kind.ID ? value : value.toLowerCase(Locale.ROOT));
    }
}
