package com.wikiaov.community.tournament.internal.reference.domain;

import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** What a text can name, and where a reader opens it. */
public enum ReferenceKind {
    CIRCUIT("/pages/"),
    ORGANIZATION("/pages/"),
    COMPETITION("/competitions/"),
    TEAM("/teams/"),
    PLAYER("/players/"),
    /** Broadcast crews and team staff; the id is the one of their profile page. */
    PERSON("/people/");

    /** Few enough for every page with a text to read them. */
    public static final List<ReferenceKind> CORE = List.of(CIRCUIT, ORGANIZATION, COMPETITION, TEAM);
    /** Read only by a text that can name someone. */
    public static final List<ReferenceKind> INDIVIDUALS = List.of(PLAYER, PERSON);

    private static final String PAGES = "/pages/";

    private final String root;

    ReferenceKind(String root) {
        this.root = root;
    }

    /** The address inside AOV Stream: the published page when there is one, otherwise the one built from competitions. */
    public String path(UUID id, @Nullable String pageCode) {
        return pageCode == null ? root + id : PAGES + pageCode;
    }
}
