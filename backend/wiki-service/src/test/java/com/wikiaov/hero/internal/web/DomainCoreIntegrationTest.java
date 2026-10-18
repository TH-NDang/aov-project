package com.wikiaov.hero.internal.web;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.wikiaov.MutableClock;
import com.wikiaov.media.*;
import com.wikiaov.patch.GameplayContexts;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.*;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.*;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(DomainCoreIntegrationTest.Beans.class)
@EnabledIf("databaseAvailable")
class DomainCoreIntegrationTest {
    private static final String ROOT = "/api/wiki/v1";
    private static final UUID VN = UUID.fromString("5d5dcd5e-15b9-4d43-884d-111111111111");
    private static final UUID TH = UUID.fromString("5d5dcd5e-15b9-4d43-884d-222222222222");
    private static PostgreSQLContainer database;
    static boolean databaseAvailable() {
        return System.getenv("WIKI_TEST_DB_URL") != null || DockerClientFactory.instance().isDockerAvailable();
    }
    @DynamicPropertySource
    static void database(DynamicPropertyRegistry props) {
        String external = System.getenv("WIKI_TEST_DB_URL");
        if (external != null) {
            props.add("spring.datasource.url", () -> external);
            props.add("spring.datasource.username", () -> "wiki_test");
            props.add("spring.datasource.password", () -> "");
        } else {
            database = new PostgreSQLContainer("postgres:17.6");
            database.start();
            props.add("spring.datasource.url", database::getJdbcUrl);
            props.add("spring.datasource.username", database::getUsername);
            props.add("spring.datasource.password", database::getPassword);
        }
    }
    @AfterAll
    static void stop() {
        if (database != null)
            database.stop();
    }
    @TestConfiguration
    static class Beans {
        @Bean
        @Primary
        MutableClock domainClock() {
            return new MutableClock(Instant.parse("2026-10-15T00:00:00Z"));
        }
    }
    @Autowired
    MockMvc mvc;
    @Autowired
    JsonMapper json;
    @Autowired
    JdbcClient jdbc;
    final GameplayContexts contexts;
    @Autowired
    DomainCoreIntegrationTest(GameplayContexts contexts) {
        this.contexts = contexts;
    }
    @Autowired
    MutableClock clock;
    @MockitoBean
    MediaAssets media;
    @Autowired
    List<MediaUsageProvider> usageProviders;
    @Autowired
    com.wikiaov.hero.internal.application.service.HeroImportJobs importJobs;
    private UUID ruleset, variant, patch;
    private final Map<MediaSemanticType, UUID> assets = new EnumMap<>(MediaSemanticType.class);
    @BeforeEach
    void setup() throws Exception {
        clock.set(Instant.parse("2026-10-15T00:00:00Z"));
        jdbc.sql("TRUNCATE hero.import_job").update();
        jdbc.sql("TRUNCATE hero.hero CASCADE").update();
        jdbc.sql("TRUNCATE hero.hero_source_reference").update();
        jdbc.sql("TRUNCATE patch.game_patch,patch.gameplay_ruleset,patch.ranked_season CASCADE").update();
        jdbc.sql("UPDATE patch.region SET lifecycle_state='LOCKED',unavailable_reason='Not verified' WHERE code='TH'")
                .update();
        for (var type : List.of(MediaSemanticType.HERO_HEAD, MediaSemanticType.HERO_PORTRAIT,
                MediaSemanticType.HERO_SPLASH, MediaSemanticType.HERO_SKILL_ICON, MediaSemanticType.HERO_SKIN_ART)) {
            UUID id = UUID.randomUUID();
            assets.put(type, id);
            when(media.find(id)).thenReturn(Optional.of(
                    new MediaAssetReference(id, type, MediaAssetState.ACTIVE, new MediaAssetReference.CurrentVersion(
                            UUID.randomUUID(), "image/webp", 100, 100, "/media/" + id + "/v1.webp"))));
        }
        ruleset = id(send(post(ROOT + "/admin/rulesets"),
                Map.of("code", "AOV-TEST", "description", "Verified test fixture"), 201));
        assign(VN, ruleset, "2026-01-01T00:00:00Z", null, 201);
        patch = id(send(post(ROOT + "/admin/patches"),
                Map.of("code", "patch-test-1", "translations",
                        List.of(Map.of("locale", "vi-VN", "title", "Bản thử nghiệm", "summary", "Dữ liệu kiểm thử"))),
                201));
        variant = id(send(post(ROOT + "/admin/patches/" + patch + "/variants"),
                Map.of("rulesetId", ruleset, "variantCode", "TEST", "rulesetOrdinal", 1), 201));
        send(post(ROOT + "/admin/patch-variants/" + variant + "/publish"), null, 204);
        release(variant, VN, "2026-01-02T00:00:00Z", 201);
    }
    @Test
    void overviewUsesServerTimeAndKeepsFutureRolloutsSeparate() throws Exception {
        seedImportSeason();
        var futurePatch = id(send(post(ROOT + "/admin/patches"), Map.of("code", "next-patch", "translations",
                List.of(Map.of("locale", "vi-VN", "title", "Next", "summary", "Next patch"))), 201));
        var futureVariant = id(send(post(ROOT + "/admin/patches/" + futurePatch + "/variants"),
                Map.of("rulesetId", ruleset, "variantCode", "NEXT", "rulesetOrdinal", 2), 201));
        send(post(ROOT + "/admin/patch-variants/" + futureVariant + "/publish"), null, 204);
        release(futureVariant, VN, "2026-12-01T00:00:00Z", 201);
        mvc.perform(get(ROOT + "/admin/publication-overview")).andExpect(status().isUnauthorized());
        mvc.perform(get(ROOT + "/admin/publication-overview")
                .with(jwt().authorities(new SimpleGrantedAuthority("hero:write"))))
                .andExpect(status().isForbidden());
        var overview = send(get(ROOT + "/admin/publication-overview"), null, 200);
        var markets = (List<Map<String, Object>>) overview.get("markets");
        var vn = markets.stream().filter(m -> "VN".equals(m.get("code"))).findFirst().orElseThrow();
        assertThat(vn).containsEntry("currentReleaseId", releaseId(variant).toString());
        assertThat(vn.get("currentSeasonId")).isNotNull();
        var rows = (List<Map<String, Object>>) overview.get("releases");
        assertThat(rows.stream().filter(r -> futureVariant.toString().equals(r.get("variantId"))).findFirst()
                .orElseThrow())
                .containsEntry("phase", "UPCOMING");
        clock.set(Instant.parse("2026-12-01T00:00:00Z"));
        overview = send(get(ROOT + "/admin/publication-overview"), null, 200);
        markets = (List<Map<String, Object>>) overview.get("markets");
        assertThat(markets.stream().filter(m -> "VN".equals(m.get("code"))).findFirst().orElseThrow())
                .containsEntry("currentReleaseId", releaseId(futureVariant).toString());
        mvc.perform(get(ROOT + "/admin/patch-variants/" + variant + "/hero-changes")
                .with(jwt().authorities(new SimpleGrantedAuthority("catalog:read"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        send(get(ROOT + "/admin/publication-overview?unknown=1"), null, 400);
    }

    @Test
    void adminCanResumePatchSetupAndIncompleteHeroPublicationIsRejected() throws Exception {
        mvc.perform(get(ROOT + "/admin/patches")).andExpect(status().isUnauthorized());
        var catalog = send(get(ROOT + "/admin/patches?page=0&size=20"), null, 200);
        assertThat(((List<?>) catalog.get("items"))).hasSize(1);
        var assignments = mvc.perform(get(ROOT + "/admin/regions/" + VN + "/ruleset-assignments")
                .with(jwt().authorities(new SimpleGrantedAuthority("catalog:read"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(assignments).contains("rulesetId", ruleset.toString(), "validFrom");
        var draft = create();
        send(post(path(uuid(draft, "heroId"), id(draft)) + "/publish"),
                Map.of("expectedVersion", 1), 422);
        send(get(ROOT + "/admin/patches?size=101"), null, 422);
    }
    @Test
    void regionalTimelineIsIndependentOfLocaleAndRejectsOverlap() throws Exception {
        assertThat(contexts.resolve("VN", clock.instant()).patchVariantId()).isEqualTo(variant);
        assign(VN, ruleset, "2026-02-01T00:00:00Z", null, 409);
        jdbc.sql("UPDATE patch.region SET lifecycle_state='ACTIVE',unavailable_reason=NULL WHERE id=?").param(TH)
                .update();
        assign(TH, ruleset, "2026-01-01T00:00:00Z", null, 201);
        release(variant, TH, "2026-01-03T00:00:00Z", 201);
        assertThatThrownBy(() -> contexts.resolve("TH", Instant.parse("2026-01-02T12:00:00Z")))
                .hasMessageContaining("No verified gameplay context");
        assertThat(contexts.resolve("VN", Instant.parse("2026-01-02T12:00:00Z")).patchVariantId()).isEqualTo(variant);
        assertThat(contexts.resolve("TH", Instant.parse("2026-01-03T00:00:00Z")).rulesetId()).isEqualTo(ruleset);
        assertThatThrownBy(() -> contexts.resolve("ID", clock.instant())).hasMessageContaining("unavailable");
    }
    @Test
    void completeHeroLifecycleReusesSectionsAndKeepsImmutableResourcesStable() throws Exception {
        var draft = create();
        UUID hero = uuid(draft, "heroId"), draftId = uuid(draft, "id");
        mvc.perform(get(ROOT + "/heroes/" + hero)).andExpect(status().isNotFound());
        draft = complete(hero, draftId, draft);
        long version = number(draft, "version");
        send(post(path(hero, draftId) + "/publish"), Map.of("expectedVersion", version), 200);
        var publicResult = mvc.perform(get(ROOT + "/heroes/" + hero)).andExpect(status().isOk())
                .andExpect(jsonPath("$.content.profile.name").value("Nakroth"))
                .andExpect(jsonPath("$.content.profile.sources").doesNotExist()).andReturn();
        String tag = publicResult.getResponse().getHeader("ETag");
        mvc.perform(get(ROOT + "/heroes/" + hero).header("If-None-Match", tag)).andExpect(status().isNotModified());
        mvc.perform(get(ROOT + "/heroes/" + hero).param("locale", "en-US")).andExpect(status().isOk())
                .andExpect(jsonPath("$.context.actualLocale").value("vi-VN"))
                .andExpect(jsonPath("$.context.fallbackApplied").value(true));
        var refs = (Map<String, String>) draft.get("sections");
        String profile = refs.get("profile");
        var section = mvc.perform(get(ROOT + "/hero-profile-revisions/" + profile)).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("immutable")))
                .andReturn();
        assertThatThrownBy(
                () -> jdbc.sql("UPDATE hero.hero_profile_translation SET name='Tampered' WHERE profile_revision_id=?")
                        .param(UUID.fromString(profile)).update())
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
        var correction = send(post(ROOT + "/admin/heroes/" + hero + "/drafts"),
                Map.of("rulesetId", ruleset, "sourceRevisionId", draftId, "cause", "CONTENT_CORRECTION"), 201);
        UUID c = uuid(correction, "id");
        var statUpdate = Map.of("expectedDraftVersion", 1, "values",
                List.of(Map.of("statKey", "HP", "baseValue", 3600, "growthPerLevel", 250, "unit", "POINT")));
        correction = send(put(path(hero, c) + "/combat-stats"), statUpdate, 200);
        mvc.perform(get(ROOT + "/admin/heroes/" + hero + "/revisions/" + c + "/comparison")
                .with(jwt().authorities(new SimpleGrantedAuthority("catalog:read"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("AVAILABLE"))
                .andExpect(jsonPath("$.from.id").value(draftId.toString()))
                .andExpect(jsonPath("$.changes[0].section").value("combatStats"))
                .andExpect(jsonPath("$.changes[0].path").value("/values/HP/baseValue"));
        send(get(ROOT + "/admin/heroes/" + hero + "/revisions/" + c + "/comparison?unknown=1"), null, 400);
        send(put(path(hero, c) + "/combat-stats"), statUpdate, 409);
        send(post(path(hero, c) + "/publish"), Map.of("expectedVersion", number(correction, "version")), 200);
        assertThat(((Map<?, ?>) correction.get("sections")).get("profile")).isEqualTo(profile);
        assertThat(((Map<?, ?>) correction.get("sections")).get("combatStats")).isNotEqualTo(refs.get("combatStats"));
        mvc.perform(get(ROOT + "/heroes/" + hero + "/changes")).andExpect(jsonPath("$.items.length()").value(0));
        UUID portrait = assets.get(MediaSemanticType.HERO_PORTRAIT);
        when(media.find(portrait))
                .thenReturn(Optional.of(new MediaAssetReference(portrait, MediaSemanticType.HERO_PORTRAIT,
                        MediaAssetState.ACTIVE, new MediaAssetReference.CurrentVersion(UUID.randomUUID(), "image/webp",
                                4096, 4096, "/media/new-v2.webp"))));
        var upgraded = mvc.perform(get(ROOT + "/heroes/" + hero)).andExpect(status().isOk())
                .andExpect(jsonPath("$.revisionId").value(c.toString())).andReturn();
        assertThat(upgraded.getResponse().getHeader("ETag")).isNotEqualTo(tag);
        var unchanged = mvc.perform(get(ROOT + "/hero-profile-revisions/" + profile)).andExpect(status().isOk())
                .andReturn();
        assertThat(unchanged.getResponse().getHeader("ETag")).isEqualTo(section.getResponse().getHeader("ETag"));
        var usages = usageProviders.stream().flatMap(p -> p.findUsages(portrait).stream()).toList();
        assertThat(usages).anyMatch(u -> u.scope() == MediaUsageScope.CURRENT && u.revisionId().equals(c));
        assertThat(usages).anyMatch(u -> u.scope() == MediaUsageScope.HISTORICAL && u.revisionId().equals(draftId));
    }
    @Test
    void draftVisibilityDiscardValidationAndPermissions() throws Exception {
        var d = create();
        UUID hero = uuid(d, "heroId"), id = uuid(d, "id");
        send(post(path(hero, id) + "/publish"), Map.of("expectedVersion", 1), 422);
        send(put(path(hero, id) + "/media-bindings"),
                Map.of("expectedDraftVersion", 1, "bindings",
                        Map.of("HEAD", assets.get(MediaSemanticType.HERO_PORTRAIT), "PORTRAIT",
                                assets.get(MediaSemanticType.HERO_PORTRAIT), "SPLASH",
                                assets.get(MediaSemanticType.HERO_SPLASH))),
                422);
        mvc.perform(
                post(path(hero, id) + "/publish").with(jwt().authorities(new SimpleGrantedAuthority("catalog:read")))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":1}"))
                .andExpect(status().isForbidden());
        mvc.perform(get(ROOT + "/admin/heroes/" + hero + "/drafts/" + id)).andExpect(status().isUnauthorized());
        var discarded = send(post(path(hero, id) + "/discard"), Map.of("expectedVersion", 1), 200);
        assertThat(discarded.get("state")).isEqualTo("DISCARDED");
        send(post(path(hero, id) + "/publish"), Map.of("expectedVersion", 2), 409);
        mvc.perform(get(ROOT + "/hero-profile-revisions/" + ((Map<?, ?>) d.get("sections")).get("profile")))
                .andExpect(status().isNotFound());
        mvc.perform(get(ROOT + "/heroes?regoin=VN")).andExpect(status().isBadRequest());
    }
    @Test
    void patchChangesAreExplicitAndQueryableInBothDirections() throws Exception {
        var baseline = create();
        UUID hero = uuid(baseline, "heroId"), original = uuid(baseline, "id");
        baseline = complete(hero, original, baseline);
        send(post(path(hero, original) + "/publish"), Map.of("expectedVersion", number(baseline, "version")), 200);
        UUID patch2 = id(send(post(ROOT + "/admin/patches"), Map.of("code", "patch-test-2", "translations",
                List.of(Map.of("locale", "vi-VN", "title", "Hai", "summary", ""))), 201));
        UUID v2 = id(send(post(ROOT + "/admin/patches/" + patch2 + "/variants"),
                Map.of("rulesetId", ruleset, "variantCode", "TEST", "rulesetOrdinal", 2), 201));
        send(post(ROOT + "/admin/patch-variants/" + v2 + "/publish"), null, 204);
        var fork = send(post(ROOT + "/admin/heroes/" + hero + "/drafts"), Map.of("rulesetId", ruleset,
                "sourceRevisionId", original, "cause", "GAME_PATCH", "effectiveFromPatchVariantId", v2), 201);
        UUID id = uuid(fork, "id");
        fork = send(put(path(hero, id) + "/combat-stats"), Map.of("expectedDraftVersion", 1, "values",
                List.of(Map.of("statKey", "HP", "baseValue", 3600, "unit", "POINT"))), 200);
        send(post(path(hero, id) + "/publish"), Map.of("expectedVersion", number(fork, "version")), 200);
        mvc.perform(get(ROOT + "/heroes/" + hero)).andExpect(jsonPath("$.revisionId").value(original.toString()));
        var change = Map.of("heroId", hero, "fromHeroRevisionId", original, "toHeroRevisionId", id,
                "summaryTranslations", List.of(Map.of("locale", "vi-VN", "summary", "Tăng máu")), "changes",
                List.of(Map.of("type", "STAT", "statKey", "HP", "oldValue", 3500, "newValue", 3600, "unit", "POINT",
                        "changeKind", "BUFF")));
        send(post(ROOT + "/admin/patch-variants/" + v2 + "/hero-changes"), change, 201);
        send(post(ROOT + "/admin/patch-variants/" + v2 + "/hero-changes"), change, 409);
        release(v2, VN, "2026-10-16T00:00:00Z", 201);
        clock.set(Instant.parse("2026-10-16T00:00:01Z"));
        mvc.perform(get(ROOT + "/heroes/" + hero + "/changes")).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].changes[0].type").value("HERO_STAT_CHANGE"));
        mvc.perform(get(ROOT + "/patches/" + patch2 + "/changes")).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].heroId").value(hero.toString()));

        mvc.perform(get(ROOT + "/heroes/" + hero)).andExpect(jsonPath("$.revisionId").value(id.toString()));
    }

    @Test
    void heroCatalogFiltersOnlyCuratedChangesAndKeepsAllSeasonPatchesInGameplayOrder() throws Exception {
        var baseline = create();
        UUID hero = uuid(baseline, "heroId"), baselineId = id(baseline);
        baseline = complete(hero, baselineId, baseline);
        baseline = send(post(path(hero, baselineId) + "/publish"), Map.of("expectedVersion", baseline.get("version")),
                200);
        UUID season = id(send(post(ROOT + "/admin/seasons"),
                Map.of("code", "catalog-season", "displayName", "Catalog season"), 201));
        UUID first = id(send(post(ROOT + "/admin/season-patches"), Map.of("seasonId", season, "rulesetId", ruleset,
                "patch", Map.of("code", "catalog-first", "translations",
                        List.of(Map.of("locale", "vi-VN", "title", "First", "summary", "")))),
                201));
        UUID second = id(send(post(ROOT + "/admin/season-patches"), Map.of("seasonId", season, "rulesetId", ruleset,
                "patch", Map.of("code", "catalog-second", "translations",
                        List.of(Map.of("locale", "vi-VN", "title", "Second", "summary", "")))),
                201));
        send(post(ROOT + "/admin/patch-variants/" + first + "/publish"), null, 204);
        send(post(ROOT + "/admin/patch-variants/" + second + "/publish"), null, 204);
        clock.set(Instant.parse("2026-10-15T01:00:00Z"));
        var buff = catalogPatchRevision(baseline, first, 3600, "First patch name");
        clock.set(Instant.parse("2026-10-15T02:00:00Z"));
        var nerf = catalogPatchRevision(buff, second, 3400, "Current patch name");
        assertThat(send(get(ROOT + "/admin/heroes?seasonId=" + season), null, 200).get("totalElements")).isEqualTo(0);
        clock.set(Instant.parse("2026-10-15T03:00:00Z"));
        UUID newerChange = id(send(post(ROOT + "/admin/patch-variants/" + second + "/hero-changes"), Map.of(
                "heroId", hero, "fromHeroRevisionId", buff.get("id"), "toHeroRevisionId", nerf.get("id"),
                "summaryTranslations",
                List.of(Map.of("locale", "vi-VN", "summary", "Giảm máu"),
                        Map.of("locale", "en-US", "summary", "Reduced health")),
                "changes", List.of(Map.of("type", "STAT", "changeKind", "NERF", "statKey", "HP", "oldValue", 3600,
                        "newValue", 3400, "unit", "POINT"),
                        Map.of("type", "MECHANIC", "changeKind", "ADJUSTMENT", "mechanicKey", "fixture", "description",
                                "Synthetic adjustment"),
                        Map.of("type", "OTHER", "changeKind", "REWORK", "description", "Synthetic rework"))),
                201));
        clock.set(Instant.parse("2026-10-15T04:00:00Z"));
        UUID olderChange = id(send(post(ROOT + "/admin/patch-variants/" + first + "/hero-changes"), Map.of(
                "heroId", hero, "fromHeroRevisionId", baselineId, "toHeroRevisionId", buff.get("id"),
                "summaryTranslations", List.of(Map.of("locale", "vi-VN", "summary", "Tăng máu")),
                "changes", List.of(Map.of("type", "STAT", "changeKind", "BUFF", "statKey", "HP", "oldValue", 3500,
                        "newValue", 3600, "unit", "POINT"))),
                201));
        clock.set(Instant.parse("2026-10-15T05:00:00Z"));
        var observed = send(post(ROOT + "/admin/heroes"),
                Map.of("code", "airi", "name", "Earlier name", "initialLocale", "vi-VN",
                        "rulesetId", ruleset, "contextId", first),
                201);
        clock.set(Instant.parse("2026-10-15T06:00:00Z"));
        send(put(path(uuid(observed, "heroId"), id(observed)) + "/profile"),
                Map.of("expectedDraftVersion", observed.get("version"),
                        "translations", List.of(Map.of("locale", "vi-VN", "name", "New Airi 100%")), "roles",
                        List.of()),
                200);
        var all = send(get(ROOT + "/admin/heroes?sort=edited-desc"), null, 200);
        var allRows = (List<Map<String, Object>>) all.get("items");
        assertThat(all.get("totalElements")).isEqualTo(2);
        assertThat(allRows.getFirst()).containsEntry("code", "airi").containsEntry("lastEditedAt",
                "2026-10-15T06:00:00Z");
        assertThat((List<?>) allRows.getFirst().get("gameplayChanges")).isEmpty();
        var changes = (List<Map<String, Object>>) allRows.get(1).get("gameplayChanges");
        assertThat(changes).hasSize(1);
        assertThat(changes.getFirst()).containsEntry("id", newerChange.toString());
        assertThat(allRows.get(1)).containsEntry("lastEditedAt", "2026-10-15T02:00:00Z");
        var scoped = send(get(ROOT + "/admin/heroes?seasonId=" + season + "&locale=en-US"), null, 200);
        assertThat(scoped.get("totalElements")).isEqualTo(1);
        changes = (List<Map<String, Object>>) ((List<Map<String, Object>>) scoped.get("items")).getFirst()
                .get("gameplayChanges");
        assertThat(changes).extracting(change -> change.get("id")).containsExactly(newerChange.toString(),
                olderChange.toString());
        assertThat(changes.getFirst()).containsEntry("summary", "Reduced health").containsEntry("actualLocale",
                "en-US");
        assertThat(changes.getFirst().get("changeKinds")).isEqualTo(List.of("NERF", "ADJUSTMENT", "REWORK"));
        assertThat(changes.get(1)).containsEntry("summary", "Tăng máu").containsEntry("actualLocale", "vi-VN");
        var exact = send(get(ROOT + "/admin/heroes?seasonId=" + season + "&patchVariantId=" + first), null, 200);
        changes = (List<Map<String, Object>>) ((List<Map<String, Object>>) exact.get("items")).getFirst()
                .get("gameplayChanges");
        assertThat(changes).hasSize(1);
        assertThat(changes.getFirst()).containsEntry("id", olderChange.toString());
        assertThat(send(get(ROOT + "/admin/heroes").param("q", "new airi").param("size", "1"), null, 200)
                .get("totalElements")).isEqualTo(1);
        assertThat(send(get(ROOT + "/admin/heroes").param("q", "Earlier name"), null, 200).get("totalElements"))
                .isEqualTo(0);
        assertThat(send(get(ROOT + "/admin/heroes").param("q", "%"), null, 200).get("totalElements")).isEqualTo(1);
        assertThat(send(get(ROOT + "/admin/heroes").param("q", "First patch name"), null, 200)
                .get("totalElements")).isEqualTo(0);
        assertThat(send(get(ROOT + "/admin/heroes").param("seasonId", season.toString())
                .param("q", "First patch name"), null, 200).get("totalElements")).isEqualTo(0);
        assertThat(send(get(ROOT + "/admin/heroes").param("patchVariantId", first.toString())
                .param("q", "First patch name"), null, 200).get("totalElements")).isEqualTo(1);
        assertThat(send(get(ROOT + "/admin/heroes?q=_"), null, 200).get("totalElements")).isEqualTo(0);
        assertThat(send(get(ROOT + "/admin/heroes?seasonId=" + season + "&q=airi"), null, 200).get("totalElements"))
                .isEqualTo(0);
        assertThat(send(get(ROOT + "/admin/heroes?page=1&size=1"), null, 200).get("totalElements")).isEqualTo(2);
        send(get(ROOT + "/admin/heroes?seasonId=" + season + "&patchVariantId=" + variant), null, 422);
        send(get(ROOT + "/admin/heroes?sort=unknown"), null, 422);
        send(get(ROOT + "/admin/heroes?q=" + "a".repeat(101)), null, 422);
        send(get(ROOT + "/admin/heroes?unknown=1"), null, 400);

        clock.set(Instant.parse("2026-10-15T07:00:00Z"));
        var correction = send(post(ROOT + "/admin/heroes/" + hero + "/drafts"),
                Map.of("rulesetId", ruleset, "sourceRevisionId", baselineId,
                        "cause", "CONTENT_CORRECTION", "effectiveFromPatchVariantId", variant),
                201);
        send(put(path(hero, id(correction)) + "/profile"),
                Map.of("expectedDraftVersion", correction.get("version"), "translations",
                        List.of(Map.of("locale", "vi-VN", "name", "Historical backfill")),
                        "roles", List.of("ASSASSIN")),
                200);
        assertThat(send(get(ROOT + "/admin/heroes").param("q", "Historical backfill"), null, 200)
                .get("totalElements")).isEqualTo(0);
        assertThat(send(get(ROOT + "/admin/heroes").param("q", "Current patch name"), null, 200).get("totalElements"))
                .isEqualTo(1);
        assertThat(send(get(ROOT + "/admin/heroes").param("seasonId", season.toString())
                .param("q", "Historical backfill"), null, 200).get("totalElements")).isEqualTo(0);
    }

    private Map<String, Object> catalogPatchRevision(Map<String, Object> source, UUID patchVariant, int health,
            String name)
            throws Exception {
        UUID hero = uuid(source, "heroId");
        var draft = send(post(ROOT + "/admin/heroes/" + hero + "/drafts"),
                Map.of("rulesetId", ruleset, "sourceRevisionId", source.get("id"),
                        "cause", "GAME_PATCH", "effectiveFromPatchVariantId", patchVariant),
                201);
        draft = send(put(path(hero, id(draft)) + "/combat-stats"), Map.of("expectedDraftVersion", draft.get("version"),
                "values", List.of(Map.of("statKey", "HP", "baseValue", health, "unit", "POINT"))), 200);
        draft = send(put(path(hero, id(draft)) + "/profile"),
                Map.of("expectedDraftVersion", draft.get("version"), "translations",
                        List.of(Map.of("locale", "vi-VN", "name", name)), "roles", List.of("ASSASSIN")),
                200);
        return send(post(path(hero, id(draft)) + "/publish"), Map.of("expectedVersion", draft.get("version")), 200);
    }
    @Test
    void concurrentEditorsCannotOverwriteEachOther() throws Exception {
        var draft = create();
        UUID hero = uuid(draft, "heroId"), id = uuid(draft, "id");
        var executor = Executors.newFixedThreadPool(2);
        var start = new CountDownLatch(1);
        try {
            List<Future<Integer>> results = new ArrayList<>();
            for (String name : List.of("Editor A", "Editor B"))
                results.add(executor.submit(() -> {
                    start.await();
                    String payload = json.writeValueAsString(Map.of("expectedDraftVersion", 1, "translations",
                            List.of(Map.of("locale", "vi-VN", "name", name)), "roles", List.of("ASSASSIN")));
                    return mvc
                            .perform(put(path(hero, id) + "/profile")
                                    .with(jwt().jwt(t -> t.issuer("https://test.example/issuer").subject(name))
                                            .authorities(new SimpleGrantedAuthority("catalog:read"),
                                                    new SimpleGrantedAuthority("hero:write")))
                                    .contentType(MediaType.APPLICATION_JSON).content(payload))
                            .andReturn().getResponse().getStatus();
                }));
            start.countDown();
            assertThat(List.of(results.get(0).get(10, TimeUnit.SECONDS), results.get(1).get(10, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(200, 409);
            assertThat(
                    jdbc.sql("SELECT version FROM hero.hero_revision WHERE id=?").param(id).query(Long.class).single())
                    .isEqualTo(2L);
            assertThat(jdbc.sql(
                    "SELECT count(*) FROM access.audit_event WHERE aggregate_id=? AND action='HERO_SECTION_UPDATED'")
                    .param(hero).query(Long.class).single()).isEqualTo(1L);
        } finally {
            executor.shutdownNow();
        }
    }
    @Test
    void rejectsCrossHeroCompositionAndDuplicateDrafts() throws Exception {
        var draft = create();
        UUID hero = uuid(draft, "heroId"), id = uuid(draft, "id");
        var other = send(post(ROOT + "/admin/heroes"),
                Map.of("code", "violet", "name", "Violet", "initialLocale", "vi-VN", "rulesetId", ruleset, "releaseId",
                        releaseId(variant)),
                201);
        UUID profile = UUID.fromString((String) ((Map<?, ?>) other.get("sections")).get("profile"));
        assertThatThrownBy(() -> jdbc.sql("UPDATE hero.hero_revision SET profile_revision_id=? WHERE id=?")
                .params(profile, id).update()).isInstanceOf(org.springframework.dao.DataAccessException.class);
        send(post(ROOT + "/admin/heroes/" + hero + "/drafts"),
                Map.of("rulesetId", ruleset, "sourceRevisionId", id, "cause", "CONTENT_CORRECTION"), 409);
        mvc.perform(get(ROOT + "/heroes?region=VN&region=TH")).andExpect(status().isBadRequest());
        mvc.perform(get(ROOT + "/heroes?size=101")).andExpect(status().isUnprocessableEntity());
    }
    private Map<String, Object> create() throws Exception {
        seedImportSeason();
        return send(post(ROOT + "/admin/heroes"),
                Map.of("code", "nakroth", "initialLocale", "vi-VN", "name", "Nakroth", "rulesetId", ruleset,
                        "releaseId", releaseId(variant)),
                201);
    }
    private Map<String, Object> complete(UUID hero, UUID id, Map<String, Object> draft) throws Exception {
        String p = path(hero, id);
        long version = number(draft, "version");
        draft = send(put(p + "/profile"), Map.of("expectedDraftVersion", version, "translations",
                List.of(Map.of("locale", "vi-VN", "name", "Nakroth")), "roles", List.of("ASSASSIN")), 200);
        draft = send(
                put(p + "/overview-ratings"), Map.of("expectedDraftVersion", number(draft, "version"), "scaleCode",
                        "GAME_OVERVIEW_10", "survivability", 5, "attackDamage", 8, "skillEffects", 6, "difficulty", 8),
                200);
        draft = send(put(p + "/combat-stats"), Map.of("expectedDraftVersion", number(draft, "version"), "values",
                List.of(Map.of("statKey", "HP", "baseValue", 3500, "unit", "POINT")), "sources",
                List.of(Map.of("label", "Verified fixture", "sourceUrl", "https://example.org/fixture",
                        "verificationState", "VERIFIED"))),
                200);
        draft = send(put(p + "/skills"), Map.of("expectedDraftVersion", number(draft, "version"), "skills",
                List.of(Map.of("skillKey", "skill-1", "kind", "ACTIVE", "displayOrder", 0, "iconAssetId",
                        assets.get(MediaSemanticType.HERO_SKILL_ICON), "translations",
                        List.of(Map.of("locale", "vi-VN", "name", "Chiêu 1", "description", "Mô tả đã kiểm chứng")),
                        "effects", List.of()))),
                200);
        draft = send(put(p + "/skins"), Map.of("expectedDraftVersion", number(draft, "version"), "skins", List.of()),
                200);
        return send(put(p + "/media-bindings"),
                Map.of("expectedDraftVersion", number(draft, "version"), "bindings",
                        Map.of("HEAD", assets.get(MediaSemanticType.HERO_HEAD), "PORTRAIT",
                                assets.get(MediaSemanticType.HERO_PORTRAIT), "SPLASH",
                                assets.get(MediaSemanticType.HERO_SPLASH))),
                200);
    }
    @Test
    void importsPreviewWithoutWritesAndRejectStaleConfirmation() throws Exception {
        seedImportSeason();
        Map<String, Object> request = new HashMap<>();
        request.put("code", "import-hero");
        request.put("rulesetId", ruleset);
        request.put("releaseId", releaseId(variant));
        request.put("mode", "BASELINE");
        request.put("locale", "vi-VN");
        request.put("values", Map.of("name", "Imported", "roles", List.of("ASSASSIN")));
        request.put("policies", Map.of());
        var preview = send(post(ROOT + "/admin/heroes/import/preview"), request, 200);
        assertThat(preview.get("heroId")).isNull();
        assertThat(send(get(ROOT + "/admin/heroes"), null, 200).get("totalElements")).isEqualTo(0);
        var result = send(post(ROOT + "/admin/heroes/import/apply"), request, 200);
        assertThat(result.get("heroId")).isNotNull();
        send(post(ROOT + "/admin/heroes/import/apply"), request, 409);
        request.put("expectedRevisionId", result.get("revisionId"));
        request.put("expectedVersion", result.get("version"));
        request.put("values", Map.of("name", "Replacement", "summary", "Added summary"));
        var fill = send(post(ROOT + "/admin/heroes/import/preview"), request, 200);
        assertThat((Map<String, Object>) fill.get("after")).containsEntry("name", "Imported").containsEntry("summary",
                "Added summary");
        request.put("policies", Map.of("name", "OVERWRITE"));
        send(post(ROOT + "/admin/heroes/import/apply"), request, 200);
        send(post(ROOT + "/admin/heroes/import/apply"), request, 409);
        request.put("values", Map.of("unknownColumn", "value"));
        send(post(ROOT + "/admin/heroes/import/preview"), request, 422);
    }

    @Test
    void incompleteImportPersistsDraftAndReportsMissingPublicationData() throws Exception {
        seedImportSeason();
        var skill = Map.of("skillKey", "skill-1", "kind", "ACTIVE", "displayOrder", 0,
                "effects", List.of(Map.of("effectType", "SOURCE_SNAPSHOT", "metadata",
                        Map.of("reviewFlags", List.of(Map.of("type", "clipped_text"))))),
                "translations", List.of(Map.of("locale", "vi-VN", "name", "Skill")));
        var input = Map.of("code", "incomplete", "rulesetId", ruleset, "releaseId", releaseId(variant),
                "mode", "BASELINE", "locale", "vi-VN", "policies", Map.of(),
                "values", Map.of("name", "Incomplete", "skills", List.of(skill)));
        var preview = send(post(ROOT + "/admin/heroes/import/preview"), input, 200);
        assertThat(preview.get("canApply")).isEqualTo(true);
        assertThat((List<String>) preview.get("warnings")).anyMatch(w -> w.contains("skill-1"));
        assertThat((List<String>) preview.get("warnings")).anyMatch(w -> w.contains("Cần kiểm tra nguồn"));
        var result = send(post(ROOT + "/admin/heroes/import/apply"), input, 200);
        assertThat(result.get("heroId")).isNotNull();
        send(post(path(uuid(result, "heroId"), uuid(result, "revisionId")) + "/publish"),
                Map.of("expectedVersion", result.get("version")), 422);
    }

    @Test
    void importsStructuredStatsAndDerivedRatingsWithPoliciesAndKeepsUnmappedSections() throws Exception {
        seedImportSeason();
        var ratings = Map.of("scaleCode", "GAME_OVERVIEW_10", "survivability", 5, "attackDamage", 7,
                "skillEffects", 8, "difficulty", 6, "derived", true,
                "sources", List.of(Map.of("label", "Visual segment count", "verificationState", "UNVERIFIED",
                        "note", "Representative screenshot, not official numeric ratings")));
        var stats = Map.of("values", List.of(Map.of("statKey", "PHYSICAL_ATTACK", "baseValue", 180, "unit", "POINT"),
                Map.of("statKey", "HP", "baseValue", 3500, "unit", "POINT")), "sources", List.of());
        Map<String, Object> input = new HashMap<>(Map.of("code", "measured-hero", "rulesetId", ruleset,
                "releaseId", releaseId(variant), "mode", "BASELINE", "locale", "vi-VN", "policies", Map.of(),
                "values", Map.of("name", "Measured", "overviewRatings", ratings, "combatStats", stats)));
        var result = send(post(ROOT + "/admin/heroes/import/apply"), input, 200);
        var heroId = result.get("heroId");
        var revisionId = result.get("revisionId");
        var detail = send(get(ROOT + "/admin/heroes/" + heroId + "/revisions/" + revisionId), null, 200);
        var content = (Map<String, Object>) detail.get("content");
        assertThat((Map<String, Object>) content.get("overviewRatings")).containsEntry("derived", true)
                .containsEntry("attackDamage", 7);
        assertThat((List<?>) ((Map<?, ?>) content.get("combatStats")).get("values")).hasSize(2);
        input.put("expectedRevisionId", revisionId);
        input.put("expectedVersion", result.get("version"));
        var repeat = send(post(ROOT + "/admin/heroes/import/preview"), input, 200);
        assertThat(repeat.get("changed")).isEqualTo(false);
        var changedStats = Map.of("values", List.of(Map.of("statKey", "HP", "baseValue", 3700, "unit", "POINT")),
                "sources", List.of());
        input.put("values", Map.of("combatStats", changedStats));
        var fill = send(post(ROOT + "/admin/heroes/import/preview"), input, 200);
        assertThat(fill.get("changed")).isEqualTo(false);
        input.put("policies", Map.of("combatStats", "OVERWRITE"));
        var update = send(post(ROOT + "/admin/heroes/import/apply"), input, 200);
        assertThat(((Map<String, Object>) update.get("after")).get("overviewRatings"))
                .isEqualTo(((Map<String, Object>) result.get("after")).get("overviewRatings"));
        assertThat((List<?>) ((Map<?, ?>) ((Map<?, ?>) update.get("after")).get("combatStats")).get("values"))
                .hasSize(1);
        input.put("values", Map.of("overviewRatings", Map.of("scaleCode", "GAME_OVERVIEW_10", "survivability", 99,
                "attackDamage", 1, "skillEffects", 1, "difficulty", 1, "derived", false, "sources", List.of())));
        input.put("policies", Map.of("overviewRatings", "OVERWRITE"));
        send(post(ROOT + "/admin/heroes/import/preview"), input, 422);
    }

    @Test
    void initialBaselineCanMoveToVerifiedObservationContextWithoutLosingMedia() throws Exception {
        var draft = create();
        UUID hero = uuid(draft, "heroId"), draftId = id(draft);
        draft = complete(hero, draftId, draft);
        var beforeSections = draft.get("sections");
        var earlier = id(send(post(ROOT + "/admin/season-patches"), Map.of("seasonId", seasonId(), "rulesetId",
                ruleset,
                "patch", Map.of("code", "earlier-observation", "translations",
                        List.of(Map.of("locale", "vi-VN", "title", "Earlier observation", "summary", "")))),
                201));
        long expected = number(draft, "version");
        String endpoint = path(hero, draftId) + "/baseline-context";
        var moved = send(post(endpoint), Map.of("expectedVersion", expected, "contextId", earlier), 200);
        assertThat(moved.get("effectiveFromPatchVariantId")).isEqualTo(earlier.toString());
        assertThat(moved.get("sections")).isEqualTo(beforeSections);
        assertThat(number(moved, "version")).isEqualTo(expected + 1);
        send(post(endpoint), Map.of("expectedVersion", expected, "contextId", variant), 409);
        var noOp = send(post(endpoint), Map.of("expectedVersion", expected + 1, "contextId", earlier), 200);
        assertThat(number(noOp, "version")).isEqualTo(expected + 1);
        send(post(ROOT + "/admin/patch-variants/" + earlier + "/publish"), null, 204);
        var published = send(post(path(hero, draftId) + "/publish"), Map.of("expectedVersion", expected + 1), 200);
        send(post(endpoint), Map.of("expectedVersion", published.get("version"), "contextId", variant), 409);
        var correction = send(post(ROOT + "/admin/heroes/" + hero + "/drafts"),
                Map.of("rulesetId", ruleset, "sourceRevisionId", draftId, "cause", "CONTENT_CORRECTION"), 201);
        send(post(path(hero, id(correction)) + "/baseline-context"),
                Map.of("expectedVersion", correction.get("version"), "contextId", variant), 422);
        send(post(path(hero, id(correction)) + "/discard"),
                Map.of("expectedVersion", correction.get("version")), 200);
        var historical = send(post(ROOT + "/admin/heroes/import/apply"), Map.of("code", "nakroth", "rulesetId",
                ruleset, "contextId", releaseId(variant), "mode", "BASELINE", "locale", "vi-VN", "policies", Map.of(),
                "values", Map.of("name", "Historical observation")), 200);
        send(post(path(hero, uuid(historical, "revisionId")) + "/baseline-context"),
                Map.of("expectedVersion", historical.get("version"), "contextId", earlier), 422);
        var foreignRuleset = id(
                send(post(ROOT + "/admin/rulesets"), Map.of("code", "OTHER", "description", "Other ruleset"), 201));
        var foreignPatch = id(send(post(ROOT + "/admin/season-patches"), Map.of("seasonId", seasonId(), "rulesetId",
                foreignRuleset, "patch", Map.of("code", "foreign-observation", "translations",
                        List.of(Map.of("locale", "vi-VN", "title", "Foreign", "summary", "")))),
                201));
        var initial = send(post(ROOT + "/admin/heroes"), Map.of("code", "unpublished-observation", "initialLocale",
                "vi-VN", "name", "Observation", "rulesetId", ruleset, "contextId", earlier), 201);
        send(post(path(uuid(initial, "heroId"), id(initial)) + "/baseline-context"),
                Map.of("expectedVersion", initial.get("version"), "contextId", foreignPatch), 422);
    }

    @Test
    void sharedSeasonsHaveExplicitOrderAndIndependentMarketSchedules() throws Exception {
        var first = send(post(ROOT + "/admin/seasons"), Map.of("code", "2026-s1", "displayName", "S1 2026"), 201);
        var second = send(post(ROOT + "/admin/seasons"), Map.of("code", "2026-s2", "displayName", "S2 2026"), 201);
        var history = send(post(ROOT + "/admin/seasons"),
                Map.of("code", "2025-s4", "displayName", "S4 2025", "beforeSeasonId", first.get("id")), 201);
        assertThat(history).containsEntry("ordinal", 1);
        assertThat(jdbc.sql("SELECT ordinal FROM patch.ranked_season WHERE id=?").param(id(first)).query(Long.class)
                .single()).isEqualTo(2L);
        send(post(ROOT + "/admin/seasons/" + first.get("id") + "/schedules"),
                Map.of("regionId", VN, "startsAt", "2026-01-01T00:00:00Z", "endsAt", "2026-04-01T00:00:00Z"), 201);
        send(post(ROOT + "/admin/seasons/" + first.get("id") + "/schedules"),
                Map.of("regionId", TH, "startsAt", "2026-01-15T00:00:00Z", "endsAt", "2026-04-15T00:00:00Z"), 201);
        send(post(ROOT + "/admin/seasons/" + second.get("id") + "/schedules"),
                Map.of("regionId", VN, "startsAt", "2026-03-01T00:00:00Z", "endsAt", "2026-06-01T00:00:00Z"), 409);
        UUID later = id(send(post(ROOT + "/admin/season-patches"),
                Map.of("seasonId", second.get("id"), "rulesetId", ruleset, "patch", Map.of("code", "later-shared",
                        "translations", List.of(Map.of("locale", "vi-VN", "title", "Later", "summary", "")))),
                201));
        UUID earlier = id(send(post(ROOT + "/admin/season-patches"),
                Map.of("seasonId", first.get("id"), "rulesetId", ruleset, "patch", Map.of("code", "earlier-shared",
                        "translations", List.of(Map.of("locale", "vi-VN", "title", "Earlier", "summary", "")))),
                201));
        long a = jdbc.sql("SELECT ruleset_ordinal FROM patch.patch_variant WHERE id=?").param(earlier).query(Long.class)
                .single();
        long b = jdbc.sql("SELECT ruleset_ordinal FROM patch.patch_variant WHERE id=?").param(later).query(Long.class)
                .single();
        assertThat(a).isLessThan(b);
        send(post(ROOT + "/admin/heroes/import/preview"),
                Map.of("code", "shared-hero", "rulesetId", ruleset, "contextId", earlier, "mode", "BASELINE", "locale",
                        "vi-VN", "values", Map.of("name", "Shared hero", "roles", List.of("WARRIOR")), "policies",
                        Map.of()),
                200);
    }

    @Test
    void baselineDoesNotInventHistoryAndHistoricalImportDoesNotReplaceCurrentSnapshot() throws Exception {
        seedImportSeason();
        var current = send(post(ROOT + "/admin/heroes"), Map.of("code", "observed", "name", "Observed",
                "initialLocale", "vi-VN", "rulesetId", ruleset, "releaseId", releaseId(variant)), 201);
        UUID hero = uuid(current, "heroId"), currentId = id(current);
        current = complete(hero, currentId, current);
        send(post(path(hero, currentId) + "/publish"), Map.of("expectedVersion", number(current, "version")), 200);
        assertThat(current).containsEntry("cause", "DATA_BASELINE");
        mvc.perform(get(ROOT + "/heroes/" + hero + "/changes")).andExpect(jsonPath("$.items.length()").value(0));
        UUID oldPatch = id(send(post(ROOT + "/admin/patches"), Map.of("code", "historical", "translations",
                List.of(Map.of("locale", "vi-VN", "title", "Old", "summary", ""))), 201));
        UUID oldVariant = id(send(post(ROOT + "/admin/patches/" + oldPatch + "/variants"), Map.of("rulesetId", ruleset,
                "variantCode", "OLD", "rulesetOrdinal", 1, "beforeVariantId", variant), 201));
        assertThat(contexts.variant(variant).rulesetOrdinal()).isEqualTo(2);
        send(post(ROOT + "/admin/patch-variants/" + oldVariant + "/publish"), null, 204);
        release(oldVariant, VN, "2026-01-01T12:00:00Z", 201);
        clock.set(Instant.parse("2026-01-01T18:00:00Z"));
        mvc.perform(get(ROOT + "/heroes/" + hero)).andExpect(status().isNotFound());
        clock.set(Instant.parse("2026-10-15T00:00:00Z"));
        Map<String, Object> input = new HashMap<>(Map.of("code", "observed", "rulesetId", ruleset,
                "releaseId", releaseId(oldVariant), "mode", "PATCH_UPDATE", "locale", "vi-VN",
                "values", Map.of("name", "Historical", "roles", List.of("ASSASSIN")), "policies", Map.of()));
        var missing = send(post(ROOT + "/admin/heroes/import/preview"), input, 200);
        assertThat(missing).containsEntry("classification", "INSUFFICIENT_DATA").containsEntry("canApply", false);
        assertThat(((Map<?, ?>) missing.get("before")).get("name")).isNull();
        send(post(ROOT + "/admin/heroes/import/apply"), input, 422);
        input.put("mode", "BASELINE");
        var plan = send(post(ROOT + "/admin/heroes/import/preview"), input, 200);
        assertThat(plan.get("revisionId")).isNull();
        var imported = send(post(ROOT + "/admin/heroes/import/apply"), input, 200);
        UUID oldRevision = uuid(imported, "revisionId");
        var read = send(get(ROOT + "/admin/heroes/" + hero + "/revisions/" + oldRevision), null, 200);
        var draft = complete(hero, oldRevision, (Map<String, Object>) read.get("revision"));
        send(post(path(hero, oldRevision) + "/publish"), Map.of("expectedVersion", number(draft, "version")), 200);
        mvc.perform(get(ROOT + "/heroes/" + hero)).andExpect(jsonPath("$.revisionId").value(currentId.toString()));
        mvc.perform(get(ROOT + "/heroes/" + hero + "/changes")).andExpect(jsonPath("$.items.length()").value(0));
        input.put("mode", "CORRECTION");
        input.put("values", Map.of("summary", "Correct old text"));
        var correction = send(post(ROOT + "/admin/heroes/import/preview"), input, 200);
        assertThat(correction.get("revisionId")).isEqualTo(oldRevision.toString());
        input.put("expectedRevisionId", correction.get("revisionId"));
        input.put("expectedVersion", correction.get("version"));
        var corrected = send(post(ROOT + "/admin/heroes/import/apply"), input, 200);
        assertThat(corrected.get("sourcePatchVariantId")).isEqualTo(oldVariant.toString());
        mvc.perform(get(ROOT + "/heroes/" + hero)).andExpect(jsonPath("$.revisionId").value(currentId.toString()));
    }

    private void seedImportSeason() throws Exception {
        if (jdbc.sql("SELECT count(*) FROM patch.ranked_season").query(Long.class).single() > 0)
            return;
        var season = send(post(ROOT + "/admin/seasons"), Map.of("code", "test-season", "displayName", "S1 2026"), 201);
        send(post(ROOT + "/admin/seasons/" + season.get("id") + "/schedules"), Map.of("regionId", VN,
                "startsAt", "2026-01-01T00:00:00Z", "endsAt", "2027-01-01T00:00:00Z"), 201);
    }

    private UUID seasonId() {
        return jdbc.sql("SELECT id FROM patch.ranked_season WHERE code='test-season'").query(UUID.class).single();
    }

    @Test
    void futurePatchImportUsesEarlierSnapshotAndWaitsForRollout() throws Exception {
        var baseline = create();
        UUID hero = uuid(baseline, "heroId"), baselineId = id(baseline);
        baseline = complete(hero, baselineId, baseline);
        send(post(path(hero, baselineId) + "/publish"), Map.of("expectedVersion", number(baseline, "version")), 200);
        UUID futurePatch = id(send(post(ROOT + "/admin/patches"), Map.of("code", "future", "translations",
                List.of(Map.of("locale", "vi-VN", "title", "Future", "summary", ""))), 201));
        UUID futureVariant = id(send(post(ROOT + "/admin/patches/" + futurePatch + "/variants"),
                Map.of("rulesetId", ruleset, "variantCode", "FUTURE", "rulesetOrdinal", 2), 201));
        send(post(ROOT + "/admin/patch-variants/" + futureVariant + "/publish"), null, 204);
        release(futureVariant, VN, "2026-12-01T00:00:00Z", 201);
        Map<String, Object> input = new HashMap<>(Map.of("code", "nakroth", "rulesetId", ruleset,
                "releaseId", releaseId(futureVariant), "mode", "PATCH_UPDATE", "locale", "vi-VN",
                "values", Map.of("summary", "Future observation"), "policies", Map.of("summary", "OVERWRITE")));
        var plan = send(post(ROOT + "/admin/heroes/import/preview"), input, 200);
        assertThat(plan).containsEntry("classification", "CHANGED").containsEntry("canApply", true);
        assertThat(plan.get("revisionId")).isEqualTo(baselineId.toString());
        input.put("expectedRevisionId", plan.get("revisionId"));
        input.put("expectedVersion", plan.get("version"));
        var applied = send(post(ROOT + "/admin/heroes/import/apply"), input, 200);
        UUID futureRevision = uuid(applied, "revisionId");
        var read = send(get(ROOT + "/admin/heroes/" + hero + "/revisions/" + futureRevision), null, 200);
        assertThat((Map<String, Object>) read.get("revision")).containsEntry("cause", "GAME_PATCH")
                .containsEntry("effectiveFromPatchVariantId", futureVariant.toString());
        send(post(path(hero, futureRevision) + "/publish"), Map.of("expectedVersion", applied.get("version")), 200);
        mvc.perform(get(ROOT + "/heroes/" + hero)).andExpect(jsonPath("$.revisionId").value(baselineId.toString()));
        clock.set(Instant.parse("2026-12-02T00:00:00Z"));
        mvc.perform(get(ROOT + "/heroes/" + hero)).andExpect(jsonPath("$.revisionId").value(futureRevision.toString()));
        mvc.perform(get(ROOT + "/heroes/" + hero + "/changes")).andExpect(jsonPath("$.items.length()").value(0));
        input.remove("releaseId");
        send(post(ROOT + "/admin/heroes/import/preview"), input, 400);
        send(post(ROOT + "/admin/heroes"), Map.of("code", "missing-context", "name", "No patch",
                "initialLocale", "vi-VN", "rulesetId", ruleset), 400);
    }

    @Test
    void dateOnlyReleaseRetainsPrecisionAndRequiresExplicitConfirmation() throws Exception {
        var season = send(post(ROOT + "/admin/seasons"), Map.of("code", "date-season", "displayName", "Date season"),
                201);
        UUID v = id(send(post(ROOT + "/admin/season-patches"),
                Map.of("seasonId", season.get("id"), "rulesetId", ruleset,
                        "patch", Map.of("code", "date-patch", "translations",
                                List.of(Map.of("locale", "vi-VN", "title", "Date patch", "summary", "")))),
                201));
        send(post(ROOT + "/admin/patch-variants/" + v + "/publish"), null, 204);
        send(post(ROOT + "/admin/patch-variants/" + v + "/releases"),
                Map.of("regionId", VN, "effectiveAt", "2026-10-16T02:00:00Z", "effectiveOn", "2026-10-16"), 422);
        UUID rel = id(send(post(ROOT + "/admin/patch-variants/" + v + "/releases"),
                Map.of("regionId", VN, "effectiveOn", "2026-10-16"), 201));
        var scheduleEndpoint = ROOT + "/admin/seasons/" + season.get("id") + "/schedules";
        var initialSchedule = send(post(scheduleEndpoint), Map.of("regionId", VN, "startsOn", "2026-10-01"), 201);
        send(get(ROOT + "/admin/publication-overview"), null, 200);
        assertThat(jdbc.sql("SELECT ends_at FROM patch.season_schedule WHERE id=?")
                .param(id(initialSchedule)).query().singleRow().get("ends_at")).isNull();
        var completedSchedule = send(post(scheduleEndpoint),
                Map.of("regionId", VN, "startsOn", "2026-10-01", "endsOn", "2026-10-31"), 201);
        assertThat(id(completedSchedule)).isEqualTo(id(initialSchedule));
        var row = jdbc.sql("SELECT effective_at,effective_on,status FROM patch.patch_release WHERE id=?").param(rel)
                .query().singleRow();
        assertThat(row.get("effective_at")).isNull();
        assertThat(row.get("status")).isEqualTo("DRAFT");
        assertThat(contexts.resolve("VN", clock.instant()).patchVariantId()).isEqualTo(variant);
        mvc.perform(post(ROOT + "/admin/patch-releases/" + rel + "/confirm")
                .with(jwt().authorities(new SimpleGrantedAuthority("catalog:read"))))
                .andExpect(status().isForbidden());
        send(post(ROOT + "/admin/patch-releases/" + rel + "/confirm"), null, 422);
        clock.set(Instant.parse("2026-10-16T02:00:00Z"));
        send(post(ROOT + "/admin/patch-releases/" + rel + "/confirm"), null, 204);
        send(post(ROOT + "/admin/patch-releases/" + rel + "/confirm"), null, 204);
        assertThat(contexts.resolve("VN", clock.instant()).patchVariantId()).isEqualTo(v);
        var overview = send(get(ROOT + "/admin/publication-overview"), null, 200);
        var release = ((List<Map<String, Object>>) overview.get("releases")).stream()
                .filter(r -> rel.toString().equals(r.get("id"))).findFirst().orElseThrow();
        assertThat(release).containsEntry("effectiveOn", "2026-10-16").containsEntry("effectiveAt", null)
                .containsEntry("confirmedAt", "2026-10-16T02:00:00Z").containsEntry("phase", "CURRENT");
        var schedule = ((List<Map<String, Object>>) overview.get("seasonSchedules")).getFirst();
        assertThat(schedule).containsEntry("startsOn", "2026-10-01").containsEntry("endsOn", "2026-10-31")
                .containsEntry("startsAt", null).containsEntry("endsAt", null);
    }

    private UUID releaseId(UUID variantId) {
        return jdbc.sql("SELECT id FROM patch.patch_release WHERE patch_variant_id=? AND region_id=?")
                .params(variantId, VN).query(UUID.class).single();
    }

    private void assign(UUID region, UUID ruleset, String from, String to, int status) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("rulesetId", ruleset);
        body.put("validFrom", from);
        if (to != null)
            body.put("validTo", to);
        send(post(ROOT + "/admin/regions/" + region + "/ruleset-assignments"), body, status);
    }
    private void release(UUID variant, UUID region, String at, int status) throws Exception {
        send(post(ROOT + "/admin/patch-variants/" + variant + "/releases"),
                Map.of("regionId", region, "effectiveAt", at), status);
    }
    @Test
    void createsRegionsWithPermissionValidationAndLockedState() throws Exception {
        var body = new HashMap<String, Object>();
        body.put("code", "TEST-REGION");
        body.put("displayName", "Test market");
        body.put("productName", "Arena of Valor");
        body.put("defaultLocale", "en-US");
        body.put("timezone", "UTC");
        body.put("available", false);
        mvc.perform(post(ROOT + "/admin/regions")
                .with(jwt().authorities(new SimpleGrantedAuthority("hero:write")))
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                .andExpect(status().isForbidden());
        var created = send(post(ROOT + "/admin/regions"), body, 201);
        assertThat(jdbc.sql("SELECT lifecycle_state FROM patch.region WHERE id=:id")
                .param("id", id(created)).query(String.class).single()).isEqualTo("LOCKED");
        mvc.perform(get(ROOT + "/regions/TEST-REGION")).andExpect(status().isUnprocessableEntity());
        send(post(ROOT + "/admin/regions"), body, 409);
        body.put("code", "TEST-ACTIVE");
        body.put("available", true);
        send(post(ROOT + "/admin/regions"), body, 201);
        mvc.perform(get(ROOT + "/regions/TEST-ACTIVE")).andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true));
        body.put("code", "TEST-INVALID");
        body.put("timezone", "Invalid/Zone");
        send(post(ROOT + "/admin/regions"), body, 422);
    }

    @Test
    void durableImportsResumeIdempotentlyAndIsolateFailedRows() throws Exception {
        seedImportSeason();
        var good = new HashMap<String, Object>(Map.of("code", "queued-hero", "rulesetId", ruleset,
                "releaseId", releaseId(variant), "mode", "BASELINE", "locale", "vi-VN",
                "values", Map.of("name", "Queued hero", "roles", List.of("ASSASSIN")), "policies", Map.of()));
        var bad = new HashMap<>(good);
        bad.put("code", "broken-hero");
        bad.put("values", Map.of("name", "Broken", "roles", List.of("INVALID_ROLE")));
        var last = new HashMap<>(good);
        last.put("code", "last-hero");
        var jobId = UUID.randomUUID();
        var body = Map.of("id", jobId, "rows", List.of(good, bad, last));
        var endpoint = ROOT + "/admin/heroes/import/jobs";
        send(post(endpoint), body, 202);
        assertThat(send(put(endpoint + "/" + jobId + "/notification-dismissal"), null, 409))
                .containsEntry("code", "HERO_IMPORT_JOB_CONFLICT");
        send(post(endpoint), body, 202);
        assertThat(importJobs.pending()).hasSize(1);
        mvc.perform(get(endpoint + "/" + jobId).with(jwt().jwt(t -> t.subject("other"))
                .authorities(new SimpleGrantedAuthority("hero:write"), new SimpleGrantedAuthority("catalog:read"))))
                .andExpect(status().isNotFound());
        mvc.perform(get(endpoint).with(jwt().jwt(t -> t.subject("other"))
                .authorities(new SimpleGrantedAuthority("hero:write"), new SimpleGrantedAuthority("catalog:read"))))
                .andExpect(jsonPath("$.length()").value(0));
        var first = importJobs.pending().getFirst();
        importJobs.execute(first);
        importJobs.execute(first);
        assertThat(send(get(endpoint + "/" + jobId), null, 200)).containsEntry("completed", 1);
        var remaining = importJobs.pending().getFirst();
        assertThatThrownBy(() -> importJobs.execute(remaining)).isInstanceOf(RuntimeException.class);
        assertThat(jdbc.sql("SELECT count(*) FROM hero.hero WHERE code='broken-hero'").query(Long.class).single())
                .isZero();
        var worker = new com.wikiaov.hero.internal.infrastructure.HeroImportWorker(importJobs);
        worker.tick();
        worker.tick();
        assertThat(send(get(endpoint + "/" + jobId), null, 200))
                .containsEntry("completed", 3).containsEntry("status", "COMPLETED_WITH_ERRORS");
        String dismissal = endpoint + "/" + jobId + "/notification-dismissal";
        mvc.perform(put(dismissal)).andExpect(status().isUnauthorized());
        mvc.perform(put(dismissal).with(jwt().authorities(new SimpleGrantedAuthority("catalog:read"))))
                .andExpect(status().isForbidden());
        for (String[] owner : List.of(new String[] {"https://test.example/issuer", "other"},
                new String[] {"https://other.example/issuer", "editor"})) {
            mvc.perform(put(dismissal).with(jwt().jwt(t -> t.issuer(owner[0]).subject(owner[1]))
                    .authorities(new SimpleGrantedAuthority("hero:write"), new SimpleGrantedAuthority("catalog:read"))))
                    .andExpect(status().isNotFound());
        }
        send(put(endpoint + "/" + UUID.randomUUID() + "/notification-dismissal"), null, 404);
        var dismissed = send(put(dismissal), null, 200);
        assertThat(dismissed).containsEntry("notificationDismissed", true);
        assertThat(send(put(dismissal), null, 200)).isEqualTo(dismissed);
        assertThat(send(get(endpoint + "/" + jobId), null, 200))
                .containsEntry("notificationDismissed", true).containsEntry("completed", 3);
        mvc.perform(get(endpoint).with(jwt().jwt(t -> t.issuer("https://test.example/issuer").subject("editor"))
                .authorities(new SimpleGrantedAuthority("hero:write"), new SimpleGrantedAuthority("catalog:read"))))
                .andExpect(jsonPath("$[0].notificationDismissed").value(true))
                .andExpect(jsonPath("$[0].results.length()").value(3));
        UUID newJobId = UUID.randomUUID();
        assertThat(send(post(endpoint), Map.of("id", newJobId, "rows", List.of(last)), 202))
                .containsEntry("notificationDismissed", false).containsEntry("status", "RUNNING");
        importJobs.failed(importJobs.pending().getFirst(), "TEST_FAILURE", "Test fixture failure");
        send(put(endpoint + "/" + newJobId + "/notification-dismissal"), null, 200);
        send(post(endpoint), body, 202);
        assertThat(importJobs.pending()).isEmpty();
        assertThat(jdbc.sql("SELECT created_by_subject FROM hero.hero WHERE code='queued-hero'").query(String.class)
                .single()).isEqualTo("editor");
        send(post(endpoint), Map.of("id", jobId, "rows", List.of(good)), 409);
        mvc.perform(post(endpoint).with(jwt().authorities(new SimpleGrantedAuthority("catalog:read")))
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                .andExpect(status().isForbidden());
    }

    @Test
    void importsMappedSkillsAndSkinsWithCompletedMediaAssets() throws Exception {
        seedImportSeason();
        var fields = send(get(ROOT + "/admin/heroes/import/relation-fields"), null, 200);
        assertThat(fields).containsKeys("skills", "skins");
        var input = new HashMap<String, Object>(Map.of("code", "related-hero", "rulesetId", ruleset,
                "releaseId", releaseId(variant), "mode", "BASELINE", "locale", "vi-VN", "policies", Map.of(),
                "values", Map.of("name", "Related", "roles", List.of("ASSASSIN"),
                        "skills", List.of(Map.of("skillKey", "skill-1", "kind", "ACTIVE", "displayOrder", 1,
                                "iconAssetId", assets.get(MediaSemanticType.HERO_SKILL_ICON), "effects", List.of(),
                                "translations",
                                List.of(Map.of("locale", "vi-VN", "name", "Skill", "description", "Description")))),
                        "skins", List.of(Map.of("skinKey", "skin-1", "displayOrder", 0,
                                "artAssetId", assets.get(MediaSemanticType.HERO_SKIN_ART),
                                "translations", List.of(Map.of("locale", "vi-VN", "name", "Skin")))))));
        send(post(ROOT + "/admin/heroes/import/preview"), input, 200);
        var applied = send(post(ROOT + "/admin/heroes/import/apply"), input, 200);
        var after = (Map<?, ?>) applied.get("after");
        assertThat(((List<?>) after.get("skills"))).hasSize(1);
        assertThat(((List<?>) after.get("skins"))).hasSize(1);
        assertThat(((Map<?, ?>) ((List<?>) after.get("skills")).getFirst()).get("iconAssetId"))
                .isEqualTo(assets.get(MediaSemanticType.HERO_SKILL_ICON).toString());
    }

    @Test
    void uploadSessionsPersistCheckpointsAndRejectOtherOwnersAndStaleUpdates() throws Exception {
        String endpoint = ROOT + "/admin/heroes/import/upload-sessions/" + UUID.randomUUID();
        var state = new HashMap<String, Object>(Map.of("schemaVersion", 1, "label", "heroes.json", "entries",
                List.of(Map.of("code", "airi")), "images", Map.of()));
        var initial = Map.of("version", -1, "state", state);
        var created = send(put(endpoint), initial, 200);
        assertThat(number(created, "version")).isZero();
        send(put(endpoint), initial, 200);
        state.put("label", "saved");
        var saved = send(put(endpoint), Map.of("version", 0, "state", state),
                200);
        assertThat(number(saved, "version")).isEqualTo(1);
        state.put("label", "stale");
        send(put(endpoint), Map.of("version", 0, "state", state), 409);
        send(put(endpoint), Map.of("version", 1, "state", Map.of("label", "invalid")), 422);
        mvc.perform(put(endpoint).with(jwt().jwt(t -> t.subject("other"))
                .authorities(new SimpleGrantedAuthority("catalog:read"), new SimpleGrantedAuthority("hero:write")))
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(initial)))
                .andExpect(status().isNotFound());
        mvc.perform(get(ROOT + "/admin/heroes/import/upload-sessions")
                .with(jwt().jwt(t -> t.subject("other"))
                        .authorities(new SimpleGrantedAuthority("catalog:read"),
                                new SimpleGrantedAuthority("hero:write"))))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(put(endpoint).with(jwt().authorities(new SimpleGrantedAuthority("catalog:read")))
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(initial)))
                .andExpect(status().isForbidden());
        send(delete(endpoint), null, 200);
        send(put(endpoint), Map.of("version", 1, "state", state), 404);
    }

    private Map<String, Object> send(MockHttpServletRequestBuilder request, Object body, int status) throws Exception {
        request.with(jwt().jwt(t -> t.issuer("https://test.example/issuer").subject("editor")).authorities(
                new SimpleGrantedAuthority("catalog:read"), new SimpleGrantedAuthority("hero:write"),
                new SimpleGrantedAuthority("hero:publish"), new SimpleGrantedAuthority("patch:write"),
                new SimpleGrantedAuthority("patch:publish"), new SimpleGrantedAuthority("region:admin")));
        if (body != null)
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        var response = mvc.perform(request).andExpect(status().is(status)).andReturn().getResponse();
        return response.getContentAsString().isEmpty()
                ? Map.of()
                : json.readValue(response.getContentAsString(), Map.class);
    }
    private static UUID id(Map<String, Object> row) {
        return uuid(row, "id");
    }
    private static UUID uuid(Map<String, Object> row, String key) {
        return UUID.fromString((String) row.get(key));
    }
    private static long number(Map<String, Object> row, String key) {
        return ((Number) row.get(key)).longValue();
    }
    private static String path(UUID hero, UUID draft) {
        return ROOT + "/admin/heroes/" + hero + "/drafts/" + draft;
    }
}
