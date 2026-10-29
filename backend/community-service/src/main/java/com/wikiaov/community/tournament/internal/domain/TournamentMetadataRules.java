package com.wikiaov.community.tournament.internal.domain;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.Tournament;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.TournamentResult;
import java.util.ArrayList;
import java.util.List;

public final class TournamentMetadataRules {
    private TournamentMetadataRules() {
    }

    public static List<String> violations(Tournament content) {
        var errors = new ArrayList<String>();
        if (!SourceUrls.valid(content.logoUrl()))
            errors.add("logoUrl must be an absolute HTTP or HTTPS URL without embedded credentials.");

        if (content.result() != null)
            validateResult(content.result(), errors);

        return List.copyOf(errors);
    }

    private static void validateResult(TournamentResult result, List<String> errors) {
        if (!name(result.winnerName()))
            errors.add("result.winnerName is required and must not exceed 200 characters.");
        if (!name(result.runnerUpName()))
            errors.add("result.runnerUpName is required and must not exceed 200 characters.");
        if (result.winnerName() != null && result.runnerUpName() != null
                && result.winnerName().equalsIgnoreCase(result.runnerUpName()))
            errors.add("result winner and runner-up must be different teams.");
        if (result.sourceUrl() == null || result.sourceUrl().isBlank() || !SourceUrls.valid(result.sourceUrl()))
            errors.add("result.sourceUrl must be an absolute HTTP or HTTPS source URL.");

        boolean winnerScore = result.winnerScore() != null;
        boolean runnerUpScore = result.runnerUpScore() != null;
        if (winnerScore != runnerUpScore)
            errors.add("Both result scores must be supplied together or left unknown.");
        if (winnerScore && runnerUpScore && (result.winnerScore() < 0 || result.winnerScore() > 99
                || result.runnerUpScore() < 0 || result.runnerUpScore() > 99
                || result.winnerScore() <= result.runnerUpScore()))
            errors.add("Result scores must be between 0 and 99 with the winner ahead of the runner-up.");
    }

    private static boolean name(String value) {
        return value != null && !value.isBlank() && value.length() <= 200;
    }
}
