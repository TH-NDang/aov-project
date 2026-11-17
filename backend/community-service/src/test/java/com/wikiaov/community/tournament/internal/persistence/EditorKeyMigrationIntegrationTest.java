package com.wikiaov.community.tournament.internal.persistence;

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

/** V017 rewrites the editor keys stored with a bar into the two-line form of CommunityActor. */
@DockerBacked
class EditorKeyMigrationIntegrationTest {
    private static final String BAR_KEY = "https://identity.example|editor-subject";
    private static final String TWO_LINE_KEY = "https://identity.example\neditor-subject";
    private static final UUID TEAM = UUID.randomUUID();
    private static final UUID PLAYER = UUID.randomUUID();
    private static final UUID GAME = UUID.randomUUID();
    private static final PostgreSQLContainer DATABASE = PostgresTestConfiguration.create();

    @BeforeAll
    static void migrateRowsWrittenBeforeV017() throws SQLException {
        DATABASE.start();
        flyway("16").migrate();

        execute("INSERT INTO tournament.team (id,version,code,name,content,created_at,updated_at,edited_by,deleted_at,"
                + "deleted_by) VALUES ('" + TEAM + "',0,'bar-team','Bar team','{\"code\":\"bar-team\","
                + "\"name\":\"Bar team\"}',now(),now(),'" + BAR_KEY + "',now(),'" + BAR_KEY + "')");
        execute("INSERT INTO tournament.player (id,version,code,name,content,created_at,updated_at,edited_by) VALUES ('"
                + PLAYER + "',0,'line-player','Line player','{\"code\":\"line-player\",\"nickname\":\"Line\"}',now(),"
                + "now(),E'https://identity.example\\neditor-subject')");
        execute("INSERT INTO tournament.game (id,version,content,created_at,updated_at,edited_by) VALUES ('" + GAME
                + "',0,'{}',now(),now(),'import')");
        execute("INSERT INTO tournament.game_publication (id,game_id,published_at,actor,action,snapshot) VALUES ('"
                + UUID.randomUUID() + "','" + GAME + "',now(),'" + BAR_KEY + "','PUBLICATION','{}')");

        flyway(null).migrate();
    }

    @AfterAll
    static void stop() {
        DATABASE.stop();
    }

    @Test
    void anEditorKeyJoinedWithABarBecomesTheTwoLineKey() throws SQLException {
        assertThat(read("SELECT edited_by FROM tournament.team WHERE id='" + TEAM + "'")).isEqualTo(TWO_LINE_KEY);
    }

    @Test
    void theKeyOfWhoDeletedARecordTakesTheSameForm() throws SQLException {
        assertThat(read("SELECT deleted_by FROM tournament.team WHERE id='" + TEAM + "'")).isEqualTo(TWO_LINE_KEY);
    }

    @Test
    void thePublisherOfAGameTakesTheSameForm() throws SQLException {
        assertThat(read("SELECT actor FROM tournament.game_publication WHERE game_id='" + GAME + "'"))
                .isEqualTo(TWO_LINE_KEY);
    }

    @Test
    void aTwoLineKeyIsLeftAsItIs() throws SQLException {
        assertThat(read("SELECT edited_by FROM tournament.player WHERE id='" + PLAYER + "'")).isEqualTo(TWO_LINE_KEY);
    }

    @Test
    void aKeyWithoutABarIsLeftAsItIs() throws SQLException {
        assertThat(read("SELECT edited_by FROM tournament.game WHERE id='" + GAME + "'")).isEqualTo("import");
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
