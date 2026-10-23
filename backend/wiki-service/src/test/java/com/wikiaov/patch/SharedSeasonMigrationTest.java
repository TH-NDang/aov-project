package com.wikiaov.patch;

import static org.assertj.core.api.Assertions.*;

import java.sql.DriverManager;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.postgresql.PostgreSQLContainer;

@EnabledIf("dockerAvailable")
class SharedSeasonMigrationTest {
    static boolean dockerAvailable() {
        return DockerClientFactory.instance().isDockerAvailable();
    }

    @Test
    void preservesExistingSeasonScheduleAndRulesetIdentity() throws Exception {
        try (var database = new PostgreSQLContainer("postgres:17.6")) {
            database.start();
            Flyway.configure().dataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword())
                    .target("11").load().migrate();
            UUID ruleset = UUID.randomUUID(), season = UUID.randomUUID();
            try (var connection = DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(),
                    database.getPassword())) {
                try (var insert = connection.prepareStatement(
                        "INSERT INTO patch.gameplay_ruleset(id,code,description,created_at) VALUES(?,'aov-vn','Original',now())")) {
                    insert.setObject(1, ruleset);
                    insert.executeUpdate();
                }
                try (var insert = connection.prepareStatement(
                        "INSERT INTO patch.ranked_season(id,region_id,code,display_name,starts_at,ends_at) SELECT ?,id,'2026-s4','S4 2026','2026-10-01T00:00:00Z','2027-01-01T00:00:00Z' FROM patch.region WHERE code='VN'")) {
                    insert.setObject(1, season);
                    assertThat(insert.executeUpdate()).isEqualTo(1);
                }
            }
            Flyway.configure().dataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword()).load()
                    .migrate();
            try (var connection = DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(),
                    database.getPassword()); var query = connection.createStatement()) {
                try (var rows = query.executeQuery("SELECT id,code FROM patch.gameplay_ruleset")) {
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getObject(1)).isEqualTo(ruleset);
                    assertThat(rows.getString(2)).isEqualTo("aov-standard");
                }
                try (var rows = query.executeQuery(
                        "SELECT s.id,s.ordinal,w.season_id FROM patch.ranked_season s JOIN patch.season_schedule w ON w.season_id=s.id")) {
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getObject(1)).isEqualTo(season);
                    assertThat(rows.getLong(2)).isEqualTo(1);
                    assertThat(rows.getObject(3)).isEqualTo(season);
                }
            }
        }
    }
}
