package com.wikiaov.hero.internal.web;

import static org.assertj.core.api.Assertions.*;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** ADR-024: V061 turns the two Flowborn heroes into forms of one published hero without touching their history. */
@EnabledIf("dockerAvailable")
class FlowbornFormsMigrationTest {
    private static final UUID FLOWBORN = UUID.fromString("1bca4c6c-88a3-476c-a3aa-4bb206837745");

    static boolean dockerAvailable() {
        return DockerClientFactory.instance().isDockerAvailable();
    }

    @Test
    void createsOnePublishedHeroHoldingBothFormsAndKeepsTheirHistory() throws Exception {
        try (var database = new PostgreSQLContainer("postgres:17.6")) {
            database.start();
            Flyway.configure().dataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword())
                    .target("59").load().migrate();
            UUID ruleset = UUID.randomUUID(), first = UUID.randomUUID(), second = UUID.randomUUID();
            UUID ad = UUID.randomUUID(), mid = UUID.randomUUID();
            UUID oldHead = UUID.randomUUID(), head = UUID.randomUUID(), portrait = UUID.randomUUID(),
                    splash = UUID.randomUUID();
            try (var c = connect(database)) {
                c.createStatement().execute("INSERT INTO patch.gameplay_ruleset VALUES('" + ruleset
                        + "','aov-standard','Standard','ACTIVE',now())");
                variant(c, ruleset, first, "patch-one", 1);
                variant(c, ruleset, second, "patch-two", 2);
                c.createStatement().execute("INSERT INTO hero.hero VALUES('" + ad
                        + "','flowborn-ad',now(),'test','editor'),('" + mid
                        + "','flowborn-mid',now(),'test','editor')");
                revision(c, ad, ruleset, first, 1, "PUBLISHED", "Old title", "Old lore", oldHead, portrait, splash);
                revision(c, ad, ruleset, second, 2, "PUBLISHED", "Hậu duệ Khởi Nguyên", "Truyện", head, portrait,
                        splash);
                revision(c, ad, ruleset, second, 3, "DRAFT", "Draft title", null, head, portrait, splash);
                revision(c, mid, ruleset, second, 1, "DRAFT", "Hậu Duệ Khởi Nguyên", null, head, portrait, splash);
            }

            Flyway.configure().dataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword())
                    .load().migrate();

