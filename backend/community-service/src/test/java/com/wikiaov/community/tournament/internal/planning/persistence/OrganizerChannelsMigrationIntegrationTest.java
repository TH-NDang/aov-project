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

/**
 * V027 moves the tournaments the publisher page "garena" organized to the page of the YouTube channel each one links
 * to, and deletes the publisher's page once nothing names it.
 */
@DockerBacked
class OrganizerChannelsMigrationIntegrationTest {
    private static final UUID GARENA = UUID.randomUUID();
    private static final UUID VIETNAM_CHANNEL = UUID.randomUUID();
    private static final UUID THAILAND_CHANNEL = UUID.randomUUID();
    private static final UUID TENCENT = UUID.randomUUID();
    private static final UUID PUBLISHED = UUID.randomUUID();
    private static final UUID THAI_DRAFT = UUID.randomUUID();
    private static final UUID GLOBAL_DRAFT = UUID.randomUUID();
    private static final UUID OTHER_ORGANIZER = UUID.randomUUID();
    private static final UUID WITHOUT_CHANNEL = UUID.randomUUID();
    private static final String VIETNAM_URL = "https://www.youtube.com/@LienQuanMobileSportsGarena";
    private static final String THAILAND_URL = "https://www.youtube.com/channel/UCy19QXxbCHh8qVVCbuGk-ig";
    private static final String GLOBAL_URL = "https://www.youtube.com/channel/UCgYkGvtBuY4onYm2Eh61zwQ";
    private static final String LOGO = "https://img.example.test/assets/channel.jpg";
    private static final PostgreSQLContainer DATABASE = PostgresTestConfiguration.create();
    private static String moved;
    private static String kept;

    @BeforeAll
    static void migrateTournamentsOfThePublisher() throws SQLException {
        DATABASE.start();
        moved = DATABASE.getJdbcUrl();
        execute(moved, "CREATE DATABASE kept");
        kept = moved.replace("/" + DATABASE.getDatabaseName(), "/kept");

        flyway(moved, "26").migrate();
        publisherAndChannels(moved);
        competition(moved, PUBLISHED, GARENA, "Garena", true, link("YouTube", VIETNAM_URL));
        competition(moved, THAI_DRAFT, GARENA, "Garena", false, link("YouTube", THAILAND_URL + "/"));
        competition(moved, GLOBAL_DRAFT, GARENA, "Garena", false, link("YouTube", GLOBAL_URL + "/live"));
        competition(moved, OTHER_ORGANIZER, TENCENT, "Tencent Games", false, link("YouTube", GLOBAL_URL));
        flyway(moved, null).migrate();

        flyway(kept, "26").migrate();
        publisherAndChannels(kept);
        competition(kept, WITHOUT_CHANNEL, GARENA, "Garena", false, link("Website", "https://example.test/cup"));
        flyway(kept, null).migrate();
    }

    @AfterAll
    static void stop() {
        DATABASE.stop();
    }

    @Test
    void aPublishedTournamentNamesItsChannelInDraftSnapshotAndHistory() throws SQLException {
        String plan = "FROM tournament.competition_plan WHERE id='" + PUBLISHED + "'";

        assertThat(value(moved, "SELECT content->>'organizerPageId' " + plan)).isEqualTo(VIETNAM_CHANNEL.toString());
        assertThat(value(moved, "SELECT CAST(organizer_page_id AS text) " + plan))
                .isEqualTo(VIETNAM_CHANNEL.toString());
        assertThat(value(moved, "SELECT content->>'organizer' " + plan)).isEqualTo("Vietnam channel");
        assertThat(value(moved, "SELECT CAST(version AS text) " + plan)).isEqualTo("1");
        assertThat(value(moved, "SELECT published_snapshot->'plan'->>'organizerPageId' " + plan))
                .isEqualTo(VIETNAM_CHANNEL.toString());
        assertThat(value(moved, "SELECT published_snapshot->'organizer'->>'name' " + plan))
                .isEqualTo("Vietnam channel");
        assertThat(value(moved, "SELECT published_snapshot->'organizer'->>'logoUrl' " + plan)).isEqualTo(LOGO);
        assertThat(value(moved, "SELECT published_snapshot->'organizer'->>'code' " + plan)).isEqualTo("vietnam");
        assertThat(value(moved, "SELECT published_snapshot->'teams'->>'kept' " + plan)).isEqualTo("yes");
        assertThat(value(moved, "SELECT string_agg(content->'organizer'->>'id', ',') FROM tournament.plan_revision "
                + "WHERE tournament_id='" + PUBLISHED + "'")).isEqualTo(VIETNAM_CHANNEL.toString());
    }

    @Test
    void aChannelAddressWithASlashOrATabStillNamesItsPage() throws SQLException {
        assertThat(value(moved, "SELECT content->>'organizerPageId' FROM tournament.competition_plan WHERE id='"
                + THAI_DRAFT + "'")).isEqualTo(THAILAND_CHANNEL.toString());
    }

    @Test
    void theGlobalChannelGetsADraftPageThatItsTournamentNames() throws SQLException {
        String channel = value(moved, "SELECT CAST(id AS text) FROM community.page WHERE code='arena-of-valor' "
                + "AND kind='ORGANIZATION' AND published_content IS NULL AND content->'links'->0->>'url'='"
                + GLOBAL_URL + "'");

        assertThat(value(moved, "SELECT content->>'organizerPageId' FROM tournament.competition_plan WHERE id='"
                + GLOBAL_DRAFT + "'")).isEqualTo(channel);
    }

