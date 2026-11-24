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

/** V026 takes the pictures of people out of every stored document and leaves those of teams and organizations. */
@DockerBacked
class PeoplePicturesMigrationIntegrationTest {
    private static final String PICTURE = "https://img.example.test/assets/people.png";
    private static final String LOGO = "https://img.example.test/assets/logo.png";
    private static final UUID PLAYER = UUID.randomUUID();
    private static final UUID PERSON = UUID.randomUUID();
    private static final UUID TEAM = UUID.randomUUID();
    private static final UUID TOURNAMENT = UUID.randomUUID();
    private static final PostgreSQLContainer DATABASE = PostgresTestConfiguration.create();

    @BeforeAll
    static void migratePicturesWrittenBeforeV026() throws SQLException {
        DATABASE.start();
        flyway("25").migrate();

        execute("INSERT INTO tournament.player (id,version,code,name,content,created_at,updated_at,edited_by) VALUES ('"
                + PLAYER + "',0,'pictured','Pictured','{\"code\":\"pictured\",\"nickname\":\"Pictured\",\"photoUrl\":\""
                + PICTURE + "\"}',now(),now(),'import')");
        page(PERSON, "PERSON", null);
        page(TEAM, "TEAM", TEAM);
        execute("INSERT INTO tournament.tournament (id,version,code,name,content,created_at,updated_at,edited_by) "
                + "VALUES ('" + TOURNAMENT + "',0,'picture-cup','Picture cup','{\"code\":\"picture-cup\",\"name\":"
                + "\"Picture cup\",\"region\":\"VN\"}',now(),now(),'import')");
        String snapshot = "{\"players\":{\"" + PLAYER + "\":{\"nickname\":\"Pictured\",\"photoUrl\":\"" + PICTURE
                + "\"}},\"people\":{\"" + PERSON + "\":{\"name\":\"Caster\",\"avatarUrl\":\"" + PICTURE
                + "\"}},\"teams\":{\"" + TEAM + "\":{\"name\":\"Team\",\"logoUrl\":\"" + LOGO + "\"}}}";
        execute("INSERT INTO tournament.competition_plan (id,version,content,published_snapshot,published_at,updated_at,"
                + "edited_by) VALUES ('" + TOURNAMENT + "',0,'{}','" + snapshot + "',now(),now(),'import')");

        flyway(null).migrate();
    }

    @AfterAll
    static void stop() {
        DATABASE.stop();
    }

    @Test
    void aPlayerKeepsNoPhoto() throws SQLException {
        assertThat(value("SELECT content->>'photoUrl' FROM tournament.player WHERE id='" + PLAYER + "'")).isNull();
    }

    @Test
    void aPersonPageKeepsNoPictureInDraftOrPublication() throws SQLException {
        assertThat(value("SELECT concat(content->>'avatarUrl', content->>'coverUrl', published_content->>'avatarUrl') "
                + "FROM community.page WHERE id='" + PERSON + "'")).isEmpty();
    }

    @Test
    void aTeamPageKeepsItsLogo() throws SQLException {
        assertThat(value("SELECT content->>'avatarUrl' FROM community.page WHERE id='" + TEAM + "'"))
                .isEqualTo(PICTURE);
    }

    @Test
    void aPublishedSnapshotLosesThePicturesOfPeopleAndKeepsTheLogosOfTeams() throws SQLException {
        String snapshot = value("SELECT published_snapshot::text FROM tournament.competition_plan WHERE id='"
                + TOURNAMENT + "'");

        assertThat(snapshot).doesNotContain(PICTURE).contains(LOGO, "Pictured", "Caster");
    }

    private static void page(UUID id, String kind, UUID entity) throws SQLException {
        String content = "{\"name\":\"Page\",\"avatarUrl\":\"" + PICTURE + "\",\"coverUrl\":\"" + PICTURE + "\"}";
        execute("INSERT INTO community.page (id,code,kind,entity_id,content,published_content,updated_at) VALUES ('"
                + id + "','" + kind.toLowerCase(java.util.Locale.ROOT) + "-pictured','" + kind + "',"
                + (entity == null ? "NULL" : "'" + entity + "'") + ",'" + content + "','" + content + "',now())");
    }

    private static Flyway flyway(String target) {
        var configuration = Flyway.configure()
                .dataSource(DATABASE.getJdbcUrl(), DATABASE.getUsername(), DATABASE.getPassword())
                .locations("classpath:db/migration");
        return target == null ? configuration.load() : configuration.target(target).load();
    }

    private static void execute(String sql) throws SQLException {
        try (var connection = DriverManager.getConnection(DATABASE.getJdbcUrl(), DATABASE.getUsername(),
                DATABASE.getPassword()); var statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private static String value(String sql) throws SQLException {
        try (var connection = DriverManager.getConnection(DATABASE.getJdbcUrl(), DATABASE.getUsername(),
                DATABASE.getPassword());
                var statement = connection.createStatement();
                var rows = statement.executeQuery(sql)) {
            assertThat(rows.next()).isTrue();
            return rows.getString(1);
        }
    }
}
