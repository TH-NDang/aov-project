package com.wikiaov.community.tournament.internal.verification.domain;

import java.util.UUID;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;

/**
 * A part of a tournament the owner checks on its own (spec 04, tournament data verification): its information, one team
 * with its roster, the format, the matches of one stage, or the final standings. Written as {@code INFO} or
 * {@code TEAM:<team id>}; the database checks the same shape.
 */
public record VerificationPart(
        Kind kind,
        @Nullable String key
) {
    private static final Pattern STAGE = Pattern.compile("[A-Z0-9_]{2,60}");

    public enum Kind {
        INFO(false),
        TEAM(true),
        FORMAT(false),
        SCHEDULE(true),
        FINAL(false);

        private final boolean keyed;

        Kind(boolean keyed) {
            this.keyed = keyed;
        }

        public boolean keyed() {
            return keyed;
        }
    }

    /** Reads a part as Admin writes it, or fails with {@link IllegalArgumentException}. */
    public static VerificationPart parse(@Nullable String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Name the part that was checked.");
        }

        int colon = value.indexOf(':');
        Kind kind = kind(colon < 0 ? value : value.substring(0, colon));
        String key = colon < 0 ? null : value.substring(colon + 1);
        if (kind.keyed() != (key != null)) {
            throw new IllegalArgumentException(kind.keyed() ? "This part needs a key." : "This part takes no key.");
        }
        if (kind == Kind.TEAM) {
            key = teamKey(key);
        }
        if (kind == Kind.SCHEDULE && !STAGE.matcher(key).matches()) {
            throw new IllegalArgumentException("A schedule part is keyed by a stage code.");
        }

        return new VerificationPart(kind, key);
    }

    public String value() {
        return key == null ? kind.name() : kind.name() + ":" + key;
    }

    private static Kind kind(String name) {
        for (Kind kind : Kind.values()) {
            if (kind.name().equals(name)) {
                return kind;
            }
        }
        throw new IllegalArgumentException("Unknown part.");
    }

    private static String teamKey(String key) {
        try {
            return UUID.fromString(key).toString();
        } catch (IllegalArgumentException invalid) {
            throw new IllegalArgumentException("A team part is keyed by the team's id.");
        }
    }
}
