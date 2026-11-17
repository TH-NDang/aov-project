package com.wikiaov.build.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.wikiaov.DockerBacked;
import com.wikiaov.SeaweedFsTestConfiguration;
import com.wikiaov.TestcontainersConfiguration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.json.JsonMapper;

/** ADR-026: recommended builds read from screenshots, with shared arcana pages and enchantment sets. */
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, SeaweedFsTestConfiguration.class})
@ActiveProfiles("test")
@DockerBacked
@SuppressWarnings("unchecked")
class BuildCaptureIntegrationTest {
    private static final String ADMIN = "/api/wiki/v1/admin/build-captures";
    private static final String PUBLIC = "/api/wiki/v1/builds";
    private static final String IMAGE_1 = "a".repeat(64), IMAGE_2 = "b".repeat(64), IMAGE_3 = "c".repeat(64),
            IMAGE_4 = "d".repeat(64);

    @Autowired
    MockMvc mvc;
    @Autowired
    JsonMapper json;
    @Autowired
    JdbcClient jdbc;

    private UUID ruleset, variant, toro;
    private final Map<String, UUID> ids = new HashMap<>();

    @BeforeEach
    void seed() {
        jdbc.sql("TRUNCATE build.capture, build.arcana_page, build.enchantment_set CASCADE").update();
        for (String domain : List.of("item", "arcana", "enchantment", "spell"))
            jdbc.sql("TRUNCATE " + domain + "." + domain + " CASCADE").update();
        jdbc.sql("TRUNCATE hero.import_job").update();
        jdbc.sql("TRUNCATE hero.hero CASCADE").update();
        ids.clear();

        ruleset = UUID.randomUUID();
        jdbc.sql("INSERT INTO patch.gameplay_ruleset VALUES (?, ?, 'Build fixture', 'ACTIVE', now())")
                .params(ruleset, "build-" + ruleset).update();
        UUID patch = UUID.randomUUID();
        jdbc.sql("INSERT INTO patch.game_patch (id, code, status, created_at, created_by_issuer, created_by_subject) "
                + "VALUES (?, ?, 'PUBLISHED', now(), 'test', 'editor')").params(patch, "patch-" + patch).update();
        variant = UUID.randomUUID();
        jdbc.sql("INSERT INTO patch.patch_variant (id, patch_id, ruleset_id, variant_code, ruleset_ordinal, status, "
                + "published_at, created_at) VALUES (?, ?, ?, 'standard', 1, 'PUBLISHED', now(), now())")
                .params(variant, patch, ruleset).update();

        toro = hero("toro");
        hero("krixi");
        jdbc.sql("INSERT INTO hero.hero_code_alias (legacy_code, hero_id) VALUES ('toro-old', ?)").param(toro).update();
        for (int number = 1; number <= 7; number++)
            catalog("item", "item-" + number, "{}", true);
        catalog("item", "item-draft", "{}", false);
        catalog("spell", "flicker", "{}", true);
        catalog("spell", "punish", "{}", true);
        catalog("arcana", "red-a", "{\"color\":\"RED\",\"tier\":3}", true);
        catalog("arcana", "red-b", "{\"color\":\"RED\",\"tier\":3}", true);
        catalog("arcana", "purple-a", "{\"color\":\"PURPLE\",\"tier\":3}", true);
        catalog("arcana", "purple-b", "{\"color\":\"PURPLE\",\"tier\":3}", true);
        catalog("arcana", "green-a", "{\"color\":\"GREEN\",\"tier\":3}", true);
        for (var entry : Map.of("a-1", "a:1", "a-2", "a:2", "a-3", "a:3", "b-1", "b:1", "b-2", "b:2", "c-1", "c:1")
                .entrySet()) {
            String[] fact = entry.getValue().split(":");
            catalog("enchantment", entry.getKey(),
                    "{\"branchCode\":\"" + fact[0] + "\",\"tier\":" + fact[1] + ",\"position\":0}", true);
        }
    }

