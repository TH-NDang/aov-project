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

/** ADR-024: a hero holding ordered forms, as readers browse it and as players pick its forms. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(DomainCoreIntegrationTest.Beans.class)
@EnabledIf("databaseAvailable")
@SuppressWarnings("unchecked")
class HeroFormsIntegrationTest {
    private static final String ROOT = "/api/wiki/v1";
    private static final UUID VN = UUID.fromString("5d5dcd5e-15b9-4d43-884d-111111111111");
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
    private UUID ruleset, variant, release;
    private final Map<MediaSemanticType, UUID> assets = new EnumMap<>(MediaSemanticType.class);

    @BeforeEach
    void setup() throws Exception {
        clock.set(Instant.parse("2026-10-15T00:00:00Z"));
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
                Map.of("code", "AOV-FORMS", "description", "Verified test fixture"), 201));
        send(post(ROOT + "/admin/regions/" + VN + "/ruleset-assignments"),
                Map.of("rulesetId", ruleset, "validFrom", "2026-01-01T00:00:00Z"), 201);
        var season = send(post(ROOT + "/admin/seasons"), Map.of("code", "forms-season", "displayName", "S1 2026"),
                201);
        send(post(ROOT + "/admin/seasons/" + season.get("id") + "/schedules"),
                Map.of("regionId", VN, "startsAt", "2026-01-01T00:00:00Z", "endsAt", "2027-01-01T00:00:00Z"), 201);
        UUID patch = id(send(post(ROOT + "/admin/patches"), Map.of("code", "forms-patch", "translations",
                List.of(Map.of("locale", "vi-VN", "title", "Bản thử nghiệm", "summary", "Dữ liệu kiểm thử"))), 201));
        variant = id(send(post(ROOT + "/admin/patches/" + patch + "/variants"),
                Map.of("rulesetId", ruleset, "variantCode", "TEST", "rulesetOrdinal", 1), 201));
        send(post(ROOT + "/admin/patch-variants/" + variant + "/publish"), null, 204);
        send(post(ROOT + "/admin/patch-variants/" + variant + "/releases"),
                Map.of("regionId", VN, "effectiveAt", "2026-01-02T00:00:00Z"), 201);
        release = jdbc.sql("SELECT id FROM patch.patch_release WHERE patch_variant_id=?").param(variant)
                .query(UUID.class).single();
    }

    @Test
    void readersBrowseOneHeroWithItsFormsAndPlayersPickEachForm() throws Exception {
        UUID ad = publishedForm("flowborn-ad", "Flowborn Xạ thủ", "MARKSMAN", "DRAGON");
        var midDraft = form("flowborn-mid", "Flowborn Pháp sư", "MAGE", "MID");
        UUID mid = uuid(midDraft, "heroId");
        var holderDraft = holderDraft();
        UUID holder = uuid(holderDraft, "heroId");

        mvc.perform(put(ROOT + "/admin/heroes/" + holder + "/forms")
                .with(jwt().authorities(new SimpleGrantedAuthority("hero:write")))
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(forms(List.of(), ad, mid))))
                .andExpect(status().isForbidden());
        var view = send(put(ROOT + "/admin/heroes/" + holder + "/forms"), forms(List.of(), ad, mid), 200);
        publish(holderDraft);
        assertThat((Map<String, Object>) view.get("holder")).containsEntry("code", "flowborn");
        assertThat((List<Map<String, Object>>) view.get("forms")).extracting(f -> f.get("formKey"),
                f -> f.get("published"), f -> f.get("draftOpen"))
                .containsExactly(tuple("ad", true, false), tuple("mid", false, true));
        assertThat(jdbc.sql("SELECT count(*) FROM access.audit_event WHERE action='HERO_FORMS_UPDATED' "
                + "AND aggregate_id=?").param(holder).query(Long.class).single()).isEqualTo(1L);

        var browse = items(send(get(ROOT + "/heroes"), null, 200));
        assertThat(browse).extracting(item -> item.get("code")).containsExactly("flowborn");
        assertThat(browse.getFirst()).containsEntry("name", "Flowborn").containsEntry("roles", List.of("MARKSMAN"))
                .containsEntry("positions", List.of("DRAGON"));
        assertThat((List<Map<String, Object>>) browse.getFirst().get("forms")).singleElement()
                .satisfies(form -> assertThat(form).containsEntry("code", "flowborn-ad").containsEntry("formKey", "ad")
                        .containsEntry("name", "Flowborn Xạ thủ").containsKey("head"));
        assertThat(items(send(get(ROOT + "/heroes").param("q", "xạ thủ"), null, 200)))
                .extracting(item -> item.get("code"))
                .containsExactly("flowborn");
        assertThat(items(send(get(ROOT + "/heroes?role=MAGE"), null, 200))).isEmpty();

        send(post(ROOT + "/admin/heroes/" + mid + "/drafts/" + id(midDraft) + "/publish"),
                Map.of("expectedVersion", number(midDraft, "version")), 200);
        var mage = items(send(get(ROOT + "/heroes?role=MAGE"), null, 200));
        assertThat(mage).singleElement().satisfies(item -> {
            assertThat(item).containsEntry("roles", List.of("MARKSMAN", "MAGE"));
            assertThat((List<Map<String, Object>>) item.get("forms")).extracting(f -> f.get("formKey"))
                    .containsExactly("ad", "mid");
        });

        var playable = items(send(get(ROOT + "/heroes?playable=true"), null, 200));
        assertThat(playable).extracting(item -> item.get("code")).containsExactlyInAnyOrder("flowborn-ad",
                "flowborn-mid");
        assertThat(playable).allSatisfy(item -> assertThat((Map<String, Object>) item.get("parent"))
                .containsEntry("id", holder.toString()).containsEntry("code", "flowborn"));

        var detail = send(get(ROOT + "/heroes/" + holder), null, 200);
        assertThat(((Map<String, Object>) ((Map<String, Object>) detail.get("content")).get("profile")))
                .containsEntry("name", "Flowborn").containsEntry("title", "Hậu duệ Khởi Nguyên");
        var detailForms = (List<Map<String, Object>>) detail.get("forms");
        assertThat(detailForms).extracting(f -> f.get("code"), f -> f.get("formKey"), f -> f.get("displayOrder"))
                .containsExactly(tuple("flowborn-ad", "ad", 1), tuple("flowborn-mid", "mid", 2));
        assertThat(detailForms.getFirst()).doesNotContainKey("context").containsKey("skillMedia")
                .containsEntry("actualLocale", "vi-VN");
        assertThat((Map<String, Object>) send(get(ROOT + "/heroes/" + mid), null, 200).get("parent"))
                .containsEntry("id", holder.toString()).containsEntry("formKey", "mid");

        var fromForm = send(get(ROOT + "/admin/heroes/" + mid + "/forms"), null, 200);
        assertThat(fromForm).containsEntry("formKey", "mid");
        assertThat((Map<String, Object>) fromForm.get("holder")).containsEntry("id", holder.toString());
        assertThat(send(get(ROOT + "/admin/heroes/" + ad + "/forms?unknown=1"), null, 400)).isNotNull();

        var readiness = publishReadiness();
        assertThat(readiness.stream().filter(row -> row.get("id").equals(mid.toString())).findFirst().orElseThrow())
                .containsEntry("holderId", holder.toString()).containsEntry("formKey", "mid");
        assertThat(readiness.stream().filter(row -> row.get("id").equals(holder.toString())).findFirst().orElseThrow())
                .containsEntry("formIds", List.of(ad.toString(), mid.toString()));
        var catalog = (List<Map<String, Object>>) send(get(ROOT + "/admin/heroes?q=flowborn"), null, 200)
                .get("items");
        assertThat(catalog.stream().filter(row -> row.get("id").equals(ad.toString())).findFirst().orElseThrow())
                .containsEntry("holderId", holder.toString()).containsEntry("formKey", "ad");
    }

    @Test
    void formsStayOneLevelDeepFollowTheCodeAndLeaveGameplayToTheForms() throws Exception {
        UUID ad = publishedForm("flowborn-ad", "Flowborn Xạ thủ", "MARKSMAN", "DRAGON");
        UUID other = uuid(form("other-tank", "Other", "TANK", "TOP"), "heroId");
        var holderDraft = holderDraft();
        UUID holder = uuid(holderDraft, "heroId");

        send(put(ROOT + "/admin/heroes/" + holder + "/forms"), entries(List.of(), entry(other, "tank")), 422);
        send(put(ROOT + "/admin/heroes/" + ad + "/forms"), forms(List.of()), 200);
        send(put(ROOT + "/admin/heroes/" + holder + "/forms"), forms(List.of(), ad), 200);
        send(put(ROOT + "/admin/heroes/" + holder + "/forms"), forms(List.of(), ad), 409);
        publish(holderDraft);
        send(put(ROOT + "/admin/heroes/" + ad + "/forms"), entries(List.of(), entry(other, "x")), 422);
        var problem = send(put(ROOT + "/admin/heroes/" + other + "/forms"), entries(List.of(), entry(ad, "ad")),
                422);
        assertThat(problem).containsEntry("code", "HERO_INVALID_CONTENT");

        var correction = send(post(ROOT + "/admin/heroes/" + holder + "/drafts"),
                Map.of("rulesetId", ruleset, "cause", "CONTENT_CORRECTION"), 201);
        var gameplay = send(put(path(holder, id(correction)) + "/profile"), Map.of("expectedDraftVersion", 1,
                "translations", List.of(Map.of("locale", "vi-VN", "name", "Flowborn")), "roles", List.of("TANK")),
                422);
        assertThat(gameplay).containsEntry("code", "HERO_FORM_PARENT_GAMEPLAY");
        send(put(path(holder, id(correction)) + "/combat-stats"), Map.of("expectedDraftVersion", 1, "values",
                List.of(Map.of("statKey", "HP", "baseValue", 3500, "unit", "POINT"))), 422);
        send(put(path(holder, id(correction)) + "/profile"), Map.of("expectedDraftVersion", 1, "translations",
                List.of(Map.of("locale", "vi-VN", "name", "Flowborn", "lore", "Truyện")), "roles", List.of()), 200);

        UUID airi = publishedForm("airi", "Airi", "ASSASSIN", "JUNGLE");
        UUID airiForm = uuid(form("airi-x", "Airi X", "WARRIOR", "TOP"), "heroId");
        assertThat(send(put(ROOT + "/admin/heroes/" + airi + "/forms"), forms(List.of(), airiForm), 422))
                .containsEntry("code", "HERO_FORM_PARENT_GAMEPLAY");

        send(put(ROOT + "/admin/heroes/" + holder + "/forms"), forms(List.of(ad)), 200);
        assertThat(items(send(get(ROOT + "/heroes"), null, 200))).extracting(item -> item.get("code"))
                .contains("flowborn-ad", "airi").doesNotContain("flowborn-mid");
    }

    /** The hero that will hold the forms: names and images only, published once it holds its forms. */
    private Map<String, Object> holderDraft() throws Exception {
        var draft = send(post(ROOT + "/admin/heroes"), Map.of("code", "flowborn", "initialLocale", "vi-VN", "name",
                "Flowborn", "rulesetId", ruleset, "releaseId", release), 201);
        UUID hero = uuid(draft, "heroId"), id = id(draft);
        draft = send(put(path(hero, id) + "/profile"), Map.of("expectedDraftVersion", number(draft, "version"),
                "translations", List.of(Map.of("locale", "vi-VN", "name", "Flowborn", "title", "Hậu duệ Khởi Nguyên")),
                "roles", List.of()), 200);
        return media(hero, id, draft);
    }

    private void publish(Map<String, Object> draft) throws Exception {
        send(post(path(uuid(draft, "heroId"), id(draft)) + "/publish"),
                Map.of("expectedVersion", number(draft, "version")), 200);
    }

    private UUID publishedForm(String code, String name, String role, String position) throws Exception {
        var draft = form(code, name, role, position);
        send(post(path(uuid(draft, "heroId"), id(draft)) + "/publish"),
                Map.of("expectedVersion", number(draft, "version")), 200);
        return uuid(draft, "heroId");
    }

    private Map<String, Object> form(String code, String name, String role, String position) throws Exception {
        var draft = send(post(ROOT + "/admin/heroes"), Map.of("code", code, "initialLocale", "vi-VN", "name", name,
                "rulesetId", ruleset, "releaseId", release), 201);
        UUID hero = uuid(draft, "heroId"), id = id(draft);
        String p = path(hero, id);
        draft = send(put(p + "/profile"), Map.of("expectedDraftVersion", number(draft, "version"), "translations",
                List.of(Map.of("locale", "vi-VN", "name", name)), "roles", List.of(role), "positions",
                List.of(position)), 200);
        draft = send(put(p + "/overview-ratings"), Map.of("expectedDraftVersion", number(draft, "version"),
                "scaleCode", "GAME_OVERVIEW_10", "survivability", 5, "attackDamage", 8, "skillEffects", 6,
                "difficulty", 4), 200);
        draft = send(put(p + "/combat-stats"), Map.of("expectedDraftVersion", number(draft, "version"), "values",
                List.of(Map.of("statKey", "HP", "baseValue", 3200, "unit", "POINT")), "sources",
                List.of(Map.of("label", "Verified fixture", "sourceUrl", "https://example.org/fixture",
                        "verificationState", "VERIFIED"))),
                200);
        draft = send(put(p + "/skills"), Map.of("expectedDraftVersion", number(draft, "version"), "skills",
                List.of(Map.of("skillKey", "skill-1-1", "kind", "ACTIVE", "displayOrder", 1, "iconAssetId",
                        assets.get(MediaSemanticType.HERO_SKILL_ICON), "translations",
                        List.of(Map.of("locale", "vi-VN", "name", "Dòng chảy hội tụ", "description", "Mô tả")),
                        "effects", List.of()))),
                200);
        draft = send(put(p + "/skins"), Map.of("expectedDraftVersion", number(draft, "version"), "skins", List.of()),
                200);
        return media(hero, id, draft);
    }

    private Map<String, Object> media(UUID hero, UUID id, Map<String, Object> draft) throws Exception {
        return send(put(path(hero, id) + "/media-bindings"), Map.of("expectedDraftVersion", number(draft, "version"),
                "bindings", Map.of("HEAD", assets.get(MediaSemanticType.HERO_HEAD), "PORTRAIT",
                        assets.get(MediaSemanticType.HERO_PORTRAIT), "SPLASH",
                        assets.get(MediaSemanticType.HERO_SPLASH))),
                200);
    }

    private static Map<String, Object> entry(UUID hero, String formKey) {
        return Map.of("heroId", hero, "formKey", formKey);
    }

    @SafeVarargs
    private static Map<String, Object> entries(List<UUID> expected, Map<String, Object>... entries) {
        return Map.of("expectedForms", expected, "forms", List.of(entries));
    }

    private Map<String, Object> forms(List<UUID> expected, UUID... heroes) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (UUID hero : heroes) {
            String code = jdbc.sql("SELECT code FROM hero.hero WHERE id=?").param(hero).query(String.class).single();
            list.add(Map.of("heroId", hero, "formKey", code.substring(code.indexOf('-') + 1)));
        }
        return Map.of("expectedForms", expected, "forms", list);
    }

    private List<Map<String, Object>> publishReadiness() throws Exception {
        var response = mvc.perform(get(ROOT + "/admin/heroes/publish-readiness")
                .with(jwt().authorities(new SimpleGrantedAuthority("catalog:read")))).andExpect(status().isOk())
                .andReturn().getResponse();
        return json.readValue(response.getContentAsString(), List.class);
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

    private static List<Map<String, Object>> items(Map<String, Object> page) {
        return (List<Map<String, Object>>) page.get("items");
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
