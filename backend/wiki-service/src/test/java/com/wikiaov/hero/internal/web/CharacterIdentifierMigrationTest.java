package com.wikiaov.hero.internal.web;

import static org.assertj.core.api.Assertions.*;

import java.sql.*;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.postgresql.PostgreSQLContainer;

@EnabledIf("dockerAvailable")
class CharacterIdentifierMigrationTest {
    static boolean dockerAvailable() {
        return DockerClientFactory.instance().isDockerAvailable();
    }

    @Test
    void renamesIdentitiesAndFilesWithoutLosingPublishedTranslationsImagesOrGuards() throws Exception {
        try (var database = new PostgreSQLContainer("postgres:17.6")) {
            database.start();
            Flyway.configure().dataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword())
                    .target("18").load().migrate();
            UUID hero = UUID.randomUUID(), monkey = UUID.randomUUID(), badge = UUID.randomUUID();
            UUID customBadge = UUID.randomUUID();
            UUID asset = UUID.randomUUID(), first = UUID.randomUUID(), second = UUID.randomUUID();
            try (var c = DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(),
                    database.getPassword());
                    var q = c.createStatement()) {
                q.execute("INSERT INTO hero.hero VALUES('" + hero + "','airi',now(),'test','editor'),('" + monkey
                        + "','ngo-khong',now(),'test','editor')");
                q.execute("INSERT INTO hero.hero_skin VALUES('" + hero + "','airi-heroskin-4',now())");
                q.execute("INSERT INTO hero.skin_badge(id,code,kind,created_at,updated_at) VALUES('" + badge
                        + "','bac-s-plus-mau-02','EVENT',now(),now())");
                q.execute("INSERT INTO hero.skin_badge_translation VALUES('" + badge
                        + "','vi-VN','bac-s-plus-mau-02','" + asset + "'),('" + badge
                        + "','en-US','Custom translation',NULL)");
                q.execute("INSERT INTO hero.skin_badge(id,code,kind,created_at,updated_at) VALUES('" + customBadge
                        + "','bac-a-mau-01','RARITY',now(),now())");
                q.execute("INSERT INTO hero.skin_badge_translation VALUES('" + customBadge
                        + "','vi-VN','Custom rank label',NULL)");
                for (UUID section : new UUID[] {first, second}) {
                    q.execute(
                            "INSERT INTO hero.hero_skin_set_revision(id,hero_id,state,created_at,created_by_issuer,created_by_subject) VALUES('"
                                    + section + "','" + hero + "','DRAFT',now(),'test','editor')");
                    q.execute(
                            "INSERT INTO hero.hero_skin_snapshot(skin_set_revision_id,hero_id,skin_key,display_order,art_asset_id,rarity_code) VALUES('"
                                    + section + "','" + hero + "','airi-heroskin-4',0,'" + asset
                                    + "','bac-s-plus-mau-02')");
                    q.execute("INSERT INTO hero.hero_skin_translation VALUES('" + section
                            + "','airi-heroskin-4','vi-VN','Cấm Vệ Nguyệt Tộc','Original description',NULL),('"
                            + section + "','airi-heroskin-4','en-US','Moon Guard','English description',NULL)");
                    q.execute("INSERT INTO hero.skin_image_option VALUES('" + section
                            + "','airi-heroskin-4','PORTRAIT',0,'" + asset
                            + "','airi-cam-ve-nguyet-toc-portrait.png')");
                }
                q.execute("UPDATE hero.hero_skin_set_revision SET state='PUBLISHED' WHERE id='" + first + "'");
                q.execute("INSERT INTO media.media_asset VALUES('" + asset
                        + "','HERO_SKIN_ART','ACTIVE',NULL,0,0,now(),'test','editor',now())");
                q.execute("INSERT INTO media.media_provenance VALUES(gen_random_uuid(),'" + asset
                        + "',NULL,'OTHER','Original source',NULL,NULL,'assets/skin/portrait/airi-cam-ve-nguyet-toc-portrait.png',now())");
            }
            Flyway.configure().dataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword())
                    .load().migrate();
            try (var c = DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(),
                    database.getPassword());
                    var q = c.createStatement()) {
                try (var rows = q
                        .executeQuery("SELECT skin_key,art_asset_id,rarity_code FROM hero.hero_skin_snapshot")) {
                    int count = 0;
                    while (rows.next()) {
                        assertThat(rows.getString(1)).isEqualTo("airi-cam-ve-nguyet-toc-1");
                        assertThat(rows.getObject(2)).isEqualTo(asset);
                        assertThat(rows.getString(3)).matches("s-plus-vn-[1-9][0-9]*");
                        count++;
                    }
                    assertThat(count).isEqualTo(2);
                }
                try (var rows = q.executeQuery("SELECT name,description,skin_key FROM hero.hero_skin_translation")) {
                    int count = 0;
                    while (rows.next()) {
                        assertThat(rows.getString(1)).isIn("Cấm Vệ Nguyệt Tộc", "Moon Guard");
                        assertThat(rows.getString(2)).isIn("Original description", "English description");
                        assertThat(rows.getString(3)).isEqualTo("airi-cam-ve-nguyet-toc-1");
                        count++;
                    }
                    assertThat(count).isEqualTo(4);
                }
                try (var rows = q.executeQuery("SELECT code FROM hero.hero WHERE id='" + monkey + "'")) {
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getString(1)).isEqualTo("wukong");
                }
                try (var rows = q.executeQuery("SELECT legacy_key,skin_key FROM hero.skin_key_alias")) {
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getString(1)).isEqualTo("airi-heroskin-4");
                    assertThat(rows.getString(2)).isEqualTo("airi-cam-ve-nguyet-toc-1");
                }
                try (var rows = q.executeQuery("SELECT label,asset_id FROM hero.skin_image_option")) {
                    int count = 0;
                    while (rows.next()) {
                        assertThat(rows.getString(1)).isEqualTo("airi-cam-ve-nguyet-toc-1-portrait.png");
                        assertThat(rows.getObject(2)).isEqualTo(asset);
                        count++;
                    }
                    assertThat(count).isEqualTo(2);
                }
                try (var rows = q.executeQuery(
                        "SELECT display_name,icon_asset_id FROM hero.skin_badge_translation WHERE locale='en-US'")) {
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getString(1)).isEqualTo("Custom translation");
                    assertThat(rows.getObject(2)).isNull();
                }
                try (var rows = q.executeQuery(
                        "SELECT display_name,icon_asset_id FROM hero.skin_badge_translation WHERE badge_id='"
                                + badge + "' AND locale='vi-VN'")) {
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getString(1)).isEqualTo("Bậc S+");
                    assertThat(rows.getObject(2)).isEqualTo(asset);
                }
                try (var rows = q.executeQuery("SELECT display_name FROM hero.skin_badge_translation WHERE badge_id='"
                        + customBadge + "' AND locale='vi-VN'")) {
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getString(1)).isEqualTo("Custom rank label");
                }
                assertThatThrownBy(() -> q
                        .execute("UPDATE hero.hero_skin_translation SET name='Changed' WHERE skin_set_revision_id='"
                                + first + "'"))
                        .isInstanceOf(SQLException.class).hasMessageContaining("immutable");
                assertThatThrownBy(() -> q.execute("DELETE FROM hero.skin_image_option WHERE skin_set_revision_id='"
                        + first + "'")).isInstanceOf(SQLException.class).hasMessageContaining("immutable");
            }
        }
    }
}