    @Test
    void importsBuildsSharingArcanaPagesAndEnchantmentSets() throws Exception {
        var detail = send(post(ADMIN), capture("vn-pro-20261111"), 201, writer());

        assertThat(detail).containsEntry("code", "vn-pro-20261111").containsEntry("sourceKind", "PRO")
                .containsEntry("heroCount", 2).containsEntry("buildCount", 4).containsEntry("needsReviewCount", 1)
                .containsEntry("version", 1).containsEntry("confirmedAt", null);
        var heroes = (List<Map<String, Object>>) detail.get("heroes");
        assertThat(heroes).extracting(hero -> hero.get("heroCode")).containsExactly("toro", "krixi");
        var toroBuilds = builds(heroes.getFirst());
        assertThat(toroBuilds).extracting(build -> build.get("position")).containsExactly(1, 2, 3);
        assertThat(toroBuilds.get(0).get("contentKey")).isNotNull().isEqualTo(toroBuilds.get(1).get("contentKey"));
        assertThat(toroBuilds.get(0).get("arcanaPageId")).isEqualTo(toroBuilds.get(1).get("arcanaPageId"))
                .isNotEqualTo(toroBuilds.get(2).get("arcanaPageId"));
        assertThat((List<Map<String, Object>>) toroBuilds.getFirst().get("arcana"))
                .extracting(arcana -> arcana.get("code")).containsExactly("red-a", "purple-a", "purple-b", "green-a");
        assertThat((List<Map<String, Object>>) toroBuilds.getFirst().get("items")).hasSize(6).first()
                .satisfies(item -> assertThat(item).containsEntry("code", "item-1").containsKey("itemId"));
        var krixi = builds(heroes.get(1)).getFirst();
        assertThat(krixi).containsEntry("needsReview", true).containsEntry("spellId", null)
                .containsEntry("contentKey", null).containsEntry("arcanaPageId", toroBuilds.getFirst()
                        .get("arcanaPageId"));
        assertThat(count("build.arcana_page")).isEqualTo(2);
        assertThat(count("build.enchantment_set")).isEqualTo(2);

        var page = send(get(ADMIN).param("source", "PRO"), null, 200, writer());
        assertThat((List<Map<String, Object>>) page.get("items")).singleElement()
                .satisfies(row -> assertThat(row).containsEntry("buildCount", 4).doesNotContainKey("heroes"));
        send(get(ADMIN).param("unknown", "1"), null, 400, writer());
        assertThat(code(send(post(ADMIN), capture("vn-pro-20261111"), 409, writer()))).isEqualTo(
                "BUILD_CAPTURE_EXISTS");
    }

    @Test
    void aBuildWithoutArcanaIsCompleteBecauseTheGameIconsDoNotAlwaysTellThem() throws Exception {
        var capture = capture("no-arcana");
        build(capture, 0, 2).put("arcana", List.of());

        var detail = send(post(ADMIN), capture, 201, writer());
        var third = builds(((List<Map<String, Object>>) detail.get("heroes")).getFirst()).get(2);

        assertThat(third).containsEntry("needsReview", false).containsEntry("arcanaPageId", null)
                .containsEntry("arcana", List.of());
        assertThat(third.get("contentKey")).isNotNull();
        assertThat(count("build.arcana_page")).isEqualTo(1);
    }

    @Test
    void rejectsUnknownCodesAndBuildsTheGameDoesNotAllow() throws Exception {
        var unknown = capture("unknown");
        build(unknown, 0, 0).put("items", items("item-1", "item-2", "item-3", "item-4", "item-5", "item-draft"));
        var problem = send(post(ADMIN), unknown, 422, writer());
        assertThat(code(problem)).isEqualTo("BUILD_INVALID");
        assertThat((Map<String, Object>) ((Map<String, Object>) problem.get("context")).get("unknownCodes"))
                .containsEntry("ITEM", List.of("item-draft"));

        var mixedPrimary = capture("mixed-primary");
        build(mixedPrimary, 0, 0).put("enchantments", enchantments("a-1", "a-2", "b-2", "c-1", "b-1"));
        assertThat((String) send(post(ADMIN), mixedPrimary, 422, writer()).get("detail"))
                .contains("must share one branch");

        var tooMuchRed = capture("too-much-red");
        build(tooMuchRed, 0, 0).put("arcana", List.of(arcana("red-a", 6), arcana("red-b", 5)));
        assertThat((String) send(post(ADMIN), tooMuchRed, 422, writer()).get("detail")).contains("RED arcana");

        var incomplete = capture("incomplete");
        build(incomplete, 0, 0).put("spell", null);
        assertThat((String) send(post(ADMIN), incomplete, 422, writer()).get("detail")).contains("stay in review");
        assertThat(count("build.capture")).isZero();
        assertThat(count("build.arcana_page")).isZero();
    }

