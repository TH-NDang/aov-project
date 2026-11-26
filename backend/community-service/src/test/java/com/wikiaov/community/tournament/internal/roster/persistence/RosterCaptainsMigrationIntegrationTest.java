package com.wikiaov.community.tournament.internal.roster.persistence;

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

/**
 * V028 marks the captains of tournament rosters: the players Liquipedia names captain on the tournament's page, and the
 * lines whose note the import gave the captain's sentence.
 */
@DockerBacked
class RosterCaptainsMigrationIntegrationTest {
    private static final UUID WINTER = UUID.randomUUID();
    private static final UUID CITIES = UUID.randomUUID();
    private static final UUID ELSEWHERE = UUID.randomUUID();
    private static final UUID FLASH = UUID.randomUUID();
    private static final UUID FPT = UUID.randomUUID();
    private static final UUID NOTED = UUID.randomUUID();
    private static final UUID ACCENTED = UUID.randomUUID();
    private static final UUID LINKED = UUID.randomUUID();
    private static final UUID TWICE_FLASH = UUID.randomUUID();
    private static final UUID TWICE_FPT = UUID.randomUUID();
    private static final UUID PLAIN = UUID.randomUUID();
    private static final UUID ALIASED = UUID.randomUUID();
    private static final UUID MIXED_NOTE = UUID.randomUUID();
    private static final String SOURCE = "https://liquipedia.net/honorofkings/";
    private static final PostgreSQLContainer DATABASE = PostgresTestConfiguration.create();

    @BeforeAll
    static void migrateRostersWrittenBeforeV028() throws SQLException {
        DATABASE.start();
        flyway("27").migrate();

        tournament(WINTER, SOURCE + "Arena_of_Glory/2026/Winter");
        tournament(CITIES, SOURCE + "T%E1%BB%A9_Ph%C6%B0%C6%A1ng_%C4%90%E1%BA%A1i_Chi%E1%BA%BFn/2026/Winter/");
        tournament(ELSEWHERE, SOURCE + "Other_Cup/2026");
        team(FLASH);
        team(FPT);
        line(NOTED, WINTER, FLASH, player("Yutan", "yutan", "[]"), "\"Đội trưởng.\"");
        line(ACCENTED, WINTER, FPT, player("Vịt", "vit", "[]"), "null");
        line(LINKED, WINTER, FPT, player("Cá", "fish-ca", "[]"), "null");
        UUID boka = player("Boka", "boka", "[]");
        line(TWICE_FLASH, WINTER, FLASH, boka, "null");
        line(TWICE_FPT, WINTER, FPT, boka, "null");
        line(PLAIN, WINTER, FLASH, player("Other", "other", "[]"), "\"Liquipedia nối tên này tới «X».\"");
        line(ALIASED, CITIES, FLASH, player("NJ", "nj", "[\"Njunn\"]"), "null");
        line(MIXED_NOTE, ELSEWHERE, FLASH, player("Quiet", "quiet", "[]"),
                "\"Có tên trong đội hình nhưng không thi đấu. Đội trưởng. Liquipedia nối tên.\"");
        execute("INSERT INTO tournament.competition_plan (id,version,content,published_snapshot,published_at,"
                + "updated_at,edited_by) SELECT '" + WINTER
                + "',0,'{}',jsonb_build_object('teams','{\"kept\":1}'::jsonb,"
                + "'rosters',jsonb_agg(content ORDER BY id)),now(),now(),'import' FROM tournament.roster_membership "
                + "WHERE id IN ('" + NOTED + "','" + PLAIN + "')");
        execute("INSERT INTO tournament.competition_plan (id,version,content,published_snapshot,published_at,"
                + "updated_at,edited_by) VALUES ('" + ELSEWHERE + "',0,'{}','{\"rosters\":[]}',now(),now(),'import')");

        flyway(null).migrate();
    }

    @AfterAll
    static void stop() {
        DATABASE.stop();
    }

    @Test
    void aCaptainLiquipediaNamesIsFoundByNameAccentsAsideByLinkedPageOrByAlias() throws SQLException {
        assertThat(captain(ACCENTED)).isEqualTo("true");
        assertThat(captain(LINKED)).isEqualTo("true");
        assertThat(captain(ALIASED)).isEqualTo("true");
        assertThat(value("SELECT CAST(version AS text) FROM tournament.roster_membership WHERE id='" + ACCENTED + "'"))
                .isEqualTo("1");
    }

