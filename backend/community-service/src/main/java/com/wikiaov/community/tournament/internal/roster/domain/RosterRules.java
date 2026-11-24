package com.wikiaov.community.tournament.internal.roster.domain;

import com.wikiaov.community.tournament.internal.domain.SourceUrls;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.RosterMembership;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Verification;
import java.util.ArrayList;
import java.util.List;

public final class RosterRules {
    public static final int MAX_JERSEY_NUMBER = 20;
    public static final int MAX_NOTE = 2000;
    /** Lines one batch may take out, change and add together. */
    public static final int MAX_BATCH = 500;

    private RosterRules() {
    }

    public static List<String> violations(RosterMembership content) {
        if (content == null) {
            return List.of("content is required.");
        }
        var errors = new ArrayList<String>();
        if (content.tournamentId() == null) {
            errors.add("tournamentId is required.");
        }
        if (content.teamId() == null) {
            errors.add("teamId is required.");
        }
        if (content.playerId() == null) {
            errors.add("playerId is required.");
        }
        if (content.jerseyNumber() != null && content.jerseyNumber().length() > MAX_JERSEY_NUMBER) {
            errors.add("jerseyNumber must not exceed " + MAX_JERSEY_NUMBER + " characters.");
        }
        if (content.note() != null && content.note().length() > MAX_NOTE) {
            errors.add("note must not exceed " + MAX_NOTE + " characters.");
        }

        if (content.startsOn() != null && content.endsOn() != null && content.endsOn().isBefore(content.startsOn())) {
            errors.add("endsOn cannot precede startsOn.");
        }
        if (!SourceUrls.valid(content.sourceUrl())) {
            errors.add("sourceUrl must be an absolute HTTP or HTTPS URL without embedded credentials.");
        }
        if (content.verification() != Verification.UNVERIFIED
                && (content.sourceUrl() == null || content.sourceUrl().isBlank())) {
            errors.add("sourceUrl is required for a verified roster observation.");
        }

        return List.copyOf(errors);
    }
}