    @Test
    void anotherOrganizerKeepsItsTournament() throws SQLException {
        assertThat(value(moved, "SELECT content->>'organizerPageId' FROM tournament.competition_plan WHERE id='"
                + OTHER_ORGANIZER + "'")).isEqualTo(TENCENT.toString());
    }

    @Test
    void thePublisherPageIsDeletedWithItsAudit() throws SQLException {
        assertThat(value(moved, "SELECT CAST(count(*) AS text) FROM community.page WHERE id='" + GARENA + "'"))
                .isEqualTo("0");
        assertThat(value(moved, "SELECT CAST(count(*) AS text) FROM community.page_audit WHERE page_id='" + GARENA
                + "'")).isEqualTo("0");
    }

    @Test
    void aTournamentWithoutAChannelKeepsThePublisherAndItsPage() throws SQLException {
        assertThat(value(kept, "SELECT content->>'organizerPageId' FROM tournament.competition_plan WHERE id='"
                + WITHOUT_CHANNEL + "'")).isEqualTo(GARENA.toString());
        assertThat(value(kept, "SELECT code FROM community.page WHERE id='" + GARENA + "'")).isEqualTo("garena");
        assertThat(value(kept, "SELECT CAST(count(*) AS text) FROM community.page WHERE code='arena-of-valor'"))
                .isEqualTo("0");
    }

    private static void publisherAndChannels(String url) throws SQLException {
        page(url, GARENA, "garena", "{\"name\":\"Garena\",\"links\":[" + link("Website", "https://www.garena.sg")
                + "]}", true);
        execute(url, "INSERT INTO community.page_audit (id,page_id,actor,action,occurred_at) VALUES ('"
                + UUID.randomUUID() + "','" + GARENA + "','import','PAGE_PUBLISHED',now())");
        page(url, VIETNAM_CHANNEL, "vietnam", "{\"name\":\"Vietnam channel\",\"avatarUrl\":\"" + LOGO
                + "\",\"links\":[" + link("YouTube", VIETNAM_URL) + "]}", true);
        page(url, THAILAND_CHANNEL, "thailand", "{\"name\":\"Thailand channel\",\"links\":["
                + link("Facebook", "https://www.facebook.com/ROVTH/") + "," + link("YouTube", THAILAND_URL) + "]}",
                true);
        page(url, TENCENT, "tencent", "{\"name\":\"Tencent Games\",\"links\":[]}", false);
    }

    private static void competition(String url, UUID id, UUID organizer, String name, boolean published,
            String links) throws SQLException {
        execute(url, "INSERT INTO tournament.tournament (id,version,code,name,content,created_at,updated_at,edited_by) "
                + "VALUES ('" + id + "',0,'cup-" + id + "','Cup','{\"code\":\"cup-" + id + "\",\"name\":\"Cup\","
                + "\"links\":[" + links + "]}',now(),now(),'import')");
        String plan = "{\"organizer\":\"" + name + "\",\"organizerPageId\":\"" + organizer + "\"}";
        String snapshot = "{\"plan\":" + plan + ",\"organizer\":{\"id\":\"" + organizer + "\",\"code\":\"org\","
                + "\"name\":\"" + name + "\",\"logoUrl\":null,\"published\":true},\"teams\":{\"kept\":\"yes\"}}";
        execute(url, "INSERT INTO tournament.competition_plan (id,version,content,published_snapshot,published_at,"
                + "updated_at,edited_by) VALUES ('" + id + "',0,'" + plan + "',"
                + (published ? "'" + snapshot + "',now()" : "NULL,NULL") + ",now(),'import')");
        execute(url, "INSERT INTO tournament.plan_revision (id,tournament_id,content,action,actor,created_at) VALUES ('"
                + UUID.randomUUID() + "','" + id + "','" + snapshot + "','" + (published ? "PUBLISH" : "SAVE")
                + "','import',now())");
    }

    private static void page(String url, UUID id, String code, String content, boolean published)
            throws SQLException {
        execute(url, "INSERT INTO community.page (id,code,kind,content,published_content,published_at,updated_at) "
                + "VALUES ('" + id + "','" + code + "','ORGANIZATION','" + content + "',"
                + (published ? "'" + content + "',now()" : "NULL,NULL") + ",now())");
    }

    private static String link(String label, String url) {
        return "{\"label\":\"" + label + "\",\"url\":\"" + url + "\"}";
    }

    private static Flyway flyway(String url, String target) {
        var configuration = Flyway.configure()
                .dataSource(url, DATABASE.getUsername(), DATABASE.getPassword())
                .locations("classpath:db/migration");
        return target == null ? configuration.load() : configuration.target(target).load();
    }

    private static void execute(String url, String sql) throws SQLException {
        try (var connection = DriverManager.getConnection(url, DATABASE.getUsername(), DATABASE.getPassword());
                var statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private static String value(String url, String sql) throws SQLException {
        try (var connection = DriverManager.getConnection(url, DATABASE.getUsername(), DATABASE.getPassword());
                var statement = connection.createStatement();
                var rows = statement.executeQuery(sql)) {
            assertThat(rows.next()).isTrue();
            return rows.getString(1);
        }
    }
}