    @Test
    void reviewRepointsSharedValuesDropsUnusedOnesAndConfirmationNeedsPublishRights() throws Exception {
        var detail = send(post(ADMIN), capture("vn-pro-20261111"), 201, writer());
        String captureId = (String) detail.get("id");
        var heroes = (List<Map<String, Object>>) detail.get("heroes");
        var third = builds(heroes.getFirst()).get(2);
        var krixi = builds(heroes.get(1)).getFirst();

        assertThat(code(send(post(ADMIN + "/" + captureId + "/confirm"), Map.of("expectedVersion", 1), 409,
                publisher()))).isEqualTo("BUILD_REVIEW_OPEN");
        var reviewed = send(put(ADMIN + "/" + captureId + "/builds/" + krixi.get("id")),
                review(krixi, Map.of("spellId", ids.get("spell:flicker").toString(), "needsReview", false)), 200,
                writer());
        assertThat((Map<String, Object>) reviewed.get("build")).containsEntry("needsReview", false)
                .containsEntry("spellCode", "flicker").containsEntry("version", 2);
        assertThat((Map<String, Object>) reviewed.get("capture")).containsEntry("needsReviewCount", 0);
        send(put(ADMIN + "/" + captureId + "/builds/" + krixi.get("id")), review(krixi, Map.of()), 409, writer());

        var samePage = review(third, Map.of("needsReview", false));
        samePage.put("arcana", List.of(Map.of("arcanaId", ids.get("arcana:red-a").toString(), "quantity", 10),
                Map.of("arcanaId", ids.get("arcana:purple-a").toString(), "quantity", 3),
                Map.of("arcanaId", ids.get("arcana:purple-b").toString(), "quantity", 7),
                Map.of("arcanaId", ids.get("arcana:green-a").toString(), "quantity", 10)));
        send(put(ADMIN + "/" + captureId + "/builds/" + third.get("id")), samePage, 200, writer());
        assertThat(count("build.arcana_page")).isEqualTo(1);

        send(post(ADMIN + "/" + captureId + "/confirm"), Map.of("expectedVersion", 1), 403, writer());
        var confirmed = send(post(ADMIN + "/" + captureId + "/confirm"), Map.of("expectedVersion", 1), 200,
                publisher());
        assertThat(confirmed).containsEntry("version", 2);
        assertThat(confirmed.get("confirmedAt")).isNotNull();
    }

    @Test
    void publicReadsShowOnlyConfirmedCapturesAndMergeEqualBuilds() throws Exception {
        var imported = capture("vn-pro-20261111");
        build(imported, 0, 2).put("arcana", List.of());
        var detail = send(post(ADMIN), imported, 201, writer());
        String captureId = (String) detail.get("id");
        assertThat((List<?>) read("toro").get("sources")).isEmpty();

        var krixi = builds(((List<Map<String, Object>>) detail.get("heroes")).get(1)).getFirst();
        send(put(ADMIN + "/" + captureId + "/builds/" + krixi.get("id")),
                review(krixi, Map.of("spellId", ids.get("spell:punish").toString(), "needsReview", false)), 200,
                writer());
        send(post(ADMIN + "/" + captureId + "/confirm"), Map.of("expectedVersion", 1), 200, publisher());

        var toroBuilds = read("toro-old");
        assertThat(toroBuilds).containsEntry("heroCode", "toro").containsEntry("heroId", toro.toString());
        var source = ((List<Map<String, Object>>) toroBuilds.get("sources")).getFirst();
        assertThat(source).containsEntry("sourceKind", "PRO").containsEntry("sourceLabel", "Đề cử Pro")
                .containsEntry("result", "COLLECTED");
        var merged = (List<Map<String, Object>>) source.get("builds");
        assertThat(merged).extracting(build -> build.get("positions")).containsExactly(List.of(1, 2), List.of(3));
        assertThat((Map<String, Object>) merged.getFirst().get("arcanaPageUse")).containsEntry("builds", 3)
                .containsEntry("heroes", 2);
        assertThat(merged.get(1)).containsEntry("arcanaPageId", null).containsEntry("arcanaPageUse", null)
                .containsEntry("arcana", List.of());
        assertThat((List<Map<String, Object>>) merged.getFirst().get("items")).first()
                .satisfies(item -> assertThat(item).containsEntry("code", "item-1"));
        assertThat(merged.getFirst()).doesNotContainKey("playerName");

        mvc.perform(get(PUBLIC).param("hero", "nobody").param("region", "VN")).andExpect(status().isNotFound());
        mvc.perform(get(PUBLIC).param("hero", "toro").param("region", "VN").param("locale", "vi"))
                .andExpect(status().isBadRequest());
        assertThat((List<?>) read("toro", "TH").get("sources")).isEmpty();
    }

