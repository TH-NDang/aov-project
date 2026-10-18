package com.wikiaov.hero.internal.web;

import static org.assertj.core.api.Assertions.*;

import java.sql.DriverManager;
import java.util.Map;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.postgresql.PostgreSQLContainer;

@EnabledIf("dockerAvailable")
class SkinBadgeRewardNamesMigrationTest {
    static boolean dockerAvailable() {
        return DockerClientFactory.instance().isDockerAvailable();
    }

    @Test
    void correctsRankRewardsWhilePreservingCustomLabelsTranslationsAndIcons() throws Exception {
        try (var database = new PostgreSQLContainer("postgres:17.6")) {
            database.start();
            Flyway.configure().dataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword())
                    .target("22").load().migrate();
            UUID icon = UUID.randomUUID();
            var names = Map.of("s3-thuong-hang-2026-vn-1", "S3 Thượng hạng 2026",
                    "thuong-hang-2026-vn-1", "Thượng hạng 2026",
                    "s24-thuong-hang-vn-1", "Custom reward label", "ss-vn-1", "Thượng hạng");
            try (var connection = DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(),
                    database.getPassword()); var query = connection.createStatement()) {
                query.execute("INSERT INTO hero.skin_badge_group_translation SELECT id,'en-US','Rank rewards' "
                        + "FROM hero.skin_badge_group WHERE code='theme-thuong-hang'");
                for (var name : names.entrySet()) {
                    UUID id = UUID.randomUUID();
                    try (var insert = connection.prepareStatement(
                            "INSERT INTO hero.skin_badge(id,code,kind,version,created_at,updated_at) VALUES(?,?,'EVENT',8,now(),now())")) {
                        insert.setObject(1, id);
                        insert.setString(2, name.getKey());
                        insert.executeUpdate();
                    }
                    try (var insert = connection.prepareStatement(
                            "INSERT INTO hero.skin_badge_translation VALUES(?,'vi-VN',?,?),(?,'en-US','Original English',NULL)")) {
                        insert.setObject(1, id);
                        insert.setString(2, name.getValue());
                        insert.setObject(3, icon);
                        insert.setObject(4, id);
                        insert.executeUpdate();
                    }
                }
            }
            Flyway.configure().dataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword())
                    .load().migrate();
            try (var connection = DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(),
                    database.getPassword()); var query = connection.createStatement()) {
                try (var rows = query.executeQuery(
                        "SELECT t.locale,t.display_name,g.version FROM hero.skin_badge_group_translation t "
                                + "JOIN hero.skin_badge_group g ON g.id=t.group_id WHERE g.code='theme-thuong-hang'")) {
                    int count = 0;
                    while (rows.next()) {
                        assertThat(rows.getString(2))
                                .isEqualTo(rows.getString(1).equals("vi-VN") ? "Thưởng hạng" : "Rank rewards");
                        assertThat(rows.getLong(3)).isEqualTo(1);
                        count++;
                    }
                    assertThat(count).isEqualTo(2);
                }
                try (var rows = query
                        .executeQuery("SELECT b.code,b.kind,b.version,t.locale,t.display_name,t.icon_asset_id "
                                + "FROM hero.skin_badge b JOIN hero.skin_badge_translation t ON t.badge_id=b.id")) {
                    int count = 0;
                    while (rows.next()) {
                        String code = rows.getString(1);
                        boolean corrected = code.equals("s3-thuong-hang-2026-vn-1")
                                || code.equals("thuong-hang-2026-vn-1");
                        boolean vietnamese = rows.getString(4).equals("vi-VN");
                        assertThat(rows.getString(2)).isEqualTo("EVENT");
                        assertThat(rows.getLong(3)).isEqualTo(corrected ? 9 : 8);
                        assertThat(rows.getString(5)).isEqualTo(vietnamese
                                ? corrected ? names.get(code).replace("Thượng hạng", "Thưởng hạng") : names.get(code)
                                : "Original English");
                        assertThat(rows.getObject(6)).isEqualTo(vietnamese ? icon : null);
                        count++;
                    }
                    assertThat(count).isEqualTo(8);
                }
            }
        }
    }
}
