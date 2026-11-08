package com.wikiaov.gamemode.internal.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.gamemode.internal.domain.GameModeContent.Availability;
import com.wikiaov.gamemode.internal.domain.GameModeContent.Duration;
import com.wikiaov.platform.ApiFieldError;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class GameModeContentRulesTest {
    @Test
    void aNewModeCanBeSavedAndPublishedWithOnlyItsNameAndGroup() {
        var content = GameModeContent.initial("Cờ Liên quân", "ENTERTAINMENT");

        assertThat(GameModeContentRules.validate(content)).isEmpty();
        assertThat(GameModeContentRules.missingFields(content)).isEmpty();
        assertThat(GameModeContentRules.missingFields(GameModeContent.initial(" ", null)))
                .containsExactly("name", "group");
    }

    @Test
    void rejectsUnknownValuesAndInvertedRanges() {
        var content = new GameModeContent("Vua tốc độ", "CASUAL", 1, null, null, new Duration(9, 5),
                new Availability("SOON", "Mở hữu hạn 14 giờ", LocalDate.of(2026, 11, 9), LocalDate.of(2026, 11, 8),
                        null, null),
                null, "MOBA", null, null, null, null);

        assertThat(GameModeContentRules.validate(content)).extracting(ApiFieldError::path)
                .containsExactlyInAnyOrder("group", "guideKind", "duration.maxMinutes", "availability.status",
                        "availability.endsOn");
    }

    @Test
    void keepsTheGameLabelWithoutDerivingDates() {
        var availability = new Availability("LIMITED", "Mở hữu hạn 14 giờ", null, null, null, null);
        var content = new GameModeContent("Đấu móc", "ENTERTAINMENT", 5, null, null, new Duration(5, 9), availability,
                null, null, List.of(), List.of(), List.of(), List.of());

        assertThat(GameModeContentRules.validate(content)).isEmpty();
        assertThat(content.availability().startsOn()).isNull();
        assertThat(content.guideKind()).isEqualTo("NONE");
    }
}
