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

/** V020 gives team roster members lane and standing codes from their wording or their linked player. */
@DockerBacked
class RosterCodesMigrationIntegrationTest {
    private static final UUID TEAM = UUID.randomUUID();
    private static final UUID PLAYER = UUID.randomUUID();
    private static final UUID TOURNAMENT = UUID.randomUUID();
    private static final UUID TEAM_PAGE = UUID.randomUUID();
    private static final UUID PLAYER_PAGE = UUID.randomUUID();
    private static final PostgreSQLContainer DATABASE = PostgresTestConfiguration.create();

    @BeforeAll
    static void migrateRostersWrittenBeforeV020() throws SQLException {
        DATABASE.start();
        flyway("19").migrate();

        execute("INSERT INTO tournament.team (id,version,code,name,content,created_at,updated_at,edited_by) VALUES ('"
                + TEAM + "',0,'coded-team','Coded team','{\"code\":\"coded-team\",\"name\":\"Coded team\"}',now(),"
                + "now(),'import')");
        execute("INSERT INTO tournament.player (id,version,code,name,content,created_at,updated_at,edited_by) VALUES ('"
                + PLAYER + "',0,'mid-player','Mid','{\"code\":\"mid-player\",\"nickname\":\"Mid\",\"lane\":\"MID\"}',"
                + "now(),now(),'import')");
        execute("INSERT INTO tournament.tournament (id,version,code,name,content,created_at,updated_at,edited_by) "
                + "VALUES ('" + TOURNAMENT + "',0,'roster-cup','Roster cup','{\"code\":\"roster-cup\",\"name\":"
                + "\"Roster cup\",\"region\":\"VN\",\"startsOn\":\"2026-01-01\",\"endsOn\":\"2026-01-31\"}',now(),"
                + "now(),'import')");
        execute("INSERT INTO tournament.roster_membership (id,version,tournament_id,team_id,player_id,content,"
                + "created_at,updated_at,edited_by) VALUES ('" + UUID.randomUUID() + "',0,'" + TOURNAMENT + "','"
                + TEAM + "','" + PLAYER + "','{\"tournamentId\":\"" + TOURNAMENT + "\",\"teamId\":\"" + TEAM
                + "\",\"playerId\":\"" + PLAYER + "\",\"status\":\"SUBSTITUTE\"}',now(),now(),'import')");
        execute("INSERT INTO community.page (id,code,kind,entity_id,content,updated_at) VALUES ('" + PLAYER_PAGE
                + "','mid-page','PLAYER','" + PLAYER + "','{\"name\":\"Mid\"}',now())");
        String roster = """
                [{"name":"Jungler","role":"Đi rừng · Đội trưởng","status":"Chính thức · AOG Winter 2026"},
                 {"name":"Coach","role":"Huấn luyện viên"},
                 {"name":"Trialist","role":"Đường giữa","status":"Thử việc"},
                 {"name":"Mid","pageId":"%s","role":"Tuyển thủ"},
                 {"name":"Former","role":"Support","status":"Đã rời đội trong mùa"},
                 {"name":"Coded","role":"Đi rừng","lane":"TOP","standing":"ACTIVE"}]""".formatted(PLAYER_PAGE);
        execute("INSERT INTO community.page (id,code,kind,entity_id,content,published_content,updated_at) VALUES ('"
                + TEAM_PAGE + "','coded-team-page','TEAM','" + TEAM + "','{\"name\":\"Coded team\",\"roster\":"
                + roster + "}','{\"name\":\"Coded team\",\"roster\":" + roster + "}',now())");

        flyway(null).migrate();
    }

    @AfterAll
    static void stop() {
        DATABASE.stop();
    }

    @Test
    void aLaneAndAStandingTheWordingNamesBecomeCodes() throws SQLException {
        assertThat(code("content", 0, "lane")).isEqualTo("JUNGLE");
        assertThat(code("content", 0, "standing")).isEqualTo("ACTIVE");
        assertThat(code("content", 4, "lane")).isEqualTo("SUPPORT");
        assertThat(code("content", 4, "standing")).isEqualTo("LEFT");
    }

    @Test
    void aCoachIsStaffAndPlaysNoLane() throws SQLException {
        assertThat(code("content", 1, "standing")).isEqualTo("STAFF");
        assertThat(code("content", 1, "lane")).isNull();
    }

    @Test
    void aStatusThatNamesNoStandingIsNotGuessed() throws SQLException {
        assertThat(code("content", 2, "lane")).isEqualTo("MID");
        assertThat(code("content", 2, "standing")).isNull();
    }

    @Test
    void aLinkedPlayerGivesHisLaneAndHisLatestRosterLineWithTheTeamWhenTheWordingSaysNothing() throws SQLException {
        assertThat(code("content", 3, "lane")).isEqualTo("MID");
        assertThat(code("content", 3, "standing")).isEqualTo("SUBSTITUTE");
    }

    @Test
    void codesAlreadyStoredAndTheWordingStayAsTheyWere() throws SQLException {
        assertThat(code("content", 5, "lane")).isEqualTo("TOP");
        assertThat(code("content", 0, "role")).isEqualTo("Đi rừng · Đội trưởng");
        assertThat(code("content", 0, "status")).isEqualTo("Chính thức · AOG Winter 2026");
    }

    @Test
    void thePublishedRosterIsFilledLikeTheDraft() throws SQLException {
        assertThat(code("published_content", 0, "lane")).isEqualTo("JUNGLE");
        assertThat(code("published_content", 3, "standing")).isEqualTo("SUBSTITUTE");
    }

    /** One text field of a member of the team page's roster, in its draft or its published content. */
    private static String code(String column, int index, String field) throws SQLException {
        return read(
                "SELECT " + column + " -> 'roster' -> " + index + " ->> '" + field + "' FROM community.page WHERE id='"
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
