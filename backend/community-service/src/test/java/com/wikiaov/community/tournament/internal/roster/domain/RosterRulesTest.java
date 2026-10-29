package com.wikiaov.community.tournament.internal.roster.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.*;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RosterRulesTest {
    @Test
    void unknownPositionDatesAndVerificationDoNotInventMembershipFacts() {
        var content = membership(null, null, null, null, null, null, null);
        assertThat(RosterRules.violations(content)).isEmpty();
        assertThat(content.lane()).isNull();
        assertThat(content.status()).isEqualTo(RosterStatus.UNKNOWN);
        assertThat(content.verification()).isEqualTo(Verification.UNVERIFIED);
    }

    @Test
    void verifiedObservationsRequireSourceAndCannotHaveReversedDates() {
        var missingSource = membership(Lane.MID, " 07 ", RosterStatus.ACTIVE, LocalDate.of(2026, 10, 2),
                LocalDate.of(2026, 10, 1), null, Verification.SECONDARY_CAPTURE);
        assertThat(missingSource.jerseyNumber()).isEqualTo("07");
        assertThat(RosterRules.violations(missingSource))
                .anyMatch(message -> message.contains("sourceUrl is required"))
                .anyMatch(message -> message.contains("endsOn cannot precede"));
        var unsafe = membership(null, null, null, null, null, "javascript:alert(1)", null);
        assertThat(RosterRules.violations(unsafe)).anyMatch(message -> message.contains("HTTP or HTTPS"));
    }

    @Test
    void boundedLabelsAndThreeRequiredIdentitiesAreChecked() {
        var content = new RosterMembership(null, null, null, null, "x".repeat(21), null, null, null, null, null,
                "n".repeat(2001));
        assertThat(RosterRules.violations(content)).hasSize(5);
        assertThat(RosterRules.violations(null)).containsExactly("content is required.");
    }

    private static RosterMembership membership(Lane lane, String jersey, RosterStatus status, LocalDate start,
            LocalDate end, String source, Verification verification) {
        return new RosterMembership(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), lane, jersey, status,
                start, end, source, verification, null);
    }
}
