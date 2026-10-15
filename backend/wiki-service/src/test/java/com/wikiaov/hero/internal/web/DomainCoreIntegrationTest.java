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
    @Autowired
    GameplayContexts contexts;
    @Autowired
    MutableClock clock;
    @MockitoBean
    MediaAssets media;
    @Autowired
    List<MediaUsageProvider> usageProviders;
    private UUID ruleset, variant, patch;
    private final Map<MediaSemanticType, UUID> assets = new EnumMap<>(MediaSemanticType.class);
    @BeforeEach
    void setup() throws Exception {
        clock.set(Instant.parse("2026-10-15T00:00:00Z"));
        jdbc.sql("TRUNCATE hero.hero CASCADE").update();
        jdbc.sql("TRUNCATE hero.hero_source_reference").update();
        jdbc.sql("TRUNCATE patch.game_patch,patch.gameplay_ruleset CASCADE").update();
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
                Map.of("code", "violet", "name", "Violet", "initialLocale", "vi-VN", "rulesetId", ruleset), 201);
        UUID profile = UUID.fromString((String) ((Map<?, ?>) other.get("sections")).get("profile"));
        assertThatThrownBy(() -> jdbc.sql("UPDATE hero.hero_revision SET profile_revision_id=? WHERE id=?")
                .params(profile, id).update()).isInstanceOf(org.springframework.dao.DataAccessException.class);
        send(post(ROOT + "/admin/heroes/" + hero + "/drafts"),
                Map.of("rulesetId", ruleset, "sourceRevisionId", id, "cause", "CONTENT_CORRECTION"), 409);
        mvc.perform(get(ROOT + "/heroes?region=VN&region=TH")).andExpect(status().isBadRequest());
        mvc.perform(get(ROOT + "/heroes?size=101")).andExpect(status().isUnprocessableEntity());
    }
    private Map<String, Object> create() throws Exception {
        return send(post(ROOT + "/admin/heroes"),
                Map.of("code", "nakroth", "initialLocale", "vi-VN", "name", "Nakroth", "rulesetId", ruleset), 201);
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