    @Test
    void aNameTwoLinesOfTheTournamentGoByMarksNoOne() throws SQLException {
        assertThat(captain(TWICE_FLASH)).isNull();
        assertThat(captain(TWICE_FPT)).isNull();
        assertThat(captain(PLAIN)).isNull();
    }

    @Test
    void theSentenceOfTheImportBecomesTheFlagAndLeavesTheNote() throws SQLException {
        assertThat(captain(NOTED)).isEqualTo("true");
        assertThat(note(NOTED)).isNull();
        assertThat(captain(MIXED_NOTE)).isEqualTo("true");
        assertThat(note(MIXED_NOTE)).isEqualTo("Có tên trong đội hình nhưng không thi đấu. Liquipedia nối tên.");
        assertThat(note(PLAIN)).isEqualTo("Liquipedia nối tên này tới «X».");
    }

    @Test
    void thePublishedSnapshotCopiesTheCaptainAndKeepsTheRest() throws SQLException {
        String snapshot = "SELECT published_snapshot FROM tournament.competition_plan WHERE id='" + WINTER + "'";

        assertThat(value("SELECT CAST(jsonb_array_length(published_snapshot->'rosters') AS text) FROM "
                + "tournament.competition_plan WHERE id='" + WINTER + "'")).isEqualTo("2");
        assertThat(value("SELECT string_agg(coalesce(entry->>'captain','-') || ':' || coalesce(entry->>'note','-'), "
                + "'|' ORDER BY entry->>'playerId') FROM (" + snapshot + ") plan, "
                + "jsonb_array_elements(plan.published_snapshot->'rosters') entry")).contains("true:-");
        assertThat(value("SELECT published_snapshot->'teams'->>'kept' FROM tournament.competition_plan WHERE id='"
                + WINTER + "'")).isEqualTo("1");
        assertThat(value("SELECT CAST(published_snapshot AS text) FROM tournament.competition_plan WHERE id='"
                + ELSEWHERE + "'")).isEqualTo("{\"rosters\": []}");
    }

    private static String captain(UUID line) throws SQLException {
        return value("SELECT content->>'captain' FROM tournament.roster_membership WHERE id='" + line + "'");
    }

    private static String note(UUID line) throws SQLException {
        return value("SELECT content->>'note' FROM tournament.roster_membership WHERE id='" + line + "'");
    }

    private static void tournament(UUID id, String sourceUrl) throws SQLException {
        execute("INSERT INTO tournament.tournament (id,version,code,name,content,created_at,updated_at,edited_by) "
                + "VALUES ('" + id + "',0,'cup-" + id + "','Cup','{\"code\":\"cup-" + id + "\",\"name\":\"Cup\","
                + "\"sourceUrl\":\"" + sourceUrl + "\"}',now(),now(),'import')");
    }

    private static void team(UUID id) throws SQLException {
        execute("INSERT INTO tournament.team (id,version,code,name,content,created_at,updated_at,edited_by) VALUES ('"
                + id + "',0,'team-" + id + "','Team','{\"code\":\"team-" + id + "\",\"name\":\"Team\"}',now(),now(),"
                + "'import')");
    }

    private static UUID player(String nickname, String code, String aliases) throws SQLException {
        var id = UUID.randomUUID();
        execute("INSERT INTO tournament.player (id,version,code,name,content,created_at,updated_at,edited_by) VALUES ('"
                + id + "',0,'" + code + "','" + nickname + "','{\"code\":\"" + code + "\",\"nickname\":\"" + nickname
                + "\",\"aliases\":" + aliases + "}',now(),now(),'import')");
        return id;
    }

    private static void line(UUID id, UUID tournament, UUID team, UUID player, String note) throws SQLException {
        execute("INSERT INTO tournament.roster_membership (id,version,tournament_id,team_id,player_id,content,"
                + "created_at,updated_at,edited_by) VALUES ('" + id + "',0,'" + tournament + "','" + team + "','"
                + player + "','{\"tournamentId\":\"" + tournament + "\",\"teamId\":\"" + team + "\",\"playerId\":\""
                + player + "\",\"status\":\"ACTIVE\",\"note\":" + note + "}',now(),now(),'import')");
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
