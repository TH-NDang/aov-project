package com.wikiaov.video.internal.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.wikiaov.DockerBacked;
import com.wikiaov.TestcontainersConfiguration;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** ADR-019 as amended on 2026-11-27: V078 moves every skill video into its hero's one list. */
@DockerBacked
class SkillVideoMergeMigrationIntegrationTest {
    private static final String SAME = "https://www.youtube.com/watch?v=aaaaaaaaaaa";
    private static final String SHARED = "https://www.youtube.com/watch?v=bbbbbbbbbbb";

    @Test
    void skillVideosJoinTheHerosListAfterItsOwnAndKeepOneRowPerVideo() throws Exception {
        try (var database = TestcontainersConfiguration.postgres()) {
            database.start();
            migrate(database, "77");
            UUID hero = UUID.randomUUID();
            UUID other = UUID.randomUUID();
            try (var c = connect(database)) {
                video(c, "guide", hero, "HERO", null, "https://youtu.be/guide", 0, "PUBLISHED", 0);
                video(c, "lore", hero, "HERO", null, "https://youtu.be/lore", 0, "PUBLISHED", 1);
                video(c, "hidden-hero", hero, "HERO", null, SAME, 0, "HIDDEN", 2);
                video(c, "same-on-skill", hero, "SKILL", "skill-1", SAME, 0, "PUBLISHED", 0);
                video(c, "skill-2-second", hero, "SKILL", "skill-2", "https://youtu.be/two-b", 0, "PUBLISHED", 1);
                video(c, "skill-2-first", hero, "SKILL", "skill-2", "https://youtu.be/two-a", 0, "PUBLISHED", 0);
                video(c, "shared-draft", hero, "SKILL", "skill-1", SHARED, 0, "DRAFT", 1);
                video(c, "shared-published", hero, "SKILL", "skill-2", SHARED, 0, "PUBLISHED", 2);
                video(c, "later-part", hero, "SKILL", "skill-1", SHARED, 90, "PUBLISHED", 2);
                video(c, "lonely-skill", other, "SKILL", "skill-3", "https://youtu.be/three", 0, "DRAFT", 4);
                video(c, "skin", hero, "SKIN", "lan-su", SAME, 0, "PUBLISHED", 0);
            }

            migrate(database, null);

            try (var c = connect(database)) {
                assertThat(rows(c, "SELECT title FROM video.subject_video WHERE subject_id = '" + hero
                        + "' AND subject_kind = 'HERO' ORDER BY display_order"))
                        .containsExactly("guide", "lore", "same-on-skill", "later-part", "skill-2-first",
                                "skill-2-second", "shared-published");
                assertThat(rows(c, "SELECT subject_kind || ':' || display_order FROM video.subject_video "
                        + "WHERE subject_id = '" + other + "'")).containsExactly("HERO:0");
                assertThat(rows(c, "SELECT count(*)::text FROM video.subject_video WHERE subject_key IS NOT NULL "
                        + "AND subject_kind <> 'SKIN'")).containsExactly("0");
                assertThat(rows(c, "SELECT title FROM video.subject_video WHERE subject_kind = 'SKIN'"))
                        .containsExactly("skin");
                assertThat(rows(c, "SELECT version::text FROM video.subject_video WHERE title = 'same-on-skill'"))
                        .containsExactly("2");

                assertThatThrownBy(() -> video(c, "new-skill", hero, "SKILL", "skill-1", "https://youtu.be/new", 0,
                        "DRAFT", 0)).isInstanceOf(SQLException.class);
            }
        }
    }

    private static void migrate(PostgreSQLContainer database, String target) {
        var configuration = Flyway.configure().dataSource(database.getJdbcUrl(), database.getUsername(),
                database.getPassword());
        (target == null ? configuration : configuration.target(target)).load().migrate();
    }

    private static Connection connect(PostgreSQLContainer database) throws SQLException {
        return DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(), database.getPassword());
    }

    private static void video(Connection c, String title, UUID subject, String kind, String key, String url,
            int start, String status, int order) throws SQLException {
        try (var insert = c.prepareStatement("""
                INSERT INTO video.subject_video (id, subject_kind, subject_id, subject_key, purpose, title, url,
                    provider, start_seconds, display_order, status, origin, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'SKILL_DEMO', ?, ?, 'YOUTUBE', ?, ?, ?, 'MANUAL', 1, now(), now())
                """)) {
            insert.setObject(1, UUID.randomUUID());
            insert.setString(2, kind);
            insert.setObject(3, subject);
            insert.setString(4, key);
            insert.setString(5, title);
            insert.setString(6, url);
            insert.setInt(7, start);
            insert.setInt(8, order);
            insert.setString(9, status);
            insert.executeUpdate();
        }
    }

    private static List<String> rows(Connection c, String sql) throws SQLException {
        var values = new ArrayList<String>();
        try (var statement = c.createStatement(); var result = statement.executeQuery(sql)) {
            while (result.next()) {
                values.add(result.getString(1));
            }
        }
        return values;
    }
}
