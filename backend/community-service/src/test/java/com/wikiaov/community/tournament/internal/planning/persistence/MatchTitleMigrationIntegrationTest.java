package com.wikiaov.community.tournament.internal.planning.persistence;

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

/** V019 turns the match names the schedule generators and Admin wrote into structured titles. */
@DockerBacked
class MatchTitleMigrationIntegrationTest {
    private static final UUID TOURNAMENT = UUID.randomUUID();
    private static final UUID GENERATED_SERIES = UUID.randomUUID();
    private static final UUID NAMED_SERIES = UUID.randomUUID();
    private static final String MATCHES = """
            [{"key":"G1","label":"Lượt 2 · Vòng 7","a":{"type":"TEAM"},"b":{"type":"TEAM"}},
             {"key":"P1","label":"Vòng 1 nhánh thua · 2","a":{"type":"SEED","seed":5},"b":{"type":"TEAM"}},
             {"key":"P2","label":"Chung kết tổng","a":{"type":"TEAM"},"b":{"type":"TEAM"}},
             {"key":"X1","label":"Trận bổ sung","a":{"type":"TBD","label":"Đội A"},"b":{"type":"TBD","label":"Đội B"}},
             {"key":"N1","label":"Opening match","a":{"type":"TBD","label":"Winner of group A"},"b":{"type":"TEAM"}},
             {"key":"N2","label":"Lượt 1 · Vòng 2 · BAC vs ANK","a":{"type":"TEAM"},"b":{"type":"TEAM"}}]""";
    private static final PostgreSQLContainer DATABASE = PostgresTestConfiguration.create();

    @BeforeAll
    static void migrateNamesWrittenBeforeV019() throws SQLException {
        DATABASE.start();
        flyway("18").migrate();

        execute("INSERT INTO tournament.tournament (id,version,code,name,content,created_at,updated_at,edited_by) "
                + "VALUES ('" + TOURNAMENT + "',0,'titled','Titled','{\"code\":\"titled\",\"name\":\"Titled\"}',"
                + "now(),now(),'import')");
        execute("INSERT INTO tournament.competition_plan (id,content,published_snapshot,updated_at,edited_by) VALUES ('"
                + TOURNAMENT + "','{\"matches\":" + MATCHES + "}','{\"plan\":{\"matches\":" + MATCHES + "}}',now(),"
                + "'import')");
        execute("INSERT INTO tournament.plan_revision (id,tournament_id,content,action,actor,created_at) VALUES ('"
                + UUID.randomUUID() + "','" + TOURNAMENT + "','{\"plan\":{\"matches\":" + MATCHES + "}}','SAVE',"
                + "'import',now())");
        series(GENERATED_SERIES, "Bán kết nhánh thắng 2");
        series(NAMED_SERIES, "Grand Final");

        flyway(null).migrate();
    }

    @AfterAll
    static void stop() {
        DATABASE.stop();
    }

    @Test
    void aGeneratedRoundRobinNameBecomesItsLegAndRound() throws SQLException {
        assertThat(match(0, "label")).isNull();
        assertThat(match(0, "title")).isEqualTo("{\"leg\": 2, \"kind\": \"ROUND_ROBIN\", \"round\": 7}");
    }

    @Test
    void aGeneratedBracketNameBecomesItsKindAndNumbers() throws SQLException {
        assertThat(match(1, "title")).isEqualTo("{\"kind\": \"LOWER_ROUND\", \"round\": 1, \"number\": 2}");
        assertThat(match(2, "title")).isEqualTo("{\"kind\": \"GRAND_FINAL\"}");
    }

    @Test
    void aMatchAdminAddedByHandLosesItsDefaultNames() throws SQLException {
        assertThat(match(3, "title")).isEqualTo("{\"kind\": \"EXTRA\"}");
        assertThat(match(3, "a")).isEqualTo("{\"type\": \"TBD\"}");
        assertThat(match(3, "b")).isEqualTo("{\"type\": \"TBD\"}");
    }

    @Test
    void aNameAnEditorTypedStaysAsItIs() throws SQLException {
        assertThat(match(4, "label")).isEqualTo("\"Opening match\"");
        assertThat(match(4, "title")).isNull();
        assertThat(match(4, "a")).isEqualTo("{\"type\": \"TBD\", \"label\": \"Winner of group A\"}");
        assertThat(match(5, "label")).isEqualTo("\"Lượt 1 · Vòng 2 · BAC vs ANK\"");
    }

    @Test
    void publishedSnapshotsAndRevisionsKeepTheNamesTheyWereTakenWith() throws SQLException {
        assertThat(read("SELECT published_snapshot #>> '{plan,matches,0,label}' FROM tournament.competition_plan"))
                .isEqualTo("Lượt 2 · Vòng 7");
        assertThat(read("SELECT content #>> '{plan,matches,0,label}' FROM tournament.plan_revision"))
                .isEqualTo("Lượt 2 · Vòng 7");
    }

    @Test
    void aSeriesWithAGeneratedNameTakesItsTitleAndNoName() throws SQLException {
        assertThat(read("SELECT (content -> 'title')::text FROM tournament.series WHERE id='" + GENERATED_SERIES
                + "'")).isEqualTo("{\"kind\": \"UPPER_SEMIFINAL\", \"number\": 2}");
        assertThat(read("SELECT coalesce(name, content ->> 'name', 'none') FROM tournament.series WHERE id='"
                + GENERATED_SERIES + "'")).isEqualTo("none");
    }

    @Test
    void aSeriesWithAnotherNameKeepsIt() throws SQLException {
        assertThat(read("SELECT name || '|' || (content ->> 'name') FROM tournament.series WHERE id='" + NAMED_SERIES
                + "'")).isEqualTo("Grand Final|Grand Final");
    }

    private static void series(UUID id, String name) throws SQLException {
        execute("INSERT INTO tournament.series (id,version,code,name,content,created_at,updated_at,edited_by) VALUES ('"
                + id + "',0,'series-" + id + "','" + name + "','{\"code\":\"series-" + id + "\",\"tournamentId\":\""
                + TOURNAMENT + "\",\"name\":\"" + name + "\",\"bestOf\":5}',now(),now(),'import')");
    }

    /** One field of a plan draft's match as JSON text, or null when the match has none. */
    private static String match(int index, String field) throws SQLException {
        return read("SELECT (content -> 'matches' -> " + index + " -> '" + field
                + "')::text FROM tournament.competition_plan");
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

    private static void execute(String sql) throws SQLException {
        try (var connection = DriverManager.getConnection(DATABASE.getJdbcUrl(), DATABASE.getUsername(),
                DATABASE.getPassword()); var statement = connection.createStatement()) {
            statement.execute(sql);
        }
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
