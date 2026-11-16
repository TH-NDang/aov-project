package com.wikiaov.hero.internal.web;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.wikiaov.MutableClock;
import com.wikiaov.media.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;

/**
 * ADR-029: traits travel with the skills and notes with the profile, each written by its own endpoint and kept by the
 * section updates; readers see the latest confirmed ranking snapshot and which heroes share a trait.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(DomainCoreIntegrationTest.Beans.class)
@EnabledIf("databaseAvailable")
@SuppressWarnings("unchecked")
class HeroEvaluationIntegrationTest {
    private static final String ROOT = "/api/wiki/v1";
    private static final UUID VN = UUID.fromString("5d5dcd5e-15b9-4d43-884d-111111111111");
    private static final String PAGE = "c".repeat(64);
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

    @Autowired
    MockMvc mvc;
    @Autowired
    JsonMapper json;
    @Autowired
    JdbcClient jdbc;
    @Autowired
    MutableClock clock;
    @MockitoBean
    MediaAssets media;
    private UUID ruleset, release;
    private final Map<MediaSemanticType, UUID> assets = new EnumMap<>(MediaSemanticType.class);

    @BeforeEach
    void setup() throws Exception {
        clock.set(Instant.parse("2026-10-15T00:00:00Z"));
        jdbc.sql("TRUNCATE hero.ranking_snapshot CASCADE").update();
        jdbc.sql("TRUNCATE hero.import_job").update();
        jdbc.sql("TRUNCATE hero.hero CASCADE").update();
        jdbc.sql("TRUNCATE patch.game_patch,patch.gameplay_ruleset,patch.ranked_season CASCADE").update();
        for (var type : List.of(MediaSemanticType.HERO_HEAD, MediaSemanticType.HERO_PORTRAIT,
                MediaSemanticType.HERO_SPLASH, MediaSemanticType.HERO_SKILL_ICON)) {
            UUID id = UUID.randomUUID();
            assets.put(type, id);
            when(media.find(id)).thenReturn(Optional.of(
                    new MediaAssetReference(id, type, MediaAssetState.ACTIVE, new MediaAssetReference.CurrentVersion(
                            UUID.randomUUID(), "image/webp", 100, 100, "/media/" + id + "/v1.webp"))));
        }
        when(media.findAll(any())).thenAnswer(call -> {
            Map<UUID, MediaAssetReference> found = new HashMap<>();
            for (UUID id : (Collection<UUID>) call.getArgument(0))
                media.find(id).ifPresent(asset -> found.put(id, asset));
            return found;
        });

        ruleset = id(send(post(ROOT + "/admin/rulesets"),
                Map.of("code", "AOV-EVALUATION", "description", "Verified test fixture"), 201));
        send(post(ROOT + "/admin/regions/" + VN + "/ruleset-assignments"),
                Map.of("rulesetId", ruleset, "validFrom", "2026-01-01T00:00:00Z"), 201);
        var season = send(post(ROOT + "/admin/seasons"),
                Map.of("code", "evaluation-season", "displayName", "S1 2026"), 201);
        send(post(ROOT + "/admin/seasons/" + season.get("id") + "/schedules"),
                Map.of("regionId", VN, "startsAt", "2026-01-01T00:00:00Z", "endsAt", "2027-01-01T00:00:00Z"), 201);
        UUID patch = id(send(post(ROOT + "/admin/patches"), Map.of("code", "evaluation-patch", "translations",
                List.of(Map.of("locale", "vi-VN", "title", "Bản thử nghiệm", "summary", "Dữ liệu kiểm thử"))), 201));
        UUID variant = id(send(post(ROOT + "/admin/patches/" + patch + "/variants"),
                Map.of("rulesetId", ruleset, "variantCode", "TEST", "rulesetOrdinal", 1), 201));
        send(post(ROOT + "/admin/patch-variants/" + variant + "/publish"), null, 204);
        send(post(ROOT + "/admin/patch-variants/" + variant + "/releases"),
                Map.of("regionId", VN, "effectiveAt", "2026-01-02T00:00:00Z"), 201);
        release = jdbc.sql("SELECT id FROM patch.patch_release WHERE patch_variant_id=?").param(variant)
                .query(UUID.class).single();
    }

    @Test
    void traitsAndNotesHaveTheirOwnEndpointsAndSurviveSectionUpdates() throws Exception {
        var draft = draft("florentino", "Florentino");
        UUID hero = uuid(draft, "heroId");
        String p = path(hero, id(draft));

        draft = send(put(p + "/traits"), Map.of("expectedDraftVersion", number(draft, "version"), "traits", List.of(
                trait("HARD_CC", List.of("skill-1-1"), "Hào hoa (choáng 0.75 giây)"),
                Map.of("code", "DASH", "skillKeys", List.of("skill-2-1", "skill-1-1"), "translations", List.of()))),
                200);
        assertThat(traits(content(hero, draft))).extracting(t -> t.get("code"), t -> t.get("skillKeys"))
                .containsExactly(tuple("DASH", List.of("skill-1-1", "skill-2-1")),
                        tuple("HARD_CC", List.of("skill-1-1")));
        long version = number(draft, "version");
        assertThat(code(send(put(p + "/traits"), Map.of("expectedDraftVersion", version, "traits",
                List.of(trait("DASH", List.of("skill-9-9"), "Không có"))), 422))).isEqualTo("HERO_INVALID_CONTENT");
        assertThat(code(send(put(p + "/traits"), Map.of("expectedDraftVersion", version, "traits",
                List.of(trait("DASH", List.of(), "Một"), trait("DASH", List.of(), "Hai"))), 422)))
                .isEqualTo("HERO_INVALID_CONTENT");
        send(put(p + "/traits"), Map.of("expectedDraftVersion", version, "traits",
                List.of(Map.of("code", "FLYING", "skillKeys", List.of(), "translations", List.of()))), 400);
        assertThat(code(send(put(p + "/traits"), Map.of("expectedDraftVersion", version - 1, "traits", List.of()),
                409))).isEqualTo("HERO_REVISION_VERSION_CONFLICT");

        draft = send(put(p + "/notes"), Map.of("expectedDraftVersion", version, "locale", "vi-VN", "strengths",
                "  Lướt nhiều lần  ", "weaknesses", " ", "counterTips", "Chờ hết miễn khống."), 200);
        assertThat(profileText(content(hero, draft))).containsEntry("strengths", "Lướt nhiều lần")
                .containsEntry("weaknesses", null).containsEntry("counterTips", "Chờ hết miễn khống.");
        assertThat(code(send(put(p + "/notes"), Map.of("expectedDraftVersion", number(draft, "version"), "locale",
                "en-US", "strengths", "Mobile"), 422))).isEqualTo("HERO_INVALID_CONTENT");

        draft = send(put(p + "/skills"), skills(number(draft, "version"), List.of("skill-2-1")), 200);
        draft = send(put(p + "/profile"), Map.of("expectedDraftVersion", number(draft, "version"), "translations",
                List.of(Map.of("locale", "vi-VN", "name", "Florentino", "title", "Tay kiếm hào hoa")), "roles",
                List.of("WARRIOR"), "positions", List.of("TOP")), 200);
        var kept = content(hero, draft);
        assertThat(traits(kept)).extracting(t -> t.get("code"), t -> t.get("skillKeys"))
                .containsExactly(tuple("DASH", List.of("skill-2-1")), tuple("HARD_CC", List.of()));
        assertThat(profileText(kept)).containsEntry("title", "Tay kiếm hào hoa")
                .containsEntry("strengths", "Lướt nhiều lần");

        // Admin and the import scripts send the skills section back as they read it, traits included.
        Map<String, Object> echoed = new HashMap<>((Map<String, Object>) kept.get("skills"));
        echoed.put("expectedDraftVersion", number(draft, "version"));
        echoed.put("traits", List.of(trait("TRUE_DAMAGE", List.of(), "Bị bỏ qua")));
        draft = send(put(p + "/skills"), echoed, 200);
        assertThat(traits(content(hero, draft))).extracting(t -> t.get("code"), t -> t.get("skillKeys"))
                .containsExactly(tuple("DASH", List.of("skill-2-1")), tuple("HARD_CC", List.of()));

        publish(draft);
        var detail = send(get(ROOT + "/heroes/" + hero), null, 200);
        var content = (Map<String, Object>) detail.get("content");
        assertThat((List<Map<String, Object>>) ((Map<String, Object>) content.get("skills")).get("traits"))
                .extracting(t -> t.get("code"), t -> t.get("detail"))
                .containsExactly(tuple("DASH", null), tuple("HARD_CC", "Hào hoa (choáng 0.75 giây)"));
        assertThat((Map<String, Object>) content.get("profile")).containsEntry("strengths", "Lướt nhiều lần")
                .containsEntry("counterTips", "Chờ hết miễn khống.");

        var index = (List<Map<String, Object>>) send(get(ROOT + "/hero-traits"), null, 200).get("traits");
        assertThat(index).hasSize(22);
        assertThat(heroesWith(index, "DASH")).containsExactly("florentino");
        assertThat(heroesWith(index, "TRUE_DAMAGE")).isEmpty();
        send(get(ROOT + "/hero-traits").param("unknown", "1"), null, 400);

        assertThat(jdbc.sql("SELECT count(*) FROM access.audit_event WHERE action IN "
                + "('HERO_TRAITS_UPDATED','HERO_NOTES_UPDATED') AND aggregate_id=?").param(hero).query(Long.class)
                .single()).isEqualTo(2L);
        mvc.perform(put(p + "/traits").with(jwt().authorities(new SimpleGrantedAuthority("catalog:read")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("expectedDraftVersion", 1, "traits", List.of()))))
                .andExpect(status().isForbidden());
    }

    @Test
    void readersSeeOnlyTheLatestConfirmedRankingSnapshotWithRanks() throws Exception {
        UUID toro = rankedHero("toro");
        UUID gildur = rankedHero("gildur");
        UUID violet = rankedHero("violet");

        assertThat(send(get(ROOT + "/heroes/" + toro + "/ranking"), null, 200)).containsEntry("snapshot", null)
                .containsEntry("entry", null);

        var snapshot = send(post(ROOT + "/admin/ranking-snapshots"), snapshot(), 201);
        assertThat(send(get(ROOT + "/heroes/" + toro + "/ranking"), null, 200)).containsEntry("snapshot", null);
        send(post(ROOT + "/admin/ranking-snapshots/" + snapshot.get("id") + "/confirm"),
                Map.of("expectedVersion", 1), 200);

        var ranking = send(get(ROOT + "/heroes/" + toro + "/ranking"), null, 200);
        assertThat((Map<String, Object>) ranking.get("snapshot")).containsEntry("code", "vn-evaluation")
                .containsEntry("modeLabel", "Đấu hạng (Tinh Anh trở lên)").containsEntry("heroes", 3);
        var entry = (Map<String, Object>) ranking.get("entry");
        assertThat(entry).containsEntry("heroCode", "toro").containsEntry("tier", "T0").containsEntry("winRate", 49.42)
                .containsEntry("pickRate", null);
        assertThat((List<Map<String, Object>>) entry.get("figures")).filteredOn(f -> f.get("metric")
                .equals("DAMAGE_TAKEN")).singleElement().satisfies(f -> assertThat(f).containsEntry("rank", 1)
                        .containsEntry("of", 3).containsEntry("value", 32452.0));
        assertThat((List<Map<String, Object>>) entry.get("figures")).filteredOn(f -> f.get("metric")
                .equals("DAMAGE_DEALT")).singleElement().satisfies(f -> assertThat(f).containsEntry("rank", 3)
                        .containsEntry("of", 3));
        assertThat((List<Map<String, Object>>) entry.get("counters")).extracting(c -> c.get("heroCode"))
                .containsExactly("gildur");
        assertThat(ranking.toString()).doesNotContain("readText").doesNotContain("imageId");

        assertThat(send(get(ROOT + "/heroes/" + UUID.randomUUID() + "/ranking"), null, 200)).containsEntry("entry",
                null);
        assertThat(send(get(ROOT + "/heroes/" + violet + "/ranking").param("mode", "RANKED_ALL"), null, 200))
                .containsEntry("snapshot", null);
        send(get(ROOT + "/heroes/" + gildur + "/ranking").param("region", "vn"), null, 422);
        send(get(ROOT + "/heroes/" + gildur + "/ranking").param("unknown", "1"), null, 400);
    }

    private UUID rankedHero(String code) {
        UUID id = UUID.randomUUID();
        jdbc.sql("INSERT INTO hero.hero (id, code, created_at, created_by_issuer, created_by_subject) "
                + "VALUES (?, ?, now(), 'test', 'fixture')").params(id, code).update();
        return id;
    }

    private static Map<String, Object> snapshot() {
        var snapshot = new LinkedHashMap<String, Object>();
        snapshot.put("code", "vn-evaluation");
        snapshot.put("regionCode", "VN");
        snapshot.put("modeCode", "RANKED_ELITE");
        snapshot.put("modeLabel", "Đấu hạng (Tinh Anh trở lên)");
        snapshot.put("capturedAt", "2026-11-11T00:07:49Z");
        snapshot.put("sourceTimeZone", "Asia/Ho_Chi_Minh");
        snapshot.put("sourceRun", "ranking-test");
        snapshot.put("images", List.of(Map.of("imageId", PAGE, "board", "RATES", "pageNo", 1, "fileName", "r.png",
                "width", 2400, "height", 1080)));
        snapshot.put("heroes", List.of(
                rankedRow("toro", "TANK", 1, List.of(tier("T0"), number("WIN_RATE", 49.42),
                        number("DAMAGE_DEALT", 62434.26), number("DAMAGE_TAKEN", 32452.0), counter("gildur"))),
                rankedRow("gildur", "MAGE", 2, List.of(tier("T0"), number("DAMAGE_DEALT", 80000),
                        number("DAMAGE_TAKEN", 14000))),
                rankedRow("violet", "MARKSMAN", 3, List.of(tier("T0"), number("DAMAGE_DEALT", 95931.4),
                        number("DAMAGE_TAKEN", 13613)))));
        return snapshot;
    }

    private static Map<String, Object> rankedRow(String code, String role, int position,
            List<Map<String, Object>> values) {
        var row = new HashMap<String, Object>();
        row.put("heroCode", code);
        row.put("nameOnScreen", code);
        row.put("roleOnScreen", role);
        row.put("ratesPosition", position);
        row.put("figuresPosition", position);
        row.put("values", values);
        return row;
    }

    private static Map<String, Object> tier(String tier) {
        return rankedValue("TIER", null, tier, null);
    }

    private static Map<String, Object> number(String metric, Number value) {
        return rankedValue(metric, value, null, null);
    }

    private static Map<String, Object> counter(String hero) {
        return rankedValue("COUNTER_1", null, null, hero);
    }

    private static Map<String, Object> rankedValue(String metric, Number number, String tier, String hero) {
        var value = new HashMap<String, Object>();
        value.put("metric", metric);
        value.put("number", number);
        value.put("tier", tier);
        value.put("heroCode", hero);
        value.put("needsReview", false);
        return value;
    }

    private static Map<String, Object> trait(String code, List<String> skills, String detail) {
        return Map.of("code", code, "skillKeys", skills, "translations",
                List.of(Map.of("locale", "vi-VN", "detail", detail)));
    }

    private Map<String, Object> draft(String code, String name) throws Exception {
        var draft = send(post(ROOT + "/admin/heroes"), Map.of("code", code, "initialLocale", "vi-VN", "name", name,
                "rulesetId", ruleset, "releaseId", release), 201);
        UUID hero = uuid(draft, "heroId"), id = id(draft);
        String p = path(hero, id);
        draft = send(put(p + "/profile"), Map.of("expectedDraftVersion", number(draft, "version"), "translations",
                List.of(Map.of("locale", "vi-VN", "name", name)), "roles", List.of("WARRIOR"), "positions",
                List.of("TOP")), 200);
        draft = send(put(p + "/overview-ratings"), Map.of("expectedDraftVersion", number(draft, "version"),
                "scaleCode", "GAME_OVERVIEW_10", "survivability", 4, "attackDamage", 6, "skillEffects", 4,
                "difficulty", 8), 200);
        draft = send(put(p + "/combat-stats"), Map.of("expectedDraftVersion", number(draft, "version"), "values",
                List.of(Map.of("statKey", "HP", "baseValue", 3535, "unit", "POINT")), "sources",
                List.of(Map.of("label", "Verified fixture", "sourceUrl", "https://example.org/fixture",
                        "verificationState", "VERIFIED"))),
                200);
        draft = send(put(p + "/skills"), skills(number(draft, "version"), List.of("skill-1-1", "skill-2-1")), 200);
        draft = send(put(p + "/skins"), Map.of("expectedDraftVersion", number(draft, "version"), "skins", List.of()),
                200);
        return send(put(p + "/media-bindings"), Map.of("expectedDraftVersion", number(draft, "version"),
                "bindings", Map.of("HEAD", assets.get(MediaSemanticType.HERO_HEAD), "PORTRAIT",
                        assets.get(MediaSemanticType.HERO_PORTRAIT), "SPLASH",
                        assets.get(MediaSemanticType.HERO_SPLASH))),
                200);
    }

    private Map<String, Object> skills(long version, List<String> keys) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (int n = 0; n < keys.size(); n++)
            list.add(Map.of("skillKey", keys.get(n), "kind", "ACTIVE", "displayOrder", n + 1, "iconAssetId",
                    assets.get(MediaSemanticType.HERO_SKILL_ICON), "translations",
                    List.of(Map.of("locale", "vi-VN", "name", "Chiêu " + (n + 1), "description", "Mô tả")),
                    "effects", List.of()));
        return Map.of("expectedDraftVersion", version, "skills", list);
    }

    private void publish(Map<String, Object> draft) throws Exception {
        send(post(path(uuid(draft, "heroId"), id(draft)) + "/publish"),
                Map.of("expectedVersion", number(draft, "version")), 200);
    }

    private Map<String, Object> content(UUID hero, Map<String, Object> draft) throws Exception {
        return (Map<String, Object>) send(get(path(hero, id(draft))), null, 200).get("content");
    }

    private static List<Map<String, Object>> traits(Map<String, Object> content) {
        return (List<Map<String, Object>>) ((Map<String, Object>) content.get("skills")).get("traits");
    }

    private static Map<String, Object> profileText(Map<String, Object> content) {
        return ((List<Map<String, Object>>) ((Map<String, Object>) content.get("profile")).get("translations"))
                .getFirst();
    }

    private static List<Object> heroesWith(List<Map<String, Object>> index, String code) {
        return index.stream().filter(entry -> entry.get("code").equals(code)).findFirst()
                .map(entry -> ((List<Map<String, Object>>) entry.get("heroes")).stream().map(h -> h.get("code"))
                        .toList())
                .orElseThrow();
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

    private static String code(Map<String, Object> problem) {
        return (String) problem.get("code");
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
