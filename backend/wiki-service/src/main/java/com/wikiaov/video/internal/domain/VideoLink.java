package com.wikiaov.video.internal.domain;

import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * A pasted video link in canonical form. Every YouTube link form becomes one watch URL, so the same video pasted as
 * {@code youtu.be} and {@code watch?v=} counts as a duplicate. Other links are kept as written.
 *
 * @param providerVideoId YouTube video id when the link points at one video, otherwise null
 * @param startSeconds    start point read from the link, 0 when it has none
 */
public record VideoLink(
        String url,
        VideoProvider provider,
        String providerVideoId,
        int startSeconds
) {
    public static final int MAX_URL_LENGTH = 2048;

    private static final Set<String> YOUTUBE_HOSTS = Set.of("youtube.com", "youtu.be", "youtube-nocookie.com");
    private static final Set<String> YOUTUBE_PATHS = Set.of("embed", "shorts", "live", "v");
    private static final Pattern YOUTUBE_ID = Pattern.compile("[\\w-]{11}");
    private static final Pattern CLOCK = Pattern.compile("(?:(\\d+)h)?(?:(\\d+)m)?(?:(\\d+)s?)?");

    /** Returns empty when the text is not an absolute http or https link. */
    public static Optional<VideoLink> parse(String raw) {
        if (raw == null || raw.isBlank() || raw.strip().length() > MAX_URL_LENGTH)
            return Optional.empty();

        String text = raw.strip();
        URI uri;
        try {
            uri = new URI(text);
        } catch (URISyntaxException invalid) {
            return Optional.empty();
        }
        String scheme = uri.getScheme();
        if (uri.getHost() == null || scheme == null
                || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https")))
            return Optional.empty();

        String host = uri.getHost().toLowerCase(Locale.ROOT).replaceFirst("^(www|m|music)\\.", "");
        if (!YOUTUBE_HOSTS.contains(host))
            return Optional.of(new VideoLink(text, providerOf(host), null, 0));

        String id = youtubeId(host, uri);
        int start = startOf(uri.getRawQuery());
        if (id == null)
            return Optional.of(new VideoLink(text, VideoProvider.YOUTUBE, null, start));
        return Optional.of(new VideoLink("https://www.youtube.com/watch?v=" + id, VideoProvider.YOUTUBE, id, start));
    }

    private static VideoProvider providerOf(String host) {
        if (matches(host, "facebook.com") || matches(host, "fb.watch"))
            return VideoProvider.FACEBOOK;
        if (matches(host, "tiktok.com"))
            return VideoProvider.TIKTOK;
        if (matches(host, "twitch.tv"))
            return VideoProvider.TWITCH;
        return VideoProvider.OTHER;
    }

    private static boolean matches(String host, String domain) {
        return host.equals(domain) || host.endsWith("." + domain);
    }

    private static String youtubeId(String host, URI uri) {
        String[] segments = uri.getPath() == null ? new String[0] : uri.getPath().replaceFirst("^/", "").split("/");
        String candidate = null;
        if (host.equals("youtu.be"))
            candidate = segments.length > 0 ? segments[0] : null;
        else if (segments.length == 1 && segments[0].equals("watch"))
            candidate = queryValue(uri.getRawQuery(), "v");
        else if (segments.length >= 2 && YOUTUBE_PATHS.contains(segments[0]))
            candidate = segments[1];
        return candidate != null && YOUTUBE_ID.matcher(candidate).matches() ? candidate : null;
    }

    private static int startOf(String query) {
        String value = queryValue(query, "t");
        if (value == null)
            value = queryValue(query, "start");
        if (value == null || value.isEmpty())
            return 0;

        var clock = CLOCK.matcher(value);
        if (!clock.matches())
            return 0;
        try {
            long seconds = part(clock.group(1)) * 3600 + part(clock.group(2)) * 60 + part(clock.group(3));
            return seconds > Integer.MAX_VALUE ? 0 : (int) seconds;
        } catch (NumberFormatException tooLong) {
            return 0;
        }
    }

    private static long part(String value) {
        return value == null ? 0 : Long.parseLong(value);
    }

    private static String queryValue(String query, String name) {
        if (query == null)
            return null;
        for (String pair : query.split("&")) {
            int separator = pair.indexOf('=');
            if (separator > 0 && pair.substring(0, separator).equals(name)) {
                try {
                    return URLDecoder.decode(pair.substring(separator + 1), StandardCharsets.UTF_8);
                } catch (IllegalArgumentException invalid) {
                    return null;
                }
            }
        }
        return null;
    }
}
