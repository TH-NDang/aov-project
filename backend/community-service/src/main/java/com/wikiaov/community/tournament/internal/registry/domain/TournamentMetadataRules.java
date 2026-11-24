package com.wikiaov.community.tournament.internal.registry.domain;

import com.wikiaov.community.tournament.internal.domain.CrewRules;
import com.wikiaov.community.tournament.internal.domain.SourceUrls;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Tournament;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.TournamentResult;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public final class TournamentMetadataRules {
    /** Team, recipient, opponent and link names. */
    public static final int MAX_NAME = 200;
    /** A place such as "5-8", a score such as "3-1" and a currency code. */
    public static final int MAX_SHORT_TEXT = 30;
    public static final int MAX_SCORE = 99;
    public static final int MAX_PLACEMENTS = 512;
    public static final int MAX_AWARDS = 128;
    public static final int MAX_LINKS = 20;

    private TournamentMetadataRules() {
    }

    public static List<String> violations(Tournament content) {
        var errors = new ArrayList<String>();
        if (!SourceUrls.valid(content.logoUrl())) {
            errors.add("logoUrl must be an absolute HTTP or HTTPS URL without embedded credentials.");
        }

        if (!SourceUrls.valid(content.logoDarkUrl())) {
            errors.add("logoDarkUrl must be an absolute HTTP or HTTPS URL without embedded credentials.");
        }

        if (content.result() != null) {
            validateResult(content.result(), errors);
        }

        validateFinalTable(content, errors);
        errors.addAll(CrewRules.crew(content.broadcast(), CrewRules.MAX_TOURNAMENT_CREW, "broadcast"));
        errors.addAll(CrewRules.staff(content.staff()));

        return List.copyOf(errors);
    }

    private static void validateResult(TournamentResult result, List<String> errors) {
        if (!name(result.winnerName())) {
            errors.add("result.winnerName is required and must not exceed " + MAX_NAME + " characters.");
        }
        if (!name(result.runnerUpName())) {
            errors.add("result.runnerUpName is required and must not exceed " + MAX_NAME + " characters.");
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
        if (winnerScore && runnerUpScore && (result.winnerScore() < 0 || result.winnerScore() > MAX_SCORE
                || result.runnerUpScore() < 0 || result.runnerUpScore() > MAX_SCORE
                || result.winnerScore() <= result.runnerUpScore())) {
            errors.add("Result scores must be between 0 and " + MAX_SCORE + " with the winner ahead of the runner-up.");
        }
    }

    private static void validateFinalTable(Tournament content, List<String> errors) {
        if (content.localCurrency() != null && content.localCurrency().length() > MAX_SHORT_TEXT) {
            errors.add("localCurrency must not exceed " + MAX_SHORT_TEXT + " characters.");
        }
        if (content.placements().size() > MAX_PLACEMENTS) {
            errors.add("placements must not exceed " + MAX_PLACEMENTS + " lines.");
        }
        if (content.awards().size() > MAX_AWARDS) {
            errors.add("awards must not exceed " + MAX_AWARDS + " lines.");
        }
        if (content.links().size() > MAX_LINKS) {
            errors.add("links must not exceed " + MAX_LINKS + " entries.");
        }

        for (var line : content.placements()) {
            if (line.place() == null || line.place().isBlank() || line.place().length() > MAX_SHORT_TEXT) {
                errors.add("placements.place is required and must not exceed " + MAX_SHORT_TEXT + " characters.");
            }
            if (!name(line.teamName())) {
                errors.add("placements.teamName is required and must not exceed " + MAX_NAME + " characters.");
            }
            if (line.lastOpponent() != null && line.lastOpponent().length() > MAX_NAME
                    || line.lastScore() != null && line.lastScore().length() > MAX_SHORT_TEXT) {
                errors.add("placements last match text is too long.");
            }
            if (negative(line.prizeUsd()) || negative(line.prizeLocal())) {
                errors.add("placements prizes cannot be negative.");
            }
        }
        for (var award : content.awards()) {
            if (!name(award.title()) || !name(award.recipientName())) {
                errors.add("awards.title and awards.recipientName are required and must not exceed " + MAX_NAME
                        + " characters.");
            }
            if (award.teamName() != null && award.teamName().length() > MAX_NAME) {
                errors.add("awards.teamName must not exceed " + MAX_NAME + " characters.");
            }
            if (negative(award.prizeUsd()) || negative(award.prizeLocal())) {
                errors.add("awards prizes cannot be negative.");
            }
        }
        for (var link : content.links()) {
            if (!name(link.label())) {
                errors.add("links.label is required and must not exceed " + MAX_NAME + " characters.");
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
        return value != null && !value.isBlank() && value.length() <= MAX_NAME;
    }
}
