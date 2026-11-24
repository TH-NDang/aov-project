package com.wikiaov.community.tournament.internal.planning.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class CompetitionSnapshotTest {
    private final JsonMapper json = JsonMapper.builder().build();

    @Test
    void aSnapshotStoredWithRealNamesAndBirthDatesReadsWithoutThem() {
        UUID player = UUID.randomUUID();
        var stored = "{\"players\":{\"" + player + "\":{\"code\":\"kaisa\",\"nickname\":\"Kaisa\",\"country\":\"VN\","
                + "\"fullName\":\"Private full name\",\"birthDate\":\"2002-03-04\",\"lane\":\"SUPPORT\"}}}";

        var snapshot = json.readValue(stored, CompetitionSnapshot.class);

        var read = snapshot.players().get(player);
        assertThat(read.nickname()).isEqualTo("Kaisa");
        assertThat(read.country()).isEqualTo("VN");
        assertThat(read.lane()).isNotNull();
        assertThat(json.writeValueAsString(snapshot)).doesNotContain("Private full name", "2002-03-04");
    }

    @Test
    void aSnapshotWithoutPlayersStaysReadable() {
        assertThat(json.readValue("{}", CompetitionSnapshot.class).players()).isNull();
    }
}
