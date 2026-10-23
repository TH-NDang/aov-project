package com.wikiaov.terminology.internal.web;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.wikiaov.arcana.internal.reference.persistence.ArcanaReferenceRepository;
import com.wikiaov.enchantment.internal.reference.persistence.EnchantmentReferenceRepository;
import com.wikiaov.hero.internal.reference.persistence.HeroReferenceRepository;
import com.wikiaov.item.internal.reference.persistence.ItemReferenceRepository;
import com.wikiaov.patch.GameplayContext;
import com.wikiaov.spell.internal.reference.persistence.SpellReferenceRepository;
import jakarta.persistence.EntityManagerFactory;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@EnabledIf("databaseAvailable")
class AdminReferenceCatalogIntegrationTest {
    private static PostgreSQLContainer database;
    private final UUID ruleset = UUID.randomUUID();
    private final UUID otherRuleset = UUID.randomUUID();
    private final UUID firstPatch = UUID.randomUUID();
    private final UUID secondPatch = UUID.randomUUID();
    private final UUID hero = UUID.randomUUID();
    private final UUID head = UUID.randomUUID();
    private final Map<UUID, Long> ordinals = Map.of(firstPatch, 1L, secondPatch, 2L);

    static boolean databaseAvailable() {
        return System.getenv("WIKI_TEST_DB_URL") != null || DockerClientFactory.instance().isDockerAvailable();
    }

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) {
        String external = System.getenv("WIKI_TEST_DB_URL");
        if (external != null) {
            properties.add("spring.datasource.url", () -> external);
            properties.add("spring.datasource.username", () -> "wiki_test");
            properties.add("spring.datasource.password", () -> "");
        } else {
            database = new PostgreSQLContainer("postgres:17.6");
            database.start();
            properties.add("spring.datasource.url", database::getJdbcUrl);
            properties.add("spring.datasource.username", database::getUsername);
            properties.add("spring.datasource.password", database::getPassword);
        }
    }

    @AfterAll
    static void stop() {
        if (database != null)
            database.stop();
    }

    @Autowired
    MockMvc mvc;
    @Autowired
    JdbcTemplate sql;
    @Autowired
    JsonMapper json;
    @Autowired
    EntityManagerFactory entityManagerFactory;
    @Autowired
    HeroReferenceRepository heroes;
    @Autowired
    ItemReferenceRepository items;
    @Autowired
    ArcanaReferenceRepository arcana;
    @Autowired
    EnchantmentReferenceRepository enchantments;
    @Autowired
    SpellReferenceRepository spells;
    @MockitoBean
    JwtDecoder decoder;

    @BeforeEach
    void fixtures() {
        for (var id : List.of(ruleset, otherRuleset))
            sql.update("insert into patch.gameplay_ruleset values (?,?,?,'ACTIVE',now())", id,
                    "test-" + id, "Reference projection fixture");
        for (var entry : ordinals.entrySet()) {
            UUID patch = UUID.randomUUID();
            sql.update("insert into patch.game_patch(id,code,status,created_at,created_by_issuer,created_by_subject)"
                    + " values (?,?,'PUBLISHED',now(),'test','editor')", patch, "patch-" + patch);
            sql.update("insert into patch.patch_variant(id,patch_id,ruleset_id,variant_code,ruleset_ordinal,status,"
                    + "published_at,created_at) values (?,?,?,?,?,'PUBLISHED',now(),now())", entry.getKey(), patch,
                    ruleset, "standard", entry.getValue());
        }
        sql.update("insert into hero.hero values (?,?,now(),'test','editor')", hero, "hero-" + hero);
        heroRevision(ruleset, 1, "PUBLISHED", firstPatch, "Hero old");
        heroRevision(ruleset, 2, "PUBLISHED", secondPatch, "Hero current");
        heroRevision(ruleset, 3, "DISCARDED", secondPatch, "Hero discarded");
        heroRevision(ruleset, 4, "DRAFT", firstPatch, "Hero draft");
        heroRevision(otherRuleset, 8, "DRAFT", null, "Hero other ruleset");
    }

    @Test
    void authorizesWhitelistsAndReturnsOnlyCompactScopedFields() throws Exception {
        var item = warehouse("item", 0);
        mvc.perform(get("/api/wiki/v1/admin/reference-catalog")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/wiki/v1/admin/reference-catalog").with(jwt()))
                .andExpect(status().isForbidden());
        var reader = jwt().authorities(new SimpleGrantedAuthority("catalog:read"));
        mvc.perform(get("/api/wiki/v1/admin/reference-catalog?rulesetId=" + ruleset + "&unexpected=1").with(reader))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/wiki/v1/admin/reference-catalog?rulesetId=invalid").with(reader))
                .andExpect(status().isBadRequest());
        statistics().clear();
        var response = mvc.perform(get("/api/wiki/v1/admin/reference-catalog?rulesetId=" + ruleset).with(reader))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.rulesetId").value(ruleset.toString())).andReturn().getResponse()
                .getContentAsString();
        assertThat(statistics().getPrepareStatementCount()).isEqualTo(7);
        assertThat(statistics().getEntityLoadCount()).isZero();
        assertThat(response).contains("Hero draft", "Current item", hero.toString(), item.toString(), head.toString())
                .doesNotContain("Hero discarded", "Hero other ruleset", "OLD", "gameplay", "skills", "private-note");
        var tree = json.readTree(response);
        var heroEntry = tree.get("items").valueStream().filter(e -> e.get("kind").asString().equals("hero"))
                .findFirst().orElseThrow();
        assertThat(heroEntry.get("translations").size()).isEqualTo(2);
        assertThat(heroEntry.get("destinations").get("admin").asString()).startsWith("/hero/" + hero + "?revision=");
    }

    @Test
    void projectionQueryCountIsBoundedAsCatalogGrowsAndNeverHydratesEntities() {
        for (String domain : List.of("item", "arcana", "enchantment", "spell"))
            warehouse(domain, 0);
        var statistics = statistics();
        statistics.clear();
        assertThat(heroes.authoring(ruleset)).extracting(r -> r.name()).containsExactly("Hero draft EN", "Hero draft");
        assertThat(items.authoring(ruleset, ordinals)).hasSize(2);
        assertThat(arcana.authoring(ruleset, ordinals)).hasSize(2);
        assertThat(enchantments.authoring(ruleset, ordinals)).hasSize(2);
        assertThat(spells.authoring(ruleset, ordinals)).hasSize(2);
        assertThat(statistics.getPrepareStatementCount()).isEqualTo(5);
        assertThat(statistics.getEntityLoadCount()).isZero();
        for (int index = 1; index <= 30; index++)
            warehouse("item", index);
        statistics.clear();
        var rows = items.authoring(ruleset, ordinals);
        assertThat(rows).hasSize(62);
        assertThat(rows).allSatisfy(r -> {
            assertThat(r.name()).startsWith("Current item");
            assertThat(r.description()).hasSizeLessThanOrEqualTo(4000);
        });
        assertThat(statistics.getPrepareStatementCount()).isEqualTo(1);
        assertThat(statistics.getEntityLoadCount()).isZero();
    }

    @Test
    void publicProjectionsSelectPublishedHistoryAndHideRemovedAndUnscopedLegacySpells() {
        var owner = warehouse("item", 0);
        warehouse("spell", 0);
        warehouse("arcana", 0);
        warehouse("enchantment", 0);
        UUID legacy = UUID.randomUUID();
        UUID legacyRevision = UUID.randomUUID();
        sql.update("insert into spell.spell values (?,?,now(),'test','editor')", legacy, "legacy-" + legacy);
        sql.update("insert into spell.spell_revision(id,owner_id,ruleset_id,revision_no,state,version,"
                + "publication_sequence,published_at,cause,gameplay,created_at,updated_at,created_by_issuer,"
                + "created_by_subject,updated_by_issuer,updated_by_subject) values (?,?,?,1,'DRAFT',1,null,null,"
                + "'DATA_BASELINE',cast(? as jsonb),now(),now(),'test','editor','test','editor')", legacyRevision,
                legacy, ruleset, "{\"legacy\":true,\"availability\":\"REMOVED\"}");
        sql.update("insert into spell.spell_translation(id,revision_id,locale,target_key,name)"
                + " values (?,?,'vi-VN','','Unscoped legacy')", UUID.randomUUID(), legacyRevision);
        sql.update(
                "update spell.spell_revision set state='PUBLISHED',publication_sequence=1,published_at=now() where id=?",
                legacyRevision);
        var before = context(1);
        var statistics = statistics();
        statistics.clear();
        assertThat(heroes.published(before, ordinals, Instant.now())).extracting(r -> r.name())
                .containsExactly("Hero old EN", "Hero old");
        assertThat(items.published(before, ordinals)).extracting(r -> r.name()).containsExactly("OLD EN", "OLD");
        assertThat(spells.published(before, ordinals)).extracting(r -> r.name()).containsExactly("OLD EN", "OLD");
        assertThat(arcana.published(before, ordinals)).extracting(r -> r.name()).containsExactly("OLD EN", "OLD");
        assertThat(enchantments.published(before, ordinals)).extracting(r -> r.name()).containsExactly("OLD EN", "OLD");
        assertThat(statistics.getPrepareStatementCount()).isEqualTo(9);
        assertThat(statistics.getEntityLoadCount()).isZero();
        var revision = sql.queryForObject("select id from item.item_revision where owner_id=? and revision_no=2",
                UUID.class, owner);
        sql.update("insert into item.item_patch_change_set values (?,?,?,?,null,?,cast(? as jsonb),"
                + "cast(? as jsonb),?,now(),'test','editor')", UUID.randomUUID(), owner, ruleset, secondPatch,
                revision, "[\"REMOVED\"]", "[{\"locale\":\"vi-VN\",\"text\":\"Removed\"}]",
                "https://source.test/removed");
        assertThat(items.published(context(2), ordinals)).isEmpty();
        assertThat(heroes.published(context(2), ordinals, Instant.now())).extracting(r -> r.name())
                .containsExactly("Hero current EN", "Hero current");
    }

    @Test
    void emptyPatchOrderUsesSequenceTiesWithoutLoadingEntities() {
        for (String domain : List.of("item", "arcana", "enchantment", "spell"))
            warehouse(domain, 0);
        var statistics = statistics();
        statistics.clear();
        assertThat(items.authoring(ruleset, Map.of())).extracting(r -> r.name())
                .containsExactly("Earlier draft EN", "Earlier draft");
        assertThat(arcana.authoring(ruleset, Map.of())).extracting(r -> r.name())
                .containsExactly("Earlier draft EN", "Earlier draft");
        assertThat(enchantments.authoring(ruleset, Map.of())).extracting(r -> r.name())
                .containsExactly("Earlier draft EN", "Earlier draft");
        assertThat(spells.authoring(ruleset, Map.of())).extracting(r -> r.name())
                .containsExactly("Earlier draft EN", "Earlier draft");
        assertThat(statistics.getPrepareStatementCount()).isEqualTo(4);
        assertThat(statistics.getEntityLoadCount()).isZero();
        statistics.clear();
        assertThat(items.published(context(1), Map.of())).extracting(r -> r.name())
                .containsExactly("Current item EN", "Current item");
        assertThat(heroes.published(context(1), Map.of(), Instant.now())).extracting(r -> r.name())
                .containsExactly("Hero current EN", "Hero current");
        assertThat(statistics.getPrepareStatementCount()).isEqualTo(3);
        assertThat(statistics.getEntityLoadCount()).isZero();
    }

    @Test
    void publicHeroIgnoresPublishedSnapshotsAfterTheRequestedInstant() {
        var publishedAt = sql.query("select published_at from hero.hero_revision where hero_id=? and ruleset_id=? "
                + "and revision_no in (1,2) order by revision_no",
                (row, index) -> row.getTimestamp("published_at").toInstant(), hero, ruleset);
        assertThat(publishedAt).hasSize(2);
        var first = publishedAt.getFirst();
        var second = publishedAt.getLast();
        assertThat(second).isAfter(first);
        var asOf = first.plus(Duration.between(first, second).dividedBy(2)).truncatedTo(ChronoUnit.MICROS);

        var statistics = statistics();
        statistics.clear();
        assertThat(heroes.published(context(2), ordinals, asOf)).extracting(r -> r.name())
                .containsExactly("Hero old EN", "Hero old");
        assertThat(statistics.getPrepareStatementCount()).isEqualTo(1);
        assertThat(statistics.getEntityLoadCount()).isZero();
    }

    private Statistics statistics() {
        return entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    }

    private GameplayContext context(long ordinal) {
        return new GameplayContext(UUID.randomUUID(), "VN", ruleset, "test", UUID.randomUUID(), "test",
                ordinal == 1 ? firstPatch : secondPatch, ordinal, Instant.now());
    }

    private void heroRevision(UUID scope, int number, String state, UUID patch, String name) {
        var sections = new ArrayList<UUID>();
        for (String table : List.of("hero_profile_revision", "hero_overview_rating_revision",
                "hero_combat_stats_revision",
                "hero_skill_set_revision", "hero_skin_set_revision", "hero_media_binding_revision")) {
            UUID id = UUID.randomUUID();
            sections.add(id);
            sql.update("insert into hero." + table
                    + " (id,hero_id,state,created_at,created_by_issuer,created_by_subject) values (?,?,'DRAFT',now(),'test','editor')",
                    id, hero);
        }
        for (String locale : List.of("vi-VN", "en-US"))
            sql.update(
                    "insert into hero.hero_profile_translation(profile_revision_id,locale,name,summary) values (?,?,?,?)",
                    sections.getFirst(), locale, name + (locale.equals("en-US") ? " EN" : ""), "Profile summary");
        sql.update("insert into hero.hero_media_binding values (?,'HEAD',?)", sections.get(5), head);
        sql.update(
                "insert into hero.hero_revision(id,hero_id,ruleset_id,revision_no,state,version,publication_sequence,"
                        + "published_at,cause,effective_from_patch_variant_id,profile_revision_id,overview_rating_revision_id,"
                        + "combat_stats_revision_id,skills_revision_id,skins_revision_id,media_binding_revision_id,created_at,"
                        + "updated_at,created_by_issuer,created_by_subject,updated_by_issuer,updated_by_subject)"
                        + " values (?,?,?,?,?,1,?,?,'DATA_BASELINE',?,?,?,?,?,?,?,now(),now(),'test','editor','test','editor')",
                UUID.randomUUID(), hero, scope, number, state, state.equals("PUBLISHED") ? (long) number : null,
                state.equals("PUBLISHED") ? java.sql.Timestamp.from(Instant.now().minusSeconds(60)) : null, patch,
                sections.get(0), sections.get(1), sections.get(2), sections.get(3), sections.get(4), sections.get(5));
    }

    private UUID warehouse(String domain, int index) {
        UUID owner = UUID.randomUUID();
        sql.update("insert into " + domain + "." + domain + " values (?,?,now(),'test','editor')", owner,
                "test-" + index + "-" + owner);
        for (int number = 1; number <= 4; number++) {
            UUID revision = UUID.randomUUID();
            String state = number <= 2 ? "PUBLISHED" : number == 3 ? "DRAFT" : "DISCARDED";
            UUID patch = number == 2 ? secondPatch : firstPatch;
            sql.update("insert into " + domain + "." + domain + "_revision values (?,?,?,?,?,1,?,?,"
                    + "'DATA_BASELINE',?,null,null,cast(? as jsonb),now(),now(),'test','editor','test','editor')",
                    revision, owner, ruleset, number, number <= 2 ? "DRAFT" : state, null,
                    null, patch,
                    "{\"translations\":[],\"notes\":\"private-note\"}");
            for (String locale : List.of("vi-VN", "en-US")) {
                String name = number == 2 ? "Current " + domain : number == 1 ? "OLD" : "Earlier draft";
                String target = domain.equals("spell") ? "target_key," : "";
                String targetValue = domain.equals("spell") ? "''," : "";
                sql.update("insert into " + domain + "." + domain + "_translation(id,revision_id,locale," + target
                        + "name,description) values (?,?,?," + targetValue + "?,?)", UUID.randomUUID(), revision,
                        locale, name + (locale.equals("en-US") ? " EN" : ""), "D".repeat(5000));
                if (domain.equals("spell"))
                    sql.update("insert into spell.spell_translation(id,revision_id,locale,target_key,name,description)"
                            + " values (?,?,?,'state','State must not duplicate spell','State description')",
                            UUID.randomUUID(), revision, locale);
            }
            if (number <= 2)
                sql.update("update " + domain + "." + domain + "_revision set state='PUBLISHED',publication_sequence=?,"
                        + "published_at=? where id=?", number, java.sql.Timestamp.from(Instant.now().minusSeconds(60)),
                        revision);
        }
        return owner;
    }
}
