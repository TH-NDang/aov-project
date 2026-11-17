package com.wikiaov.community.community.internal.application;

import com.wikiaov.community.community.internal.domain.PageContent;
import com.wikiaov.community.community.internal.domain.PagePersonRoles;
import com.wikiaov.community.community.internal.domain.PageRules;
import com.wikiaov.community.community.internal.domain.PostContent;
import com.wikiaov.community.platform.ApiException;
import java.util.function.Supplier;

/** Runs the page rules of the domain for the use cases and answers a broken rule as PAGE_INVALID_CONTENT. */
public final class PageChecks {
    private PageChecks() {
    }

    public static ApiException invalid(String detail) {
        return new ApiException(PageErrorCode.PAGE_INVALID_CONTENT, detail);
    }

    public static PostContent post(PostContent input) {
        return check(() -> PageRules.post(input));
    }

    public static String postKindFilter(String kind) {
        return check(() -> PageRules.postKindFilter(kind));
    }

    public static String searchPattern(String query) {
        return check(() -> PageRules.searchPattern(query));
    }

    public static void live(String url, String title) {
        run(() -> PageRules.live(url, title));
    }

    public static void text(String value, int max, boolean required) {
        run(() -> PageRules.text(value, max, required));
    }

    public static void content(PageContent content) {
        run(() -> PageRules.content(content));
    }

    public static void presentation(PageContent.Presentation presentation) {
        run(() -> PageRules.presentation(presentation));
    }

    public static void personRoles(PageContent.Kind kind, PageContent content) {
        run(() -> PagePersonRoles.validate(kind, content));
    }

    public static String personRoleFilter(String role) {
        return check(() -> PagePersonRoles.filter(role));
    }

    private static void run(Runnable rule) {
        check(() -> {
            rule.run();
            return null;
        });
    }

    private static <T> T check(Supplier<T> rule) {
        try {
            return rule.get();
        } catch (PageRules.InvalidPage broken) {
            throw new ApiException(PageErrorCode.PAGE_INVALID_CONTENT, broken.getMessage(), broken);
        }
    }
}
