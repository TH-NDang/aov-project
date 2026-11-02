package com.wikiaov.community.community.internal.domain;

import com.wikiaov.community.community.internal.application.PageErrorCode;
import com.wikiaov.community.platform.ApiException;
import java.net.URI;

public final class PageRules {
    private PageRules() {
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
