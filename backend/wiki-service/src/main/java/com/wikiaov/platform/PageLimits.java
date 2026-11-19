package com.wikiaov.platform;

/**
 * Page bounds of list endpoints (03 section 46). A {@code *Api} declares them on its parameters as
 * {@code @Min(0) int page, @Min(1) @Max(PageLimits.MAX_SIZE) int size}; a bound broken is answered with
 * {@link PlatformErrorCode#INVALID_QUERY_PARAMETER}.
 */
public final class PageLimits {
    /** The largest page a list answers unless the endpoint documents a smaller one. */
    public static final int MAX_SIZE = 100;

    private PageLimits() {
    }
}
