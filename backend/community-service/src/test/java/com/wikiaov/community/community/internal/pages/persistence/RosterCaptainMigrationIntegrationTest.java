package com.wikiaov.community.community.internal.pages.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.community.testsupport.DockerBacked;
import com.wikiaov.community.testsupport.PostgresTestConfiguration;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** V021 gives the captain flag to roster members whose role marks a captain. */
@DockerBacked
class RosterCaptainMigrationIntegrationTest {
    private static final UUID TEAM_PAGE = UUID.randomUUID();
    private static final PostgreSQLContainer DATABASE = PostgresTestConfiguration.create();

    @BeforeAll
    static void migrateRostersWrittenBeforeV021() throws SQLException {
        DATABASE.start();
        flyway("20").migrate();

        String roster = """
                [{"name":"Jungler","role":"Đi rừng · Đội trưởng","lane":"JUNGLE"},
                 {"name":"Mid","role":"Mid | Captain"},
                 {"name":"Support","role":"Trợ thủ"},
                 {"name":"Rookie","role":"Co-captain"}]""";
        try (var connection = DriverManager.getConnection(DATABASE.getJdbcUrl(), DATABASE.getUsername(),
                DATABASE.getPassword()); var statement = connection.createStatement()) {
            statement.execute("INSERT INTO community.page (id,code,kind,content,published_content,updated_at) VALUES ('"
                    + TEAM_PAGE + "','captains','TEAM','{\"name\":\"Captains\",\"roster\":" + roster
                    + "}','{\"name\":\"Captains\",\"roster\":" + roster + "}',now())");
        }

        flyway(null).migrate();
    }

    @AfterAll
    static void stop() {
        DATABASE.stop();
    }

    @Test
    void aRoleThatMarksACaptainInVietnameseOrEnglishGivesTheFlag() throws SQLException {
        assertThat(captain("content", 0)).isEqualTo("true");
        assertThat(captain("content", 1)).isEqualTo("true");
        assertThat(captain("published_content", 0)).isEqualTo("true");
    }

    @Test
    void aRoleWithoutTheWordOnItsOwnGetsNoFlag() throws SQLException {
        assertThat(captain("content", 2)).isNull();
        assertThat(captain("content", 3)).isNull();
    }

    @Test
    void theRoleWordingStaysAsItWas() throws SQLException {
        assertThat(read("SELECT content -> 'roster' -> 0 ->> 'role' FROM community.page WHERE id='" + TEAM_PAGE + "'"))
                .isEqualTo("Đi rừng · Đội trưởng");
    }

    private static String captain(String column, int index) throws SQLException {
        return read("SELECT " + column + " -> 'roster' -> " + index + " ->> 'captain' FROM community.page WHERE id='"
                + TEAM_PAGE + "'");
    }

    private static Flyway flyway(String target) {
        var configuration = Flyway.configure()
                .dataSource(DATABASE.getJdbcUrl(), DATABASE.getUsername(), DATABASE.getPassword())
                .locations("classpath:db/migration");
        if (target != null) {
            configuration.target(target);
        }
        return configuration.load();
    }

    private static String read(String sql) throws SQLException {
        try (var connection = DriverManager.getConnection(DATABASE.getJdbcUrl(), DATABASE.getUsername(),
                DATABASE.getPassword());
                var statement = connection.createStatement();
                var result = statement.executeQuery(sql)) {
            assertThat(result.next()).isTrue();
            return result.getString(1);
        }
    }
}