    @Test
    void deletingACaptureRemovesItsBuildsAndTheValuesNoBuildUses() throws Exception {
        var detail = send(post(ADMIN), capture("vn-pro-20261111"), 201, writer());
        String captureId = (String) detail.get("id");

        send(delete(ADMIN + "/" + captureId).param("expectedVersion", "9"), null, 409, writer());
        send(delete(ADMIN + "/" + captureId).param("expectedVersion", "1"), null, 204, writer());

        assertThat(count("build.capture")).isZero();
        assertThat(count("build.build")).isZero();
        assertThat(count("build.arcana_page")).isZero();
        assertThat(count("build.enchantment_set")).isZero();
        send(get(ADMIN + "/" + captureId), null, 404, writer());
    }

    private Map<String, Object> read(String hero) throws Exception {
        return read(hero, "VN");
    }

    private Map<String, Object> read(String hero, String region) throws Exception {
        var response = mvc.perform(get(PUBLIC).param("hero", hero).param("region", region))
                .andExpect(status().isOk()).andReturn().getResponse();
        return json.readValue(response.getContentAsString(), Map.class);
    }

    private UUID hero(String code) {
        UUID id = UUID.randomUUID();
        jdbc.sql("INSERT INTO hero.hero (id, code, created_at, created_by_issuer, created_by_subject) "
                + "VALUES (?, ?, now(), 'test', 'editor')").params(id, code).update();
        return id;
    }

    /** One identity with one revision, published unless {@code published} is false. */
    private void catalog(String domain, String code, String gameplay, boolean published) {
        UUID owner = UUID.randomUUID();
        ids.put(domain + ":" + code, owner);
        jdbc.sql("INSERT INTO " + domain + "." + domain + " VALUES (?, ?, now(), 'test', 'editor')")
                .params(owner, code).update();
        UUID revision = UUID.randomUUID();
        jdbc.sql("INSERT INTO " + domain + "." + domain + "_revision (id, owner_id, ruleset_id, revision_no, state, "
                + "version, cause, effective_from_patch_variant_id, gameplay, created_at, updated_at, "
                + "created_by_issuer, created_by_subject, updated_by_issuer, updated_by_subject) "
                + "VALUES (?, ?, ?, 1, 'DRAFT', 1, 'DATA_BASELINE', ?, cast(? as jsonb), now(), now(), 'test', "
                + "'editor', 'test', 'editor')").params(revision, owner, ruleset, variant, gameplay).update();
        if (published)
            jdbc.sql("UPDATE " + domain + "." + domain + "_revision SET state = 'PUBLISHED', "
                    + "publication_sequence = 1, published_at = now() WHERE id = ?").param(revision).update();
    }

    /**
     * Toro, named by a legacy code, has three builds: the first two are equal and the third uses another arcana page.
     * Krixi reuses Toro's first arcana page and waits for review without a spell.
     */
    private static Map<String, Object> capture(String code) {
        var page = List.of(arcana("red-a", 10), arcana("purple-b", 7), arcana("purple-a", 3), arcana("green-a", 10));
        var other = List.of(arcana("red-b", 10), arcana("purple-a", 10), arcana("green-a", 10));
        var sameBranch = enchantments("a-1", "a-2", "a-3", "b-1", "b-2");
        var twoBranches = enchantments("a-1", "a-2", "a-3", "c-1", "b-1");
        var toro = heroEntry("toro-old", "Toro", 1, List.of(
                buildEntry(1, IMAGE_1, sameBranch, page, "flicker", false),
                buildEntry(2, IMAGE_2, sameBranch, page, "flicker", false),
                buildEntry(3, IMAGE_3, twoBranches, other, "flicker", false)));
        var krixi = heroEntry("krixi", "Krixi", 2, List.of(buildEntry(1, IMAGE_4, sameBranch, page, null, true)));
        var capture = new LinkedHashMap<String, Object>();
        capture.put("code", code);
        capture.put("regionCode", "VN");
        capture.put("sourceKind", "PRO");
        capture.put("sourceLabel", "Đề cử Pro");
        capture.put("capturedAt", "2026-11-11T05:02:43Z");
        capture.put("sourceTimeZone", "Asia/Ho_Chi_Minh");
        capture.put("sourceRun", "pro-builds-20261111-120243-738");
        capture.put("sourceNote", "Test fixture");
        capture.put("images", List.of(image(IMAGE_1), image(IMAGE_2), image(IMAGE_3), image(IMAGE_4)));
        capture.put("heroes", new ArrayList<>(List.of(toro, krixi)));
        return capture;
    }

