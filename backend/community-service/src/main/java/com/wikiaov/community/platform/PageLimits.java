package com.wikiaov.community.platform;

/** Page bounds the {@code *Api} parameters declare, so every list states its limits in one place (spec 04). */
public final class PageLimits {
    /** Largest page of a list. */
    public static final int MAX_SIZE = 100;
    /**
     * Largest page of the tournament registry lists under /admin (teams, players, tournaments, series, games, rosters,
     * references), which Admin walks in full to look rows up by id. Public lists stay at {@link #MAX_SIZE}.
     */
    public static final int MAX_REGISTRY_SIZE = 500;
    /** Deepest page of a tournament registry list. */
    public static final int MAX_REGISTRY_PAGE = 100_000;

    private PageLimits() {
    }
}
