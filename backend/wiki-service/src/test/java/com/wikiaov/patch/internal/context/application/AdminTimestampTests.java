package com.wikiaov.patch.internal.context.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import tools.jackson.databind.json.JsonMapper;

class AdminTimestampTests {
    private final JsonMapper json = JsonMapper.builder().findAndAddModules().build();

    @Test
    void keepsThreeMillisecondDigitsForAnExactSecond() {
        assertThat(AdminTimestamp.format(Instant.parse("2026-01-01T02:03:04Z")))
                .isEqualTo("2026-01-01T02:03:04.000Z");
    }

    @Test
    void truncatesSubMillisecondPrecisionInsteadOfRoundingIt() {
        assertThat(AdminTimestamp.format(Instant.parse("2026-01-01T02:03:04.123999Z")))
                .isEqualTo("2026-01-01T02:03:04.123Z");
    }

    @Test
    void preservesAnUnknownTimestampAsJsonNull() {
        assertThat(AdminTimestamp.format(null)).isNull();
        assertThat(json.writeValueAsString(AdminTimestamp.format(null))).isEqualTo("null");
    }

    @ParameterizedTest
    @MethodSource("timestamps")
    void matchesTheFormerTimestampSerializer(Instant instant) {
        assertThat(json.writeValueAsString(AdminTimestamp.format(instant)))
                .isEqualTo(json.writeValueAsString(Timestamp.from(instant)));
    }

    private static Stream<Instant> timestamps() {
        return Stream.of(Instant.parse("2026-01-01T02:03:04Z"),
                Instant.parse("2026-01-01T02:03:04.123999Z"),
                Instant.parse("1969-12-31T23:59:59.999999Z"));
    }
}
