package com.wikiaov.community.tournament.internal.verification.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import com.wikiaov.community.tournament.internal.verification.domain.VerificationPart.Kind;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class VerificationPartTest {
    @ParameterizedTest
    @CsvSource({
            "INFO, INFO, INFO",
            "FORMAT, FORMAT, FORMAT",
            "FINAL, FINAL, FINAL",
            "TEAM:0b6c0d3e-5a4f-4c35-9a52-7f3b8f0e9d21, TEAM, TEAM:0b6c0d3e-5a4f-4c35-9a52-7f3b8f0e9d21",
            "TEAM:0B6C0D3E-5A4F-4C35-9A52-7F3B8F0E9D21, TEAM, TEAM:0b6c0d3e-5a4f-4c35-9a52-7f3b8f0e9d21",
            "SCHEDULE:GROUP_A, SCHEDULE, SCHEDULE:GROUP_A",
            "SCHEDULE:PLAYOFFS, SCHEDULE, SCHEDULE:PLAYOFFS"
    })
    void aPartIsReadAndWrittenInOneShape(String value, Kind kind, String written) {
        var part = VerificationPart.parse(value);

        assertThat(part.kind()).isEqualTo(kind);
        assertThat(part.value()).isEqualTo(written);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "info", "ROSTER", "INFO:x", "FINAL:", "TEAM", "TEAM:", "TEAM:saigon-phantom",
            "SCHEDULE", "SCHEDULE:", "SCHEDULE:group_a", "SCHEDULE:A", "SCHEDULE:GROUP A"})
    void anythingElseIsRefused(String value) {
        assertThatIllegalArgumentException().isThrownBy(() -> VerificationPart.parse(value));
    }
}
