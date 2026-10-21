package com.wikiaov.terminology.internal.web;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.wikiaov.media.*;
import com.wikiaov.patch.*;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.platform.ApiException;
import com.wikiaov.terminology.SkillReferenceProvider;
import jakarta.persistence.EntityManagerFactory;
import java.time.Instant;
import java.util.*;
import org.hibernate.SessionFactory;
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
class SkillReferenceCatalogIntegrationTest {
    private static PostgreSQLContainer database;
    private final UUID ruleset = UUID.randomUUID(), otherRuleset = UUID.randomUUID();
    private final UUID firstPatch = UUID.randomUUID(), secondPatch = UUID.randomUUID(), futurePatch = UUID.randomUUID();
    private final UUID airi = UUID.randomUUID(), edras = UUID.randomUUID(), wukong = UUID.randomUUID();
    private final UUID authored = UUID.randomUUID(), library = UUID.randomUUID(), head = UUID.randomUUID();
    private UUID oldAiri, currentAiri;
    @Autowired
    MockMvc mvc;
    @Autowired
    JdbcTemplate sql;
    @Autowired
    JsonMapper json;
    @Autowired
    SkillReferenceProvider skills;
    @Autowired
    EntityManagerFactory entityManagerFactory;
    @MockitoBean
    JwtDecoder decoder;
    @MockitoBean
    GameplayContexts contexts;
    @MockitoBean
    MediaAssets media;

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

    @BeforeEach
    void fixture() {
        for (var id : List.of(ruleset, otherRuleset))
            sql.update("insert into patch.gameplay_ruleset values (?,?,?,'ACTIVE',now())", id, "test-" + id,
                    "Skill refs");
        var variants = new ArrayList<PatchVariantReference>();
        int ordinal = 0;
        for (var id : List.of(firstPatch, secondPatch, futurePatch)) {
            UUID patch = UUID.randomUUID();
            sql.update("insert into patch.game_patch(id,code,status,created_at,created_by_issuer,created_by_subject)"
                    + " values (?,?,'PUBLISHED',now(),'test','editor')", patch, "patch-" + patch);
            sql.update("insert into patch.patch_variant(id,patch_id,ruleset_id,variant_code,ruleset_ordinal,status,"
                    + "published_at,created_at) values (?,?,?,?,?,'PUBLISHED',now(),now())", id, patch, ruleset,
                    "standard", ++ordinal);
            variants.add(new PatchVariantReference(id, patch, ruleset, null, ordinal, true));
        }
        when(contexts.rulesets()).thenReturn(List.of(new RulesetReference(ruleset, "aov-standard")));
        when(contexts.rulesetVariants(ruleset)).thenReturn(variants);
        when(contexts.resolve(eq("VN"), any())).thenReturn(context(2));
        when(media.findAll(anyCollection())).thenAnswer(call -> {
            var result = new HashMap<UUID, MediaAssetReference>();
            for (var id : call.<Collection<UUID>>getArgument(0))
                result.put(id, new MediaAssetReference(id, MediaSemanticType.HERO_SKILL_ICON, MediaAssetState.ACTIVE,
                        new MediaAssetReference.CurrentVersion(UUID.randomUUID(), "image/png", 128, 128,
                                "/assets/" + id)));
            return result;
        });
        hero(airi, "airi");
        hero(edras, "edras");
        hero(wukong, "wukong");
        oldAiri = revision(airi, ruleset, 1, "PUBLISHED", firstPatch, "Airi old",
                Map.of("skill-1-1", "Long Kiếm", "skill-9-1", "Retired skill"));
        currentAiri = revision(airi, ruleset, 2, "PUBLISHED", secondPatch, "Airi", Map.of("skill-1-1", "Phi Tiêu"));
        revision(airi, ruleset, 3, "DRAFT", secondPatch, "Airi draft", Map.of("skill-1-1", "Draft shuriken"));
        revision(airi, ruleset, 4, "DISCARDED", secondPatch, "Discarded Airi", Map.of("skill-1-1", "Discarded skill"));
        revision(airi, otherRuleset, 5, "DRAFT", null, "Other Airi", Map.of("skill-1-1", "Other ruleset skill"));
        revision(edras, ruleset, 1, "PUBLISHED", firstPatch, "Edras",
                Map.of("skill-2-1", "Form two one", "skill-1-2", "Form one two", "capture-skill-1", "Named capture"));
        revision(edras, ruleset, 2, "PUBLISHED", futurePatch, "Future Edras", Map.of("skill-2-1", "Future skill",
                "skill-1-2", "Form one two", "capture-skill-1", "Named capture"));
        revision(wukong, ruleset, 1, "PUBLISHED", firstPatch, "Ngộ Không", Map.of("skill-1-1", "Phân Thân"));
        image(airi, 1, 1, null, library);
    }

