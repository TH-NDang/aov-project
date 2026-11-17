package com.wikiaov.community.tournament.internal.domain;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.Tournament;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.TournamentResult;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public final class TournamentMetadataRules {
    private TournamentMetadataRules() {
    }

    public static List<String> violations(Tournament content) {
        var errors = new ArrayList<String>();
        if (!SourceUrls.valid(content.logoUrl())) {
            errors.add("logoUrl must be an absolute HTTP or HTTPS URL without embedded credentials.");
        }

        if (content.result() != null) {
            validateResult(content.result(), errors);
        }

        validateFinalTable(content, errors);

        return List.copyOf(errors);
    }

    private static void validateResult(TournamentResult result, List<String> errors) {
        if (!name(result.winnerName())) {
            errors.add("result.winnerName is required and must not exceed 200 characters.");
        }
        if (!name(result.runnerUpName())) {
            errors.add("result.runnerUpName is required and must not exceed 200 characters.");
        }
        if (result.winnerName() != null && result.runnerUpName() != null
                && result.winnerName().equalsIgnoreCase(result.runnerUpName())) {
            errors.add("result winner and runner-up must be different teams.");
        }
        if (result.sourceUrl() == null || result.sourceUrl().isBlank() || !SourceUrls.valid(result.sourceUrl())) {
            errors.add("result.sourceUrl must be an absolute HTTP or HTTPS source URL.");
        }

        boolean winnerScore = result.winnerScore() != null;
        boolean runnerUpScore = result.runnerUpScore() != null;
        if (winnerScore != runnerUpScore) {
            errors.add("Both result scores must be supplied together or left unknown.");
        }
        if (winnerScore && runnerUpScore && (result.winnerScore() < 0 || result.winnerScore() > 99
                || result.runnerUpScore() < 0 || result.runnerUpScore() > 99
                || result.winnerScore() <= result.runnerUpScore())) {
            errors.add("Result scores must be between 0 and 99 with the winner ahead of the runner-up.");
        }
    }

    private static void validateFinalTable(Tournament content, List<String> errors) {
        if (content.localCurrency() != null && content.localCurrency().length() > 30) {
            errors.add("localCurrency must not exceed 30 characters.");
        }
        if (content.placements().size() > 512) {
            errors.add("placements must not exceed 512 lines.");
        }
        if (content.awards().size() > 128) {
            errors.add("awards must not exceed 128 lines.");
        }
        if (content.links().size() > 20) {
            errors.add("links must not exceed 20 entries.");
        }

        for (var line : content.placements()) {
            if (line.place() == null || line.place().isBlank() || line.place().length() > 30) {
                errors.add("placements.place is required and must not exceed 30 characters.");
            }
            if (!name(line.teamName())) {
                errors.add("placements.teamName is required and must not exceed 200 characters.");
            }
            if (line.lastOpponent() != null && line.lastOpponent().length() > 200
                    || line.lastScore() != null && line.lastScore().length() > 30) {
                errors.add("placements last match text is too long.");
            }
            if (negative(line.prizeUsd()) || negative(line.prizeLocal())) {
                errors.add("placements prizes cannot be negative.");
            }
        }
        for (var award : content.awards()) {
            if (!name(award.title()) || !name(award.recipientName())) {
                errors.add("awards.title and awards.recipientName are required and must not exceed 200 characters.");
            }
            if (award.teamName() != null && award.teamName().length() > 200) {
                errors.add("awards.teamName must not exceed 200 characters.");
            }
            if (negative(award.prizeUsd()) || negative(award.prizeLocal())) {
                errors.add("awards prizes cannot be negative.");
            }
        }
        for (var link : content.links()) {
            if (!name(link.label())) {
                errors.add("links.label is required and must not exceed 200 characters.");
            }
            if (link.url() == null || link.url().isBlank() || !SourceUrls.valid(link.url())) {
                errors.add("links.url must be an absolute HTTP or HTTPS URL.");
            }
        }
    }

    private static boolean negative(BigDecimal value) {
        return value != null && value.signum() < 0;
    }

    private static boolean name(String value) {
        return value != null && !value.isBlank() && value.length() <= 200;
    }
}
