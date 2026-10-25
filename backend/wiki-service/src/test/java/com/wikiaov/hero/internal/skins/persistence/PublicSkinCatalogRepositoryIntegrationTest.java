package com.wikiaov.hero.internal.skins.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.SeaweedFsTestConfiguration;
import com.wikiaov.TestcontainersConfiguration;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Import({TestcontainersConfiguration.class, SeaweedFsTestConfiguration.class})
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
@Transactional
class PublicSkinCatalogRepositoryIntegrationTest {
    @Autowired
    PublicSkinCatalogRepository repository;

    @Autowired
    JdbcClient jdbc;

    @Test
    void readsOnlyPublishedPastCandidatesAndBulkOwnedSkinMetadata() {
        var hero = UUID.randomUUID();
        var section = UUID.randomUUID();
        var ruleset = UUID.randomUUID();
        var head = UUID.randomUUID();
        var icon = UUID.randomUUID();
        var now = Instant.parse("2026-10-25T00:00:00Z");
        String code = "qa-" + hero.toString().substring(0, 8);
        write("""
                insert into hero.hero(id,code,created_at,created_by_issuer,created_by_subject)
                values(?,?,?,'test','test')
                """, hero, code, Timestamp.from(now));
        for (var table : List.of("hero_profile_revision", "hero_overview_rating_revision", "hero_combat_stats_revision",
                "hero_skill_set_revision", "hero_skin_set_revision", "hero_media_binding_revision"))
            write("insert into hero." + table + "(id,hero_id,state,created_at,created_by_issuer,created_by_subject) "
                    + "values(?,?,'DRAFT',?,'test','test')", section, hero, Timestamp.from(now));
        revision(hero, section, ruleset, 1, "PUBLISHED", now.minusSeconds(60));
        revision(hero, section, ruleset, 2, "DRAFT", null);
        revision(hero, section, ruleset, 3, "PUBLISHED", now.plusSeconds(60));
        revision(hero, section, UUID.randomUUID(), 1, "PUBLISHED", now.minusSeconds(60));
        write("insert into hero.hero_profile_translation(profile_revision_id,locale,name) values(?,'vi-VN','Tướng thử')",
                section);
        write("insert into hero.hero_skin(hero_id,skin_key,created_at) values(?,'default',?)", hero,
                Timestamp.from(now));
        write("""
                insert into hero.hero_skin_snapshot(skin_set_revision_id,hero_id,skin_key,display_order)
                values(?,?,'default',0)
                """, section, hero);
        write("""
                insert into hero.hero_skin_translation(skin_set_revision_id,skin_key,locale,name)
                values(?,'default','vi-VN','Mặc định')
                """, section);
        write("insert into hero.hero_media_binding(media_binding_revision_id,media_role,asset_id) values(?,'HEAD',?)",
                section, head);
        var badge = UUID.randomUUID();
        write("insert into hero.skin_badge(id,code,kind,version,created_at,updated_at) values(?,?,'RARITY',1,?,?)",
                badge, code, Timestamp.from(now), Timestamp.from(now));
        write("""
                insert into hero.skin_badge_translation(badge_id,locale,display_name,icon_asset_id)
                values(?,'vi-VN','Bậc thử',?)
                """, badge, icon);
        for (var table : List.of("hero_profile_revision", "hero_overview_rating_revision", "hero_combat_stats_revision",
                "hero_skill_set_revision", "hero_skin_set_revision", "hero_media_binding_revision"))
            write("update hero." + table + " set state='PUBLISHED' where id=?", section);

        assertThat(repository.candidates(ruleset, now)).singleElement().satisfies(candidate -> {
            assertThat(candidate.getHeroCode()).isEqualTo(code);
            assertThat(candidate.getPublicationSequence()).isEqualTo(1);
            assertThat(candidate.getSkinsId()).isEqualTo(section);
        });
        assertThat(repository.profileTexts(List.of(section))).singleElement()
                .satisfies(text -> assertThat(text.getName()).isEqualTo("Tướng thử"));
        assertThat(repository.skins(List.of(section))).singleElement()
                .satisfies(skin -> assertThat(skin.getSkinKey()).isEqualTo("default"));
        assertThat(repository.skinTexts(List.of(section))).singleElement()
                .satisfies(text -> assertThat(text.getName()).isEqualTo("Mặc định"));
        assertThat(repository.heads(List.of(section))).singleElement()
                .satisfies(binding -> assertThat(binding.getAssetId()).isEqualTo(head));
        assertThat(repository.badgeTexts(List.of(code))).singleElement()
                .satisfies(text -> assertThat(text.getIconId()).isEqualTo(icon));
    }

    private void revision(UUID hero, UUID section, UUID ruleset, long number, String state, Instant publishedAt) {
        write("""
                insert into hero.hero_revision(id,hero_id,ruleset_id,revision_no,state,version,publication_sequence,
                    published_at,cause,profile_revision_id,overview_rating_revision_id,combat_stats_revision_id,
                    skills_revision_id,skins_revision_id,media_binding_revision_id,created_at,updated_at,
                    created_by_issuer,created_by_subject,updated_by_issuer,updated_by_subject)
                values(?,?,?,?,?,1,?,?,'OTHER',?,?,?,?,?,?,?,?, 'test','test','test','test')
                """, UUID.randomUUID(), hero, ruleset, number, state, publishedAt == null ? null : number,
                publishedAt == null ? null : Timestamp.from(publishedAt), section, section, section, section, section,
                section, Timestamp.from(Instant.parse("2026-10-01T00:00:00Z")),
                Timestamp.from(Instant.parse("2026-10-01T00:00:00Z")));
    }

    private void write(String sql, Object... values) {
        var statement = jdbc.sql(sql);
        for (int n = 0; n < values.length; n++)
            statement = statement.param(n + 1, values[n]);
        statement.update();
    }
}
