package com.wikiaov.hero.internal.web;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.wikiaov.MutableClock;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;

/** ADR-025: snapshots of the game's hero ranking boards, imported from screenshots and reviewed value by value. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(DomainCoreIntegrationTest.Beans.class)
@EnabledIf("databaseAvailable")
@SuppressWarnings("unchecked")
class HeroRankingIntegrationTest {
    private static final String ROOT = "/api/wiki/v1/admin/ranking-snapshots";
    private static final String RATES_PAGE = "a".repeat(64);
    private static final String FIGURES_PAGE = "b".repeat(64);
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
    private UUID toro, gildur, flowbornAd;

    @BeforeEach
    void setup() {
        clock.set(Instant.parse("2026-11-11T02:00:00Z"));
        jdbc.sql("TRUNCATE hero.ranking_snapshot CASCADE").update();
        jdbc.sql("TRUNCATE hero.import_job").update();
        jdbc.sql("TRUNCATE hero.hero CASCADE").update();
        toro = hero("toro");
        gildur = hero("gildur");
        flowbornAd = hero("flowborn-ad");
        jdbc.sql("INSERT INTO hero.hero_code_alias (legacy_code, hero_id) VALUES ('gildur-old', ?)").param(gildur)
                .update();
    }

    @Test
    void importsASnapshotWithItsEvidenceAndListsItWithItsOpenReviews() throws Exception {
        var detail = send(post(ROOT), snapshot("vn-ranked-elite-20261111-0705"), 201);

        assertThat(detail).containsEntry("code", "vn-ranked-elite-20261111-0705").containsEntry("regionCode", "VN")
                .containsEntry("modeLabel", "Đấu hạng (Tinh Anh trở lên)").containsEntry("heroCount", 3)
                .containsEntry("valueCount", 7).containsEntry("needsReviewCount", 2).containsEntry("version", 1)
                .containsEntry("capturedAt", "2026-11-11T00:07:49Z").containsEntry("confirmedAt", null);
        assertThat((List<Map<String, Object>>) detail.get("images")).extracting(i -> i.get("board"))
                .containsExactly("RATES", "FIGURES");
        var heroes = (List<Map<String, Object>>) detail.get("heroes");
        assertThat(heroes).extracting(h -> h.get("heroCode")).containsExactly("toro", "gildur", "flowborn-ad");
        assertThat(heroes.get(1)).containsEntry("heroId", gildur.toString());
        var toroValues = values(heroes.getFirst());
        assertThat(toroValues).extracting(v -> v.get("metric")).containsExactly("TIER", "WIN_RATE", "COUNTER_1",
                "DAMAGE_DEALT");
        assertThat(toroValues.get(1)).containsEntry("number", 49.42).containsEntry("readText", "49,42%")
                .containsEntry("needsReview", false)
                .containsEntry("source", Map.of("imageId", RATES_PAGE, "x", 955, "y", 410, "width", 190,
                        "height", 112));
        assertThat(toroValues.get(2)).containsEntry("heroId", gildur.toString()).containsEntry("heroCode", "gildur");
        assertThat(toroValues.get(3)).containsEntry("number", 62434.26);
        assertThat(values(heroes.get(2)).getFirst()).containsEntry("number", null).containsEntry("needsReview", true)
                .containsEntry("source", null);

        send(post(ROOT), Map.of("code", "x"), 400);
        var page = send(get(ROOT).param("mode", "RANKED_ELITE"), null, 200);
        assertThat((List<Map<String, Object>>) page.get("items")).singleElement()
                .satisfies(row -> assertThat(row).containsEntry("needsReviewCount", 2).containsEntry("heroCount", 3)
                        .doesNotContainKey("heroes"));
        assertThat((List<?>) send(get(ROOT).param("region", "TH"), null, 200).get("items")).isEmpty();
        send(get(ROOT).param("unknown", "1"), null, 400);
        assertThat(jdbc.sql("SELECT count(*) FROM access.audit_event WHERE action='HERO_RANKING_SNAPSHOT_IMPORTED' "
                + "AND aggregate_id=?").param(UUID.fromString((String) detail.get("id"))).query(Long.class).single())
                .isEqualTo(1L);

        mvc.perform(get(ROOT).with(jwt().authorities(new SimpleGrantedAuthority("catalog:read"))))
                .andExpect(status().isOk());
        mvc.perform(post(ROOT).with(jwt().authorities(new SimpleGrantedAuthority("catalog:read")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(snapshot("other")))).andExpect(status().isForbidden());
    }

    @Test
    void rejectsSnapshotsThatDoNotHoldTogether() throws Exception {
        send(post(ROOT), snapshot("vn-ranked-elite-20261111-0705"), 201);
        assertThat(code(send(post(ROOT), snapshot("vn-ranked-elite-20261111-0705"), 409)))
                .isEqualTo("HERO_RANKING_SNAPSHOT_EXISTS");

        var unknown = snapshot("unknown-hero");
        heroesOf(unknown).getFirst().put("heroCode", "nobody");
        var problem = send(post(ROOT), unknown, 422);
        assertThat(code(problem)).isEqualTo("HERO_RANKING_INVALID");
        assertThat(((Map<String, Object>) problem.get("context")).get("unknownHeroCodes")).isEqualTo(List.of("nobody"));

        var wrongKind = snapshot("wrong-kind");
        valuesOf(wrongKind, 0).get(1).put("tier", "T1");
        assertThat(code(send(post(ROOT), wrongKind, 422))).isEqualTo("HERO_RANKING_INVALID");

        var gapWithoutReview = snapshot("gap");
        valuesOf(gapWithoutReview, 2).getFirst().put("needsReview", false);
        send(post(ROOT), gapWithoutReview, 422);

        var outside = snapshot("outside");
        ((Map<String, Object>) valuesOf(outside, 0).get(1).get("source")).put("x", 2300);
        send(post(ROOT), outside, 422);

        var percent = snapshot("percent");
        valuesOf(percent, 0).get(1).put("number", 140);
        send(post(ROOT), percent, 422);

        var twice = snapshot("twice");
        heroesOf(twice).get(2).put("heroCode", "gildur");
        send(post(ROOT), twice, 422);

        var zone = snapshot("zone");
        zone.put("sourceTimeZone", "Mars/Olympus");
        send(post(ROOT), zone, 422);
        assertThat(jdbc.sql("SELECT count(*) FROM hero.ranking_snapshot").query(Long.class).single()).isEqualTo(1L);
    }

    @Test
    void editorsConfirmCorrectAndFlagValuesBeforeSigningOffTheSnapshot() throws Exception {
        var detail = send(post(ROOT), snapshot("vn-ranked-elite-20261111-0705"), 201);
        String id = (String) detail.get("id");
        String value = ROOT + "/" + id + "/heroes/";

        var open = send(post(ROOT + "/" + id + "/confirm"), Map.of("expectedVersion", 1), 409);
        assertThat(code(open)).isEqualTo("HERO_RANKING_REVIEW_OPEN");
        assertThat(((Map<String, Object>) open.get("context")).get("needsReview")).isEqualTo(2);

        send(put(value + flowbornAd + "/values/DAMAGE_DEALT"),
                Map.of("expectedVersion", 1, "needsReview", false), 422);
        var filled = send(put(value + flowbornAd + "/values/DAMAGE_DEALT"),
                Map.of("expectedVersion", 1, "number", 113269.02, "needsReview", false, "note", "Đọc lại trong game"),
                200);
        assertThat((Map<String, Object>) filled.get("value")).containsEntry("number", 113269.02)
                .containsEntry("needsReview", false).containsEntry("version", 2).containsEntry("readText", null)
                .containsEntry("note", "Đọc lại trong game").containsEntry("reviewedAt", "2026-11-11T02:00:00Z");
        assertThat((Map<String, Object>) filled.get("snapshot")).containsEntry("needsReviewCount", 1);
        assertThat(code(send(put(value + flowbornAd + "/values/DAMAGE_DEALT"),
                Map.of("expectedVersion", 1, "number", 1, "needsReview", false), 409)))
                .isEqualTo("HERO_RANKING_VERSION_CONFLICT");

        send(put(value + gildur + "/values/COUNTER_1"), Map.of("expectedVersion", 1, "heroId", UUID.randomUUID(),
                "needsReview", false), 422);
        var counter = send(put(value + gildur + "/values/COUNTER_1"),
                Map.of("expectedVersion", 1, "heroId", flowbornAd, "needsReview", false), 200);
        assertThat((Map<String, Object>) counter.get("value")).containsEntry("heroCode", "flowborn-ad");
        send(put(value + gildur + "/values/KILLS"), Map.of("expectedVersion", 1, "number", 3, "needsReview", false),
                404);
        send(put(value + gildur + "/values/SPEED"), Map.of("expectedVersion", 1, "needsReview", false), 422);

        var confirmed = send(post(ROOT + "/" + id + "/confirm"), Map.of("expectedVersion", 1), 200);
        assertThat(confirmed).containsEntry("version", 2).containsEntry("needsReviewCount", 0)
                .containsEntry("confirmedAt", "2026-11-11T02:00:00Z");
        assertThat(send(post(ROOT + "/" + id + "/confirm"), Map.of("expectedVersion", 1), 200))
                .containsEntry("version", 2);

        var flagged = send(put(value + toro + "/values/WIN_RATE"),
                Map.of("expectedVersion", 1, "number", 49.42, "needsReview", true, "note", "Kiểm tra lại"), 200);
        assertThat((Map<String, Object>) flagged.get("snapshot")).containsEntry("confirmedAt", null)
                .containsEntry("version", 3).containsEntry("needsReviewCount", 1);
        assertThat((Map<String, Object>) flagged.get("value")).containsEntry("reviewedAt", null);
        assertThat(jdbc.sql("SELECT count(*) FROM access.audit_event WHERE action='HERO_RANKING_VALUE_REVIEWED' "
                + "AND aggregate_id=?").param(UUID.fromString(id)).query(Long.class).single()).isEqualTo(3L);
    }

    @Test
    void deletingASnapshotNeedsItsCurrentVersionAndRemovesEverythingItHolds() throws Exception {
        String id = (String) send(post(ROOT), snapshot("vn-ranked-elite-20261111-0705"), 201).get("id");

        send(delete(ROOT + "/" + id).param("expectedVersion", "5"), null, 409);
        send(delete(ROOT + "/" + id).param("expectedVersion", "1"), null, 204);

        send(get(ROOT + "/" + id), null, 404);
        assertThat(jdbc.sql("SELECT count(*) FROM hero.ranking_snapshot_value").query(Long.class).single()).isZero();
        assertThat(jdbc.sql("SELECT count(*) FROM hero.ranking_snapshot_image").query(Long.class).single()).isZero();
        assertThat(jdbc.sql("SELECT count(*) FROM hero.hero WHERE id=?").param(toro).query(Long.class).single())
                .isEqualTo(1L);
    }

    private UUID hero(String code) {
        UUID id = UUID.randomUUID();
        jdbc.sql("INSERT INTO hero.hero (id, code, created_at, created_by_issuer, created_by_subject) "
                + "VALUES (?, ?, now(), 'test', 'fixture')").params(id, code).update();
        return id;
    }

    /** Three rows: a complete one, one named by a legacy code, and a form whose figures are missing. */
    private static Map<String, Object> snapshot(String code) {
        var heroes = new ArrayList<Map<String, Object>>();
        heroes.add(hero("toro", "Toro", "TANK", 1, 2, new ArrayList<>(List.of(
                value("TIER", null, "T0", null, "T0", false, box(RATES_PAGE, 735, 410, 115, 112)),
                value("WIN_RATE", 49.42, null, null, "49,42%", false, box(RATES_PAGE, 955, 410, 190, 112)),
                value("COUNTER_1", null, null, "gildur", null, false, box(RATES_PAGE, 1825, 422, 88, 88)),
                value("DAMAGE_DEALT", 62434.26, null, null, "62.434,26", false,
                        box(FIGURES_PAGE, 1005, 410, 250, 112))))));
        heroes.add(hero("gildur-old", "Gildur", "MAGE", 2, 1, new ArrayList<>(List.of(
                value("COUNTER_1", null, null, "toro", null, true, box(RATES_PAGE, 1825, 555, 88, 88)),
                value("TIER", null, "T0", null, "T0", false, null)))));
        heroes.add(hero("flowborn-ad", "Flowborn", "MARKSMAN", 3, null, new ArrayList<>(List.of(
                value("DAMAGE_DEALT", null, null, null, null, true, null)))));
        var snapshot = new LinkedHashMap<String, Object>();
        snapshot.put("code", code);
        snapshot.put("regionCode", "VN");
        snapshot.put("modeCode", "RANKED_ELITE");
        snapshot.put("modeLabel", "Đấu hạng (Tinh Anh trở lên)");
        snapshot.put("periodLabel", null);
        snapshot.put("capturedAt", "2026-11-11T00:07:49Z");
        snapshot.put("sourceTimeZone", "Asia/Ho_Chi_Minh");
        snapshot.put("sourceRun", "ranking-20261111-070528-451");
        snapshot.put("sourceNote", "Test fixture");
        snapshot.put("images", List.of(image(RATES_PAGE, "RATES", 1), image(FIGURES_PAGE, "FIGURES", 1)));
        snapshot.put("heroes", heroes);
        return snapshot;
    }

    private static Map<String, Object> image(String id, String board, int page) {
        return Map.of("imageId", id, "board", board, "pageNo", page, "fileName", board + "-" + page + ".png",
                "width", 2400, "height", 1080);
    }

    private static Map<String, Object> hero(String code, String name, String role, Integer rates, Integer figures,
            List<Map<String, Object>> values) {
        var hero = new HashMap<String, Object>();
        hero.put("heroCode", code);
        hero.put("nameOnScreen", name);
        hero.put("roleOnScreen", role);
        hero.put("ratesPosition", rates);
        hero.put("figuresPosition", figures);
        hero.put("values", values);
        return hero;
    }

    private static Map<String, Object> value(String metric, Number number, String tier, String heroCode,
            String readText, boolean needsReview, Map<String, Object> source) {
        var value = new HashMap<String, Object>();
        value.put("metric", metric);
        value.put("number", number);
        value.put("tier", tier);
        value.put("heroCode", heroCode);
        value.put("readText", readText);
        value.put("needsReview", needsReview);
        value.put("note", needsReview ? "Cần xem lại" : null);
        value.put("source", source == null ? null : new HashMap<>(source));
        return value;
    }

    private static Map<String, Object> box(String image, int x, int y, int width, int height) {
        return Map.of("imageId", image, "x", x, "y", y, "width", width, "height", height);
    }

    private static List<Map<String, Object>> heroesOf(Map<String, Object> snapshot) {
        return (List<Map<String, Object>>) snapshot.get("heroes");
    }

    private static List<Map<String, Object>> valuesOf(Map<String, Object> snapshot, int hero) {
        return (List<Map<String, Object>>) heroesOf(snapshot).get(hero).get("values");
    }

    private static List<Map<String, Object>> values(Map<String, Object> hero) {
        return (List<Map<String, Object>>) hero.get("values");
    }

    private static String code(Map<String, Object> problem) {
        return (String) problem.get("code");
    }

    private Map<String, Object> send(MockHttpServletRequestBuilder request, Object body, int status) throws Exception {
        request.with(jwt().jwt(t -> t.issuer("https://test.example/issuer").subject("editor")).authorities(
                new SimpleGrantedAuthority("catalog:read"), new SimpleGrantedAuthority("hero:write")));
        if (body != null)
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        var response = mvc.perform(request).andExpect(status().is(status)).andReturn().getResponse();
        return response.getContentAsString().isEmpty()
                ? Map.of()
                : json.readValue(response.getContentAsString(), Map.class);
    }
}
