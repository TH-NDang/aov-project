package com.wikiaov.community.tournament.internal.application;

import com.wikiaov.community.platform.ApiException;

public final class TournamentErrors {
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
        if (expected == null || actual != expected)
            throw new ApiException(TournamentErrorCode.TOURNAMENT_VERSION_CONFLICT,
                    "The record changed. Reload before saving.");
    }

    public static void required(String value, String field) {
        if (value == null || value.isBlank() || value.length() > 200)
            throw invalid(field + " is required and must not exceed 200 characters.");
    }

    public static void code(String code) {
        if (code == null || !code.matches("[a-z0-9]+(?:-[a-z0-9]+)*") || code.length() > 100)
            throw invalid("Use a lowercase code of at most 100 characters.");
    }
}