            try (var c = connect(database); var q = c.createStatement()) {
                assertThat(rows(c, "SELECT code FROM hero.hero WHERE id='" + FLOWBORN + "'"))
                        .containsExactly(List.of("flowborn"));
                assertThat(rows(c, "SELECT revision_no, state, cause, publication_sequence, "
                        + "effective_from_patch_variant_id FROM hero.hero_revision WHERE hero_id='" + FLOWBORN + "'"))
                        .containsExactly(List.of(1L, "PUBLISHED", "DATA_BASELINE", 1L, first));
                assertThat(rows(c, "SELECT t.locale, t.name, t.title, t.summary, t.lore FROM hero.hero_revision r "
                        + "JOIN hero.hero_profile_translation t ON t.profile_revision_id = r.profile_revision_id "
                        + "WHERE r.hero_id='" + FLOWBORN + "'"))
                        .containsExactly(Arrays.asList("vi-VN", "Flowborn", "Hậu duệ Khởi Nguyên", null, "Truyện"));
                assertThat(rows(c, "SELECT b.media_role, b.asset_id FROM hero.hero_revision r "
                        + "JOIN hero.hero_media_binding b ON b.media_binding_revision_id = r.media_binding_revision_id "
                        + "WHERE r.hero_id='" + FLOWBORN + "' ORDER BY b.media_role"))
                        .containsExactly(List.of("HEAD", head), List.of("PORTRAIT", portrait),
                                List.of("SPLASH", splash));
                assertThat(rows(c, "SELECT count(*) FROM hero.hero_profile_role r JOIN hero.hero_revision h "
                        + "ON h.profile_revision_id = r.profile_revision_id WHERE h.hero_id='" + FLOWBORN + "'"))
                        .containsExactly(List.of(0L));
                assertThat(
                        rows(c, "SELECT hero_id, form_key, display_order FROM hero.hero_form ORDER BY display_order"))
                        .containsExactly(List.of(ad, "ad", 1), List.of(mid, "mid", 2));
                assertThat(rows(c, "SELECT h.code, e.provider, e.external_value FROM hero.hero_external_identity e "
                        + "JOIN hero.hero h ON h.id = e.hero_id ORDER BY 1, 2"))
                        .containsExactly(List.of("flowborn-ad", "garena-vn", "flowborn"),
                                List.of("flowborn-ad", "liquipedia", "Flowborn/Marksman"),
                                List.of("flowborn-mid", "garena-vn", "flowborn-2"),
                                List.of("flowborn-mid", "liquipedia", "Flowborn/Mage"));
                assertThat(rows(c, "SELECT epoch FROM platform.catalog_cache_epoch")).containsExactly(List.of(2L));
                assertThat(rows(c, "SELECT h.code, r.state, count(*) FROM hero.hero_revision r "
                        + "JOIN hero.hero h ON h.id = r.hero_id WHERE h.code LIKE 'flowborn-%' GROUP BY 1, 2 ORDER BY 1, 2"))
                        .containsExactly(List.of("flowborn-ad", "DRAFT", 1L), List.of("flowborn-ad", "PUBLISHED", 2L),
                                List.of("flowborn-mid", "DRAFT", 1L));

                assertThatThrownBy(() -> q.execute("UPDATE hero.hero_profile_translation SET name='Tampered' "
                        + "WHERE profile_revision_id = (SELECT profile_revision_id FROM hero.hero_revision "
                        + "WHERE hero_id='" + FLOWBORN + "')")).isInstanceOf(SQLException.class)
                        .hasMessageContaining("immutable");
                assertThatThrownBy(() -> q.execute("UPDATE hero.hero_form SET form_key='marksman' WHERE form_key='ad'"))
                        .isInstanceOf(SQLException.class).hasMessageContaining("hero code followed by the form key");
                assertThatThrownBy(() -> q.execute("INSERT INTO hero.hero_form VALUES('" + FLOWBORN + "','" + ad
                        + "','flowborn',1,now(),'test','editor')")).isInstanceOf(SQLException.class);
            }
        }
    }

    @Test
    void leavesADatabaseWithoutFlowbornUnchanged() throws Exception {
        try (var database = new PostgreSQLContainer("postgres:17.6")) {
            database.start();
            Flyway.configure().dataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword())
                    .load().migrate();
            try (var c = connect(database)) {
                assertThat(rows(c, "SELECT count(*) FROM hero.hero")).containsExactly(List.of(0L));
                assertThat(rows(c, "SELECT count(*) FROM hero.hero_form")).containsExactly(List.of(0L));
                assertThat(rows(c, "SELECT epoch FROM platform.catalog_cache_epoch")).containsExactly(List.of(1L));
            }
        }
    }

    private static Connection connect(PostgreSQLContainer database) throws SQLException {
        return DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(), database.getPassword());
    }

    private static void variant(Connection c, UUID ruleset, UUID variant, String code, int ordinal)
            throws SQLException {
        UUID patch = UUID.randomUUID();
        c.createStatement().execute("INSERT INTO patch.game_patch(id,code,status,created_at,created_by_issuer,"
                + "created_by_subject) VALUES('" + patch + "','" + code + "','PUBLISHED',now(),'test','editor')");
        c.createStatement().execute("INSERT INTO patch.patch_variant(id,patch_id,ruleset_id,variant_code,"
                + "ruleset_ordinal,status,published_at,created_at) VALUES('" + variant + "','" + patch + "','"
                + ruleset + "','" + code + "'," + ordinal + ",'PUBLISHED',now(),now())");
    }

    /** Writes a full revision the way publication leaves it: sections filled as drafts, then published. */
    private static void revision(Connection c, UUID hero, UUID ruleset, UUID variant, int number, String state,
            String title, String lore, UUID head, UUID portrait, UUID splash) throws SQLException {
        Map<String, UUID> sections = new LinkedHashMap<>();
        for (String table : List.of("hero_profile_revision", "hero_overview_rating_revision",
                "hero_combat_stats_revision", "hero_skill_set_revision", "hero_skin_set_revision",
                "hero_media_binding_revision")) {
            UUID id = UUID.randomUUID();
            sections.put(table, id);
            c.createStatement().execute("INSERT INTO hero." + table + "(id,hero_id,state,created_at,"
                    + "created_by_issuer,created_by_subject) VALUES('" + id + "','" + hero
                    + "','DRAFT',now(),'test','editor')");
        }
        try (var insert = c.prepareStatement("INSERT INTO hero.hero_profile_translation VALUES(?,?,?,?,?,?)")) {
            insert.setObject(1, sections.get("hero_profile_revision"));
            insert.setString(2, "vi-VN");
            insert.setString(3, "Flowborn Ad");
            insert.setString(4, title);
            insert.setString(5, "Đứng cạnh đồng đội, chiêu 1 của Flowborn sẽ được cường hóa.");
            insert.setString(6, lore);
            insert.execute();
        }
        c.createStatement().execute("INSERT INTO hero.hero_profile_role VALUES('"
                + sections.get("hero_profile_revision") + "','MARKSMAN')");
        c.createStatement().execute("INSERT INTO hero.hero_media_binding VALUES('"
                + sections.get("hero_media_binding_revision") + "','HEAD','" + head + "'),('"
                + sections.get("hero_media_binding_revision") + "','PORTRAIT','" + portrait + "'),('"
                + sections.get("hero_media_binding_revision") + "','SPLASH','" + splash + "')");
        if (state.equals("PUBLISHED"))
            for (var entry : sections.entrySet())
                c.createStatement().execute(
                        "UPDATE hero." + entry.getKey() + " SET state='PUBLISHED' WHERE id='" + entry.getValue() + "'");

        boolean published = state.equals("PUBLISHED");
        c.createStatement().execute("INSERT INTO hero.hero_revision(id,hero_id,ruleset_id,revision_no,state,version,"
                + "publication_sequence,published_at,cause,effective_from_patch_variant_id,profile_revision_id,"
                + "overview_rating_revision_id,combat_stats_revision_id,skills_revision_id,skins_revision_id,"
                + "media_binding_revision_id,created_at,updated_at,created_by_issuer,created_by_subject,"
                + "updated_by_issuer,updated_by_subject) VALUES('" + UUID.randomUUID() + "','" + hero + "','" + ruleset
                + "'," + number + ",'" + state + "',1," + (published ? number : "NULL") + ","
                + (published ? "now()" : "NULL") + ",'" + (number == 1 ? "DATA_BASELINE" : "GAME_PATCH") + "','"
                + variant + "','" + sections.get("hero_profile_revision") + "','"
                + sections.get("hero_overview_rating_revision") + "','" + sections.get("hero_combat_stats_revision")
                + "','" + sections.get("hero_skill_set_revision") + "','" + sections.get("hero_skin_set_revision")
                + "','" + sections.get("hero_media_binding_revision")
                + "',now(),now(),'test','editor','test','editor')");
    }

    private static List<List<Object>> rows(Connection c, String sql) throws SQLException {
        List<List<Object>> result = new ArrayList<>();
        try (var rows = c.createStatement().executeQuery(sql)) {
            int columns = rows.getMetaData().getColumnCount();
            while (rows.next()) {
                List<Object> row = new ArrayList<>();
                for (int i = 1; i <= columns; i++)
                    row.add(rows.getObject(i));
                result.add(row);
            }
        }
        return result;
    }
}