    private static Map<String, Object> build(Map<String, Object> capture, int hero, int build) {
        var heroes = (List<Map<String, Object>>) capture.get("heroes");
        return ((List<Map<String, Object>>) heroes.get(hero).get("builds")).get(build);
    }

    private static Map<String, Object> heroEntry(String code, String name, int order,
            List<Map<String, Object>> builds) {
        var hero = new HashMap<String, Object>();
        hero.put("heroCode", code);
        hero.put("nameOnScreen", name);
        hero.put("captureOrder", order);
        hero.put("result", "COLLECTED");
        hero.put("builds", new ArrayList<>(builds));
        return hero;
    }

    private static Map<String, Object> buildEntry(int position, String image, List<Map<String, Object>> enchantments,
            List<Map<String, Object>> arcana, String spell, boolean needsReview) {
        var build = new HashMap<String, Object>();
        build.put("position", position);
        build.put("imageId", image);
        build.put("items", items("item-1", "item-2", "item-3", "item-4", "item-5", "item-6"));
        build.put("enchantments", enchantments);
        build.put("arcana", arcana);
        build.put("spell", spell);
        build.put("needsReview", needsReview);
        build.put("note", needsReview ? "Phụ trợ bị che" : null);
        return build;
    }

    private static List<Map<String, Object>> items(String... codes) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (int index = 0; index < codes.length; index++)
            items.add(Map.of("slot", index + 1, "code", codes[index]));
        return items;
    }

    private static List<Map<String, Object>> enchantments(String... codes) {
        List<Map<String, Object>> enchantments = new ArrayList<>();
        for (int index = 0; index < codes.length; index++)
            enchantments.add(Map.of("slot", index + 1, "code", codes[index]));
        return enchantments;
    }

    private static Map<String, Object> arcana(String code, int quantity) {
        return Map.of("code", code, "quantity", quantity);
    }

    private static Map<String, Object> image(String id) {
        return Map.of("imageId", id, "fileName", id.charAt(0) + ".png", "width", 2400, "height", 1080, "layout",
                "PREPARE");
    }

    /** A review body that keeps the build's current content, with the given fields replaced. */
    private static Map<String, Object> review(Map<String, Object> build, Map<String, Object> changes) {
        var body = new HashMap<String, Object>();
        body.put("expectedVersion", build.get("version"));
        body.put("items", ((List<Map<String, Object>>) build.get("items")).stream()
                .map(item -> Map.of("slot", item.get("slot"), "itemId", item.get("itemId")))
                .toList());
        body.put("enchantments", ((List<Map<String, Object>>) build.get("enchantments")).stream()
                .map(enchantment -> Map.of("slot", enchantment.get("slot"), "enchantmentId",
                        enchantment.get("enchantmentId")))
                .toList());
        body.put("arcana", ((List<Map<String, Object>>) build.get("arcana")).stream()
                .map(arcana -> Map.of("arcanaId", arcana.get("arcanaId"), "quantity", arcana.get("quantity")))
                .toList());
        body.put("spellId", build.get("spellId"));
        body.put("needsReview", build.get("needsReview"));
        body.putAll(changes);
        return body;
    }

    private static List<Map<String, Object>> builds(Map<String, Object> hero) {
        return (List<Map<String, Object>>) hero.get("builds");
    }

    private long count(String table) {
        return jdbc.sql("SELECT count(*) FROM " + table).query(Long.class).single();
    }

    private static String code(Map<String, Object> problem) {
        return (String) problem.get("code");
    }

    private static List<GrantedAuthority> writer() {
        return List.of(new SimpleGrantedAuthority("catalog:read"), new SimpleGrantedAuthority("hero:write"));
    }

    private static List<GrantedAuthority> publisher() {
        return List.of(new SimpleGrantedAuthority("catalog:read"), new SimpleGrantedAuthority("hero:write"),
                new SimpleGrantedAuthority("hero:publish"));
    }

    private Map<String, Object> send(MockHttpServletRequestBuilder request, Object body, int status,
            List<GrantedAuthority> authorities) throws Exception {
        request.with(jwt().jwt(t -> t.issuer("https://test.example/issuer").subject("editor"))
                .authorities(authorities));
        if (body != null)
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        var response = mvc.perform(request).andExpect(status().is(status)).andReturn().getResponse();
        return response.getContentAsString().isEmpty()
                ? Map.of()
                : json.readValue(response.getContentAsString(), Map.class);
    }
}
