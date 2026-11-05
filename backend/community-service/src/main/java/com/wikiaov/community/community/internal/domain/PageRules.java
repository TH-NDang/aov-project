package com.wikiaov.community.community.internal.domain;

import com.wikiaov.community.community.internal.application.PageErrorCode;
import com.wikiaov.community.platform.ApiException;
import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.Set;

public final class PageRules {
    private PageRules() {
    }

    /** A broadcast older than this counts as ended even if nobody switched it off. */
    public static final Duration LIVE_WINDOW = Duration.ofHours(12);

    private static final Set<String> POST_KINDS = Set.of("TEXT", "NEWS", "VIDEO");

    /** Checks a post and returns it trimmed, with TEXT as the default kind and no null image list. */
    public static PostContent post(PostContent input) {
        if (input == null)
            throw invalid("Post content is required.");
        String kind = input.kind() == null || input.kind().isBlank() ? "TEXT" : input.kind();
        if (!POST_KINDS.contains(kind))
            throw invalid("Use a TEXT, NEWS or VIDEO post.");
        List<String> images = input.imageUrls() == null ? List.of() : input.imageUrls();
        text(input.title(), 200, "NEWS".equals(kind));
        text(input.body(), 20000, !"VIDEO".equals(kind));
        text(input.videoUrl(), 2000, "VIDEO".equals(kind));
        url(input.videoUrl());
        if (images.size() > 4)
            throw invalid("Use at most 4 images.");
        images.forEach(image -> {
            text(image, 2000, true);
            url(image);
        });

        return new PostContent(kind, blankToNull(input.title()), input.body() == null ? "" : input.body().strip(),
                blankToNull(input.videoUrl()), images.stream().map(String::strip).toList());
    }

    /** A kind used to filter posts; blank means every kind. */
    public static String postKindFilter(String kind) {
        if (kind == null || kind.isBlank())
            return null;
        if (!POST_KINDS.contains(kind))
            throw invalid("Use a TEXT, NEWS or VIDEO post.");
        return kind;
    }

    /** An ILIKE pattern for a search text, with its wildcards escaped; blank means no search. */
    public static String searchPattern(String query) {
        text(query, 100, false);
        if (query == null || query.isBlank())
            return null;
        return "%" + query.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    public static void live(String url, String title) {
        text(url, 2000, true);
        url(url);
        text(title, 200, true);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    public static void text(String value, int max, boolean required) {
        if ((required && (value == null || value.isBlank())) || (value != null && value.length() > max))
            throw invalid("Text is missing or exceeds its length limit.");
    }

    public static void url(String value) {
        if (value == null || value.isBlank())
            return;
        try {
            var uri = URI.create(value);
            if (!("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    || uri.getHost() == null || uri.getUserInfo() != null || value.length() > 2000)
                throw new IllegalArgumentException();
        } catch (IllegalArgumentException error) {
            throw invalid("Use an absolute HTTP or HTTPS URL without credentials.");
        }
    }

    public static void content(PageContent content) {
        if (content == null)
            throw invalid("Page content is required.");
        text(content.name(), 200, true);
        text(content.shortName(), 100, false);
        text(content.country(), 100, false);
        presentation(new PageContent.Presentation(content.biography(), content.avatarUrl(), content.coverUrl(),
                content.links()));
        if (content.sources().size() > 100 || content.history().size() > 300 || content.achievements().size() > 300
                || content.roster().size() > 100)
            throw invalid("Too many profile entries.");
        content.sources().forEach(source -> {
            text(source.label(), 200, true);
            text(source.url(), 2000, true);
            url(source.url());
        });
        content.history().forEach(item -> {
            text(item.title(), 500, true);
            text(item.role(), 100, false);
            url(item.sourceUrl());
            dates(item.startsOn(), item.endsOn());
        });
        content.achievements().forEach(item -> {
            text(item.title(), 300, true);
            text(item.placement(), 100, true);
            url(item.sourceUrl());
        });
        content.roster().forEach(item -> {
            text(item.name(), 200, true);
            text(item.role(), 100, true);
            text(item.status(), 100, false);
            url(item.sourceUrl());
            dates(item.startsOn(), item.endsOn());
        });
    }

    public static void presentation(PageContent.Presentation value) {
        if (value == null)
            throw invalid("Presentation is required.");
        text(value.biography(), 10000, false);
        url(value.avatarUrl());
        url(value.coverUrl());
        if (value.links().size() > 20)
            throw invalid("Use at most 20 links.");
        value.links().forEach(link -> {
            text(link.label(), 100, true);
            text(link.url(), 2000, true);
            url(link.url());
        });
    }

    private static void dates(java.time.LocalDate start, java.time.LocalDate end) {
        if (start != null && end != null && end.isBefore(start))
            throw invalid("End date precedes start date.");
    }

    public static ApiException invalid(String detail) {
        return new ApiException(PageErrorCode.PAGE_INVALID_CONTENT, detail);
    }
}
