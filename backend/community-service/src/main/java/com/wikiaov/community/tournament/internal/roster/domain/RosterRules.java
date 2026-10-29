package com.wikiaov.community.tournament.internal.roster.domain;

import com.wikiaov.community.tournament.internal.domain.SourceUrls;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.RosterMembership;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Verification;
import java.util.ArrayList;
import java.util.List;

public final class RosterRules {
    private RosterRules() {
    }

    public static List<String> violations(RosterMembership content) {
        if (content == null)
            return List.of("content is required.");
        var errors = new ArrayList<String>();
        if (content.tournamentId() == null)
            errors.add("tournamentId is required.");
        if (content.teamId() == null)
            errors.add("teamId is required.");
        if (content.playerId() == null)
            errors.add("playerId is required.");
        if (content.jerseyNumber() != null && content.jerseyNumber().length() > 20)
            errors.add("jerseyNumber must not exceed 20 characters.");
        if (content.note() != null && content.note().length() > 2000)
            errors.add("note must not exceed 2000 characters.");

        if (content.startsOn() != null && content.endsOn() != null && content.endsOn().isBefore(content.startsOn()))
            errors.add("endsOn cannot precede startsOn.");
        if (!SourceUrls.valid(content.sourceUrl()))
            errors.add("sourceUrl must be an absolute HTTP or HTTPS URL without embedded credentials.");
        if (content.verification() != Verification.UNVERIFIED
                && (content.sourceUrl() == null || content.sourceUrl().isBlank()))
            errors.add("sourceUrl is required for a verified roster observation.");

        return List.copyOf(errors);
    }
}
