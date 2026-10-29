package com.wikiaov.community.tournament.internal.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.*;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class TournamentMetadataRulesTest {
    @Test
    void validObservedResultKeepsExplicitVerificationAndCanLeaveScoresUnknown() {
        var known = new TournamentResult("Flash Wolves", "Saigon Phantom", 4, 3,
                "https://liquipedia.net/honorofkings/Arena_of_Valor", Verification.SECONDARY_CAPTURE,
                LocalDate.of(2026, 10, 27));
        assertThat(TournamentMetadataRules.violations(tournament(known))).isEmpty();
        var unknownScores = new TournamentResult("Flash Wolves", "Saigon Phantom", null, null,
                "https://example.test/result", null, null);
        assertThat(TournamentMetadataRules.violations(tournament(unknownScores))).isEmpty();
        assertThat(unknownScores.verification()).isEqualTo(Verification.UNVERIFIED);
    }

    @Test
    void resultRequiresEvidenceDistinctNamesAndConsistentBoundedScores() {
        var invalid = new TournamentResult(" Same team ", "same team", 100, 3, "javascript:alert(1)", null, null);
        assertThat(TournamentMetadataRules.violations(tournament(invalid)))
                .anyMatch(message -> message.contains("different teams"))
                .anyMatch(message -> message.contains("sourceUrl"))
                .anyMatch(message -> message.contains("between 0 and 99"));
        var oneScore = new TournamentResult("Winner", "Runner", 4, null, "https://example.test/result", null, null);
        assertThat(TournamentMetadataRules.violations(tournament(oneScore)))
                .anyMatch(message -> message.contains("supplied together"));
        var noEvidence = new TournamentResult(" ", "Runner", null, null, null, null, null);
        assertThat(TournamentMetadataRules.violations(tournament(noEvidence)))
                .anyMatch(message -> message.contains("winnerName"))
                .anyMatch(message -> message.contains("sourceUrl"));
    }

    @Test
    void datesDoNotInferTournamentStatusOrResult() {
        var old = new Tournament("historic", "Historic event", "GLOBAL", 2020, LocalDate.of(2020, 1, 1),
                LocalDate.of(2020, 1, 2), null, null);
        assertThat(old.status()).isEqualTo(TournamentStatus.UNKNOWN);
        assertThat(old.tier()).isEqualTo(TournamentTier.UNKNOWN);
        assertThat(old.result()).isNull();
        assertThat(TournamentMetadataRules.violations(old)).isEmpty();
    }

    private static Tournament tournament(TournamentResult result) {
        return new Tournament("event", "Event", "GLOBAL", 2026, null, null, null, null,
                "https://img.example.test/event.png", TournamentTier.S, CompetitionType.CUP, VenueMode.OFFLINE,
                TournamentStatus.FINISHED, result);
    }
}
