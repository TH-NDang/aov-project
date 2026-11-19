package com.wikiaov.community.tournament.internal.application;

import com.wikiaov.community.platform.ApiException;
import java.util.regex.Pattern;

public final class TournamentErrors {
    public static final int MAX_NAME = 200;
    public static final int MAX_CODE = 100;
    /** A lowercase slug: letters and digits in groups joined by single hyphens. */
    private static final Pattern CODE = Pattern.compile("[a-z0-9]+(?:-[a-z0-9]+)*");

    private TournamentErrors() {
    }

    public static ApiException missing() {
        return new ApiException(TournamentErrorCode.TOURNAMENT_RECORD_NOT_FOUND,
                "The tournament record does not exist.");
    }

    public static ApiException invalid(String detail) {
        return new ApiException(TournamentErrorCode.TOURNAMENT_INVALID_CONTENT, detail);
    }

    public static void version(long actual, Long expected) {
        if (expected == null || actual != expected) {
            throw new ApiException(TournamentErrorCode.TOURNAMENT_VERSION_CONFLICT,
                    "The record changed. Reload before saving.");
        }
    }

    public static void required(String value, String field) {
        if (value == null || value.isBlank() || value.length() > MAX_NAME) {
            throw invalid(field + " is required and must not exceed " + MAX_NAME + " characters.");
        }
    }

    public static void code(String code) {
        if (code == null || !CODE.matcher(code).matches() || code.length() > MAX_CODE) {
            throw invalid("Use a lowercase code of at most " + MAX_CODE + " characters.");
        }
    }
}
