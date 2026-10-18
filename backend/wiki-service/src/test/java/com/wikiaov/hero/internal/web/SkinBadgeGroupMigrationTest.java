package com.wikiaov.hero.internal.web;

import static org.assertj.core.api.Assertions.*;

import java.sql.DriverManager;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.postgresql.PostgreSQLContainer;

@EnabledIf("dockerAvailable")
class SkinBadgeGroupMigrationTest {
    static boolean dockerAvailable() {
        return DockerClientFactory.instance().isDockerAvailable();
    }

    @Test
    void literalFamiliesPreserveAllBadgeIdentitiesClassificationsAndLocalizedIcons() throws Exception {
        try (var database = new PostgreSQLContainer("postgres:17.6")) {
            database.start();
            Flyway.configure().dataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword())
                    .target("17").load().migrate();
            var expected = Map.ofEntries(Map.entry("aic-2021", "theme-aic"),
                    Map.entry("apl-2025", "theme-apl"), Map.entry("s-plus-aovday-2026-mau-02", "theme-aov-day"),
                    Map.entry("s3-thuong-hang-2024", "theme-thuong-hang"),
                    Map.entry("thuong-hang", "theme-thuong-hang"), Map.entry("so-su-menh-69", "theme-so-su-menh"),
                    Map.entry("dimension-breaker-mau-01", "theme-dimension-breaker"),
                    Map.entry("wave-mau-02", "theme-wave"), Map.entry("tuyet-sac-tan-xuan", "theme-tan-xuan"),
                    Map.entry("tan-xuan-mau-02", "theme-tan-xuan"),
                    Map.entry("valentine-mau-01", "theme-valentine"), Map.entry("aog-mau-01", "theme-aog"),
                    Map.entry("bac-a-mau-02", "rank-a"), Map.entry("bac-s", "rank-s"),
                    Map.entry("bac-s-plus-mau-01", "rank-s-plus"), Map.entry("bac-ss-mau-02", "rank-ss"),
                    Map.entry("ss-plus-binh-ngo-2026", "rank-ss-plus"), Map.entry("sss-huu-han", "rank-sss"),
                    Map.entry("sss-plus-huu-han", "rank-sss-plus"));
            Set<String> unassigned = Set.of("s3-unrecognized", "aic-extra", "apl-2025-extra", "attack-on-titan",
                    "wave-mau", "aovday-unrecognized", "splus-unknown");
            Map<String, UUID> ids = new HashMap<>();
            UUID icon = UUID.randomUUID();
            var codes = new ArrayList<>(expected.keySet());
            codes.addAll(unassigned);
            try (var connection = DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(),
                    database.getPassword())) {
                for (String code : codes) {
                    UUID id = UUID.randomUUID();
                    ids.put(code, id);
                    try (var insert = connection.prepareStatement(
                            "INSERT INTO hero.skin_badge(id,code,kind,version,created_at,updated_at) VALUES(?,?,'EVENT',7,now(),now())")) {
                        insert.setObject(1, id);
                        insert.setString(2, code);
                        insert.executeUpdate();
                    }
                    try (var insert = connection.prepareStatement(
                            "INSERT INTO hero.skin_badge_translation(badge_id,locale,display_name,icon_asset_id) VALUES(?,'vi-VN',?,?),(?,'en-US',?,NULL)")) {
                        insert.setObject(1, id);
                        insert.setString(2, "Original " + code);
                        insert.setObject(3, icon);
                        insert.setObject(4, id);
                        insert.setString(5, "English " + code);
                        insert.executeUpdate();
                    }
                }
            }
            Flyway.configure().dataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword())
                    .target("18").load()
                    .migrate();
            try (var connection = DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(),
                    database.getPassword()); var query = connection.createStatement()) {
                try (var rows = query.executeQuery(
                        "SELECT b.id,b.code,b.kind,b.version,g.code FROM hero.skin_badge b LEFT JOIN hero.skin_badge_group g ON g.id=b.group_id")) {
                    int count = 0;
                    while (rows.next()) {
                        String code = rows.getString(2);
                        assertThat(rows.getObject(1)).isEqualTo(ids.get(code));
                        assertThat(rows.getString(3)).isEqualTo("EVENT");
                        assertThat(rows.getLong(4)).isEqualTo(expected.containsKey(code) ? 8 : 7);
                        assertThat(rows.getString(5)).isEqualTo(expected.get(code));
                        count++;
                    }
                    assertThat(count).isEqualTo(codes.size());
                }
                try (var rows = query.executeQuery(
                        "SELECT b.code,t.locale,t.display_name,t.icon_asset_id FROM hero.skin_badge_translation t JOIN hero.skin_badge b ON b.id=t.badge_id")) {
                    int count = 0;
                    while (rows.next()) {
                        boolean vietnamese = rows.getString(2).equals("vi-VN");
                        assertThat(rows.getString(3))
                                .isEqualTo((vietnamese ? "Original " : "English ") + rows.getString(1));
                        assertThat(rows.getObject(4)).isEqualTo(vietnamese ? icon : null);
                        count++;
                    }
                    assertThat(count).isEqualTo(codes.size() * 2);
                }
                try (var rows = query.executeQuery("SELECT count(*) FROM hero.skin_badge_group")) {
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getLong(1)).isEqualTo(17);
                }
            }
        }
    }
}