    @Test
    void searchesDirectlyInEitherOrderPagesAndResolvesAuthoredOwnerMetadata() throws Exception {
        for (String q : List.of("chiêu 1 airi", "airi chiêu 1")) {
            var value = admin(q, null);
            assertThat(value.get("totalElements").asInt()).isEqualTo(1);
            var item = value.get("items").get(0);
            assertThat(item.get("id").asString()).isEqualTo(airi + ".skill-1-1");
            assertThat(item.get("translations").toString()).contains("Draft shuriken");
            assertThat(item.get("owner").get("translations").toString()).contains("Airi draft");
            assertThat(item.get("owner").get("iconAssetId").asString()).isEqualTo(head.toString());
            assertThat(item.get("iconAssetId").asString()).isEqualTo(library.toString());
            assertThat(item.get("iconSource").asString()).isEqualTo("LIBRARY");
            assertThat(item.get("destinations").get("admin").asString()).contains("tab=skills&skill=skill-1-1");
        }
        assertThat(admin("edras chiêu 2 1", null).get("items").get(0).get("skillKey").asString())
                .isEqualTo("skill-2-1");
        assertThat(admin("edras chiêu 1 2", null).get("items").get(0).get("skillKey").asString())
                .isEqualTo("skill-1-2");
        assertThat(admin("ngo khong", null).get("totalElements").asInt()).isEqualTo(1);
        assertThat(admin("%", null).get("totalElements").asInt()).isZero();
        mvc.perform(
                get(path()).param("rulesetId", ruleset.toString()).param("size", "1").param("page", "1").with(reader()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.totalElements").value(5));
    }

    @Test
    void idsCanResolveLastContainingSnapshotButSearchNeverOffersRemovedSkill() throws Exception {
        assertThat(admin("Retired", null).get("totalElements").asInt()).isZero();
        var value = admin("", airi + ".skill-9-1").get("items").get(0);
        assertThat(value.get("revisionId").asString()).isEqualTo(oldAiri.toString());
        assertThat(value.get("owner").get("translations").toString()).contains("Airi old");
        mvc.perform(get("/api/wiki/v1/reference-skills").param("ids", airi + ".skill-9-1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].revisionId").value(oldAiri.toString()));
    }

    @Test
    void publicUsesOnlyCurrentPublishedContextAndNeverLibraryOrFutureData() throws Exception {
        var result = mvc.perform(get("/api/wiki/v1/reference-skills").param("q", "airi chiêu 1"))
                .andExpect(status().isOk()).andExpect(header().exists("ETag"))
                .andExpect(jsonPath("$.items[0].revisionId").value(currentAiri.toString()))
                .andExpect(jsonPath("$.items[0].iconAssetId").doesNotExist())
                .andExpect(jsonPath("$.items[0].icon").value("/assets/" + authored)).andReturn().getResponse()
                .getContentAsString();
        assertThat(result).contains("Phi Tiêu", "tab=skills&skill=skill-1-1").doesNotContain("Draft shuriken",
                "Airi draft", "LIBRARY");
        mvc.perform(get("/api/wiki/v1/reference-skills").param("q", "edras chiêu 2 1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].translations[0].name").value("Form two one"))
                .andExpect(jsonPath("$.items[0].icon").doesNotExist());
    }

    @Test
    void validatesScopeAuthorityAndBoundedLookupInput() throws Exception {
        mvc.perform(get(path())).andExpect(status().isUnauthorized());
        mvc.perform(get(path()).with(jwt())).andExpect(status().isForbidden());
        for (var parameter : List.of("unknown", "region"))
            mvc.perform(get(path()).param(parameter, "x").with(reader())).andExpect(status().isBadRequest());
        for (var ids : List.of("bad", airi + ".", (airi + ".skill-1-1,").repeat(50) + airi + ".skill-1-1"))
            mvc.perform(get(path()).param("ids", ids).with(reader())).andExpect(status().isBadRequest());
        mvc.perform(get(path()).param("q", "airi").param("ids", airi + ".skill-1-1").with(reader()))
                .andExpect(status().isBadRequest());
        mvc.perform(get(path()).param("size", "101").with(reader())).andExpect(status().isBadRequest());
        mvc.perform(get(path()).param("page", "2147483647").with(reader())).andExpect(status().isBadRequest());
        mvc.perform(get(path()).param("locale", "vi_vn").with(reader())).andExpect(status().isUnprocessableEntity());
        mvc.perform(get(path()).param("locale", "en-US").with(reader())).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"));
        var invalid = UUID.randomUUID();
        doThrow(new ApiException(PatchErrorCode.PATCH_INVALID, "The ruleset is unavailable."))
                .when(contexts).requireRuleset(invalid);
        mvc.perform(get(path()).param("rulesetId", invalid.toString()).with(reader()))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void batchesProjectionCopiesAndLibraryWithoutPerSkillQueries() {
        var statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        var page = skills.admin(ruleset, "", null, List.of(), 0, 100);
        assertThat(page.items()).hasSize(5);
        assertThat(statistics.getPrepareStatementCount()).isEqualTo(5);
        assertThat(statistics.getEntityLoadCount()).isEqualTo(1);
        for (int index = 1; index <= 20; index++) {
            var owner = UUID.randomUUID();
            hero(owner, "extra-" + owner);
            revision(owner, ruleset, 1, "DRAFT", firstPatch, "Extra", Map.of("skill-1-1", "Extra skill"));
        }
        statistics.clear();
        assertThat(skills.admin(ruleset, "", null, List.of(), 0, 100).items()).hasSize(25);
        assertThat(statistics.getPrepareStatementCount()).isEqualTo(5);
    }

    @Test
    void authoredIconsWinAndAmbiguousLibraryBindingsAreNotGuessed() throws Exception {
        image(edras, 7, 1, "skill-2-1", library);
        image(edras, 8, 1, "skill-2-1", UUID.randomUUID());
        image(edras, 2, 1, null, UUID.randomUUID());
        assertThat(admin("edras chiêu 2 1", null).get("items").get(0).get("iconAssetId")).isNull();
        image(edras, 1, 2, null, library);
        assertThat(admin("edras chiêu 1 2", null).get("items").get(0).get("iconSource").asString())
                .isEqualTo("LIBRARY");
        sql.update("update hero.hero_skill_snapshot set icon_asset_id=? where skill_set_revision_id="
                + "(select skills_revision_id from hero.hero_revision where hero_id=? and revision_no=3)", authored,
                airi);
        assertThat(admin("airi chiêu 1", null).get("items").get(0).get("iconAssetId").asString())
                .isEqualTo(authored.toString());
        assertThat(admin("airi chiêu 1", null).get("items").get(0).get("iconSource").asString()).isEqualTo("REVISION");
        assertThat(skills.published(context(2), Instant.now(), "vi-VN", "airi chiêu 1", null, List.of(), 0, 20)
                .items().getFirst().iconSource()).isEqualTo("REVISION");
        assertThat(skills.admin(ruleset, "edras chiêu 1", null, List.of(), 0, 20).items())
                .filteredOn(i -> i.skillKey().equals("capture-skill-1")).allSatisfy(i -> {
                    assertThat(i.variantNo()).isNull();
                    assertThat(i.iconAssetId()).isNull();
                });
    }

    private tools.jackson.databind.JsonNode admin(String q, String ids) throws Exception {
        var request = get(path()).param("rulesetId", ruleset.toString()).param("q", q).with(reader());
        if (ids != null)
            request.param("ids", ids);
        return json.readTree(
                mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
    private static String path() {
        return "/api/wiki/v1/admin/reference-skills";
    }
    private static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor reader() {
        return jwt().authorities(new SimpleGrantedAuthority("catalog:read"));
    }
    private GameplayContext context(long ordinal) {
        return new GameplayContext(UUID.randomUUID(), "VN", ruleset, "aov-standard", UUID.randomUUID(), "current",
                ordinal == 1 ? firstPatch : secondPatch, ordinal, Instant.now());
    }
    private void hero(UUID id, String code) {
        sql.update("insert into hero.hero values (?,?,now(),'test','editor')", id, code);
    }
    private void image(UUID owner, int slot, int variant, String key, UUID asset) {
        sql.update("insert into hero.hero_skill_image values (?,?,?,?,?,?,?,null,1,now(),now())",
                UUID.randomUUID(), owner, key, slot, variant, asset, "source-" + slot + "-" + variant + ".png");
    }
    private UUID revision(UUID owner, UUID scope, int number, String state, UUID patch, String name,
            Map<String, String> names) {
        var sections = new ArrayList<UUID>();
        for (String table : List.of("hero_profile_revision", "hero_overview_rating_revision",
                "hero_combat_stats_revision",
                "hero_skill_set_revision", "hero_skin_set_revision", "hero_media_binding_revision")) {
            var id = UUID.randomUUID();
            sections.add(id);
            sql.update(
                    "insert into hero." + table + " (id,hero_id,state,created_at,created_by_issuer,created_by_subject)"
                            + " values (?,?,'DRAFT',now(),'test','editor')",
                    id, owner);
        }
        for (String locale : List.of("vi-VN", "en-US"))
            sql.update(
                    "insert into hero.hero_profile_translation(profile_revision_id,locale,name,summary) values (?,?,?,?)",
                    sections.getFirst(), locale, name, "Private full summary");
        sql.update("insert into hero.hero_media_binding values (?,'HEAD',?)", sections.get(5), head);
        int order = 0;
        for (var entry : new TreeMap<>(names).entrySet()) {
            sql.update("insert into hero.hero_skill values (?,?,now()) on conflict do nothing", owner, entry.getKey());
            UUID icon = owner.equals(airi) && number == 2 ? authored : null;
            sql.update(
                    "insert into hero.hero_skill_snapshot(skill_set_revision_id,hero_id,skill_key,kind,display_order,icon_asset_id)"
                            + " values (?,?,?,'ACTIVE',?,?)",
                    sections.get(3), owner, entry.getKey(), order++, icon);
            for (String locale : List.of("vi-VN", "en-US"))
                sql.update(
                        "insert into hero.hero_skill_translation(skill_set_revision_id,skill_key,locale,name,description)"
                                + " values (?,?,?,?,?)",
                        sections.get(3), entry.getKey(), locale, entry.getValue(), "D".repeat(5000));
        }
        var id = UUID.randomUUID();
        sql.update(
                "insert into hero.hero_revision(id,hero_id,ruleset_id,revision_no,state,version,publication_sequence,"
                        + "published_at,cause,effective_from_patch_variant_id,profile_revision_id,overview_rating_revision_id,"
                        + "combat_stats_revision_id,skills_revision_id,skins_revision_id,media_binding_revision_id,created_at,"
                        + "updated_at,created_by_issuer,created_by_subject,updated_by_issuer,updated_by_subject)"
                        + " values (?,?,?,?,?,1,?,?,'DATA_BASELINE',?,?,?,?,?,?,?,now(),now(),'test','editor','test','editor')",
                id, owner, scope, number, state, state.equals("PUBLISHED") ? (long) number : null,
                state.equals("PUBLISHED") ? java.sql.Timestamp.from(Instant.now().minusSeconds(60)) : null,
                patch, sections.get(0), sections.get(1), sections.get(2), sections.get(3), sections.get(4),
                sections.get(5));
        return id;
    }
}
