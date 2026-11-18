package com.wikiaov.community.community.internal.domain;

import java.net.URI;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

public final class PageRules {
    private PageRules() {
    }

    /** A broadcast older than this counts as ended even if nobody switched it off. */
    public static final Duration LIVE_WINDOW = Duration.ofHours(12);
    /** Names, titles and other one-line text. */
    public static final int MAX_NAME = 200;
    /** Short labels: short names, countries, roles, placements, link labels. */
    public static final int MAX_LABEL = 100;
    /** Links, and free text such as a report reason or a review resolution. */
    public static final int MAX_URL = 2000;
    public static final int MAX_NOTE = 2000;
    /** Longer text written to a person: a claim's evidence, a comment. */
    public static final int MAX_MESSAGE = 4000;
    public static final int MAX_POST_BODY = 20000;
    public static final int MAX_BIOGRAPHY = 10000;
    public static final int MAX_POST_IMAGES = 4;
    public static final int MAX_LINKS = 20;
    /** The lowest final place an achievement records. */
    public static final int MAX_PLACE = 999;

    private static final Set<String> POST_KINDS = Set.of("TEXT", "NEWS", "VIDEO");

    /** Checks a post and returns it trimmed, with TEXT as the default kind and no null image list. */
    public static PostContent post(PostContent input) {
        if (input == null) {
            throw invalid("Post content is required.");
        }
        String kind = input.kind() == null || input.kind().isBlank() ? "TEXT" : input.kind();
        if (!POST_KINDS.contains(kind)) {
            throw invalid("Use a TEXT, NEWS or VIDEO post.");
        }
        List<String> images = input.imageUrls() == null ? List.of() : input.imageUrls();
        text(input.title(), MAX_NAME, "NEWS".equals(kind));
        text(input.body(), MAX_POST_BODY, !"VIDEO".equals(kind));
        text(input.videoUrl(), MAX_URL, "VIDEO".equals(kind));
        url(input.videoUrl());
        if (images.size() > MAX_POST_IMAGES) {
            throw invalid("Use at most " + MAX_POST_IMAGES + " images.");
        }
        images.forEach(image -> {
            text(image, MAX_URL, true);
            url(image);
        });

        return new PostContent(kind, blankToNull(input.title()), input.body() == null ? "" : input.body().strip(),
                blankToNull(input.videoUrl()), images.stream().map(String::strip).toList());
    }

    /** A kind used to filter posts; blank means every kind. */
    public static String postKindFilter(String kind) {
        if (kind == null || kind.isBlank()) {
            return null;
        }
        if (!POST_KINDS.contains(kind)) {
            throw invalid("Use a TEXT, NEWS or VIDEO post.");
        }
        return kind;
    }

    /** An ILIKE pattern for a search text, with its wildcards escaped; blank means no search. */
    public static String searchPattern(String query) {
        text(query, MAX_LABEL, false);
        if (query == null || query.isBlank()) {
            return null;
        }
        return "%" + query.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    public static void live(String url, String title) {
        text(url, MAX_URL, true);
        url(url);
        text(title, MAX_NAME, true);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    public static void text(String value, int max, boolean required) {
        if ((required && (value == null || value.isBlank())) || (value != null && value.length() > max)) {
            throw invalid("Text is missing or exceeds its length limit.");
        }
    }

    public static void url(String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        try {
            var uri = URI.create(value);
            if (!("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    || uri.getHost() == null || uri.getUserInfo() != null || value.length() > MAX_URL) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException error) {
            throw invalid("Use an absolute HTTP or HTTPS URL without credentials.");
        }
    }

    public static void content(PageContent content) {
        if (content == null) {
            throw invalid("Page content is required.");
        }
        text(content.name(), MAX_NAME, true);
        text(content.shortName(), MAX_LABEL, false);
        text(content.country(), MAX_LABEL, false);
        presentation(new PageContent.Presentation(content.biography(), content.avatarUrl(), content.coverUrl(),
                content.links()));
        if (content.sources().size() > 100 || content.history().size() > 300 || content.achievements().size() > 300
                || content.roster().size() > 100) {
            throw invalid("Too many profile entries.");
        }
        content.sources().forEach(source -> {
            text(source.label(), MAX_NAME, true);
            text(source.url(), MAX_URL, true);
            url(source.url());
        });
        content.history().forEach(item -> {
            text(item.title(), 500, true);
            text(item.role(), MAX_LABEL, false);
            url(item.sourceUrl());
            dates(item.startsOn(), item.endsOn());
        });
        content.achievements().forEach(item -> {
            text(item.title(), 300, true);
            text(item.placement(), MAX_LABEL, true);
            url(item.sourceUrl());
            rank(item);
        });
        content.roster().forEach(item -> {
            text(item.name(), MAX_NAME, true);
            text(item.role(), MAX_LABEL, true);
            text(item.status(), MAX_LABEL, false);
            url(item.sourceUrl());
            dates(item.startsOn(), item.endsOn());
            if (item.standing() == PageContent.Standing.STAFF && item.lane() != null) {
                throw invalid("A staff member plays no lane.");
            }
        });
    }

    /** A place counts from 1; a shared standing ends after it starts; an individual award has no place. */
    private static void rank(PageContent.Achievement item) {
        if (item.place() != null && (item.place() < 1 || item.place() > MAX_PLACE)) {
            throw invalid("An achievement place is between 1 and " + MAX_PLACE + ".");
        }
        if (item.placeTo() != null
                && (item.place() == null || item.placeTo() <= item.place() || item.placeTo() > MAX_PLACE)) {
            throw invalid("A shared standing needs a place before its last place.");
        }
        if (Boolean.TRUE.equals(item.award()) && item.place() != null) {
            throw invalid("An individual award has no place.");
        }
    }

    public static void presentation(PageContent.Presentation value) {
        if (value == null) {
            throw invalid("Presentation is required.");
        }
        text(value.biography(), MAX_BIOGRAPHY, false);
        url(value.avatarUrl());
        url(value.coverUrl());
        if (value.links().size() > MAX_LINKS) {
            throw invalid("Use at most " + MAX_LINKS + " links.");
        }
        value.links().forEach(link -> {
            text(link.label(), MAX_LABEL, true);
            text(link.url(), MAX_URL, true);
            url(link.url());
        });
    }

    private static void dates(LocalDate start, LocalDate end) {
        if (start != null && end != null && end.isBefore(start)) {
            throw invalid("End date precedes start date.");
        }
    }

    public static InvalidPage invalid(String detail) {
        return new InvalidPage(detail);
    }

    /** A page, post or broadcast breaks a rule; the detail says which. */
    public static final class InvalidPage extends RuntimeException {
        InvalidPage(String detail) {
            super(detail);
        }
    }
}
