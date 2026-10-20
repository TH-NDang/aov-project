package com.wikiaov.item.internal.web;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.wikiaov.media.*;
import com.wikiaov.patch.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
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

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@EnabledIf("databaseAvailable")
class WarehouseCatalogIntegrationTest {
    private static final String ROOT = "/api/wiki/v1/admin";
    private static final UUID RULESET = UUID.randomUUID();
    private static final UUID PATCH = UUID.randomUUID();
    private static final UUID VARIANT = UUID.randomUUID();
    private static PostgreSQLContainer database;

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
    JsonMapper json;
    @Autowired
    JdbcClient jdbc;
    @Autowired
    List<MediaUsageProvider> usageProviders;
    @MockitoBean
    MediaAssets media;
    @MockitoBean
    GameplayContexts contexts;
    private final Map<UUID, MediaSemanticType> iconTypes = new HashMap<>();

    @BeforeEach
    void setup() {
        for (String module : List.of("item", "arcana", "spell", "enchantment"))
            jdbc.sql("TRUNCATE " + module + "." + module + " CASCADE").update();
        jdbc.sql("TRUNCATE item.item_category CASCADE").update();
        jdbc.sql("TRUNCATE enchantment.enchantment_branch CASCADE").update();
        jdbc.sql(
                "INSERT INTO patch.gameplay_ruleset(id,code,description,created_at) VALUES(?,?,?,now()) ON CONFLICT DO NOTHING")
                .params(RULESET, "warehouse-tests", "Tests").update();
        jdbc.sql(
                "INSERT INTO patch.game_patch(id,code,created_at,created_by_issuer,created_by_subject) VALUES(?,?,now(),'test','editor') ON CONFLICT DO NOTHING")
                .params(PATCH, "warehouse-tests").update();
        jdbc.sql(
                "INSERT INTO patch.patch_variant(id,patch_id,ruleset_id,variant_code,ruleset_ordinal,status,published_at,created_at) VALUES(?,?,?,'standard',1,'PUBLISHED',now(),now()) ON CONFLICT DO NOTHING")
                .params(VARIANT, PATCH, RULESET).update();
        when(contexts.variant(VARIANT)).thenReturn(new PatchVariantReference(VARIANT, PATCH, RULESET, null, 1, true));
        when(contexts.active(any())).thenReturn(List.of());
        when(media.find(any(UUID.class))).thenAnswer(call -> {
            UUID id = call.getArgument(0);
            var type = iconTypes.get(id);
            return type == null
                    ? Optional.empty()
                    : Optional.of(new MediaAssetReference(id, type,
                            MediaAssetState.ACTIVE,
                            new MediaAssetReference.CurrentVersion(UUID.randomUUID(), "image/png", 64, 64,
                                    "/media/" + id + ".png")));
        });
    }

    @Test
    void allCatalogsPersistIncompleteDraftsAndRejectMissingPermissionsStaleVersionsAndWrongMedia() throws Exception {
        for (String path : List.of("items", "arcana", "spells", "enchantments")) {
            var created = create(path, "entry-" + path, null);
            assertThat(created.get("missingFields")).as(path).isInstanceOf(List.class);
            assertThat(((List<?>) created.get("missingFields")).contains("iconAssetId")).isTrue();
            var revision = map(created.get("revision"));
            var content = new HashMap<>(map(created.get("content")));
            content.put("notes", "Reviewed source");
            String draft = draftPath(path, created);
            send(put(draft), Map.of("expectedVersion", 99, "content", content), 409);
            var updated = send(put(draft), Map.of("expectedVersion", revision.get("version"), "content", content), 200);
            assertThat(number(map(updated.get("revision")), "version")).isEqualTo(2);
            send(post(draft + "/publish"), Map.of("expectedVersion", 2), 422);
            content.put("iconAssetId", icon(MediaSemanticType.HERO_HEAD));
            send(put(draft), Map.of("expectedVersion", 2, "content", content), 422);
            mvc.perform(put(draft).with(jwt().authorities(new SimpleGrantedAuthority("catalog:read")))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(Map.of("expectedVersion", 2, "content", content))))
                    .andExpect(status().isForbidden());
            send(post(draft + "/discard"), Map.of("expectedVersion", 2), 200);
            send(put(draft), Map.of("expectedVersion", 3, "content", content), 409);
        }
    }

    @Test
    void itemRecipesUseStableIdentitiesAndRejectSelfReferencesCyclesAndUnverifiedComponents() throws Exception {
        category();
        var first = create("items", "short-sword", itemContent(null));
        var second = create("items", "long-sword", itemContent(first.get("id")));
        var invalid = itemContent(second.get("id"));
        send(put(draftPath("items", first)), Map.of("expectedVersion", 1, "content", invalid), 422);
        invalid.put("components", List.of(Map.of("itemId", first.get("id"), "quantity", 1)));
        send(put(draftPath("items", first)), Map.of("expectedVersion", 1, "content", invalid), 422);
        invalid.put("recipeStatus", "UNKNOWN");
        send(put(draftPath("items", second)), Map.of("expectedVersion", 1, "content", invalid), 422);
        var detail = send(get(ROOT + "/items/" + second.get("id")), null, 200);
        assertThat(map(detail.get("content")).get("components"))
                .isEqualTo(List.of(Map.of("itemId", first.get("id"), "quantity", 1)));
        var page = send(get(ROOT + "/items").param("q", "long-sword").param("size", "1"), null, 200);
        assertThat(number(page, "totalElements")).isEqualTo(1);
    }

    @Test
    void anUnplacedBaselineCanAcquireAReviewedObservationContextWithoutChangingItsContent() throws Exception {
        var created = send(post(ROOT + "/arcana"), Map.of("code", "unplaced", "rulesetId", RULESET,
                "initialLocale", "vi-VN", "name", "Ngọc chưa đặt mốc", "content", arcanaContent()), 201);
        var revision = map(created.get("revision"));
        assertThat(revision.get("effectiveFromPatchVariantId")).isNull();
        assertThat(((List<?>) created.get("missingFields")).contains("effectiveFromPatchVariantId")).isTrue();
        send(post(draftPath("arcana", created) + "/publish"), Map.of("expectedVersion", 1), 422);
        var placed = send(put(draftPath("arcana", created)), Map.of("expectedVersion", 1,
                "effectiveFromPatchVariantId", VARIANT, "content", created.get("content")), 200);
        assertThat(map(placed.get("revision"))).containsEntry("effectiveFromPatchVariantId", VARIANT.toString());
        assertThat(number(map(placed.get("revision")), "version")).isEqualTo(2);
        assertThat(placed.get("content")).isEqualTo(created.get("content"));
        send(post(draftPath("arcana", created) + "/publish"), Map.of("expectedVersion", 2), 200);
    }

    @Test
    void publicationIsImmutableAndTranslationForkKeepsOldSnapshotAndGameplay() throws Exception {
        var content = arcanaContent();
        var created = create("arcana", "red-attack", content);
        assertThat((List<?>) created.get("missingFields")).isEmpty();
        var published = send(post(draftPath("arcana", created) + "/publish"), Map.of("expectedVersion", 1), 200);
        assertThat(map(published.get("revision"))).containsEntry("state", "PUBLISHED");
        send(put(draftPath("arcana", created)), Map.of("expectedVersion", 2, "content", content), 409);
        UUID revision = UUID.fromString(map(created.get("revision")).get("id").toString());
        assertThatThrownBy(() -> jdbc.sql("UPDATE arcana.arcana_translation SET name='Changed' WHERE revision_id=?")
                .param(revision).update())
                .hasMessageContaining("immutable");
        assertThatThrownBy(
                () -> jdbc.sql("UPDATE arcana.arcana_revision SET gameplay='{}' WHERE id=?").param(revision).update())
                .hasMessageContaining("immutable");
        var fork = send(post(ROOT + "/arcana/" + created.get("id") + "/drafts"), Map.of("rulesetId", RULESET,
                "sourceRevisionId", revision, "cause", "TRANSLATION_UPDATE"), 201);
        var changedMechanics = new HashMap<>(content);
        changedMechanics.put("tier", 2);
        send(put(draftPath("arcana", fork)), Map.of("expectedVersion", 1, "content", changedMechanics), 422);
        content.put("translations",
                List.of(text("vi-VN", "Ngọc công", "Mô tả gốc"), text("en-US", "Attack", "Attack modifier")));
        send(put(draftPath("arcana", fork)), Map.of("expectedVersion", 1, "content", content), 200);
        var old = send(get(ROOT + "/arcana/" + created.get("id") + "/revisions/" + revision), null, 200);
        assertThat((List<?>) map(old.get("content")).get("translations")).hasSize(1);
        assertThat(map(old.get("content")).get("stats")).isEqualTo(content.get("stats"));
        Long count = jdbc
                .sql("SELECT jsonb_array_length(gameplay->'translations') FROM arcana.arcana_revision WHERE id=?")
                .param(revision).query(Long.class).single();
        assertThat(count).isZero();
    }

    @Test
    void spellStateTranslationsAndAllRelatedMediaAreRetainedSeparately() throws Exception {
        UUID main = icon(MediaSemanticType.SPELL_ICON), state = icon(MediaSemanticType.SPELL_ICON),
                extra = icon(MediaSemanticType.SPELL_ICON);
        var content = new HashMap<String, Object>();
        content.put("iconAssetId", main);
        content.put("cooldownSeconds", 10);
        content.put("unlockType", "ACCOUNT_CREATION");
        content.put("availability", "AVAILABLE");
        content.put("displayOrder", 0);
        content.put("chargeRechargeSeconds", 45);
        content.put("maxCharges", 2);
        content.put("defaultStateKey", "normal");
        content.put("states", List.of(Map.of("key", "normal", "iconAssetId", state, "translations",
                List.of(text("vi-VN", "Trừng trị thường", "")))));
        content.put("referenceImages", List.of(Map.of("assetId", extra, "notes", "Source variant")));
        content.put("translations", List.of(text("vi-VN", "Trừng trị", "Gây sát thương lên quái"),
                text("en-US", "Punish", "Damage to monsters")));
        var created = create("spells", "punish", content);
        var revision = map(created.get("revision"));
        var detail = send(get(ROOT + "/spells/" + created.get("id") + "/revisions/" + revision.get("id")), null, 200);
        var persisted = map(detail.get("content"));
        assertThat((List<?>) persisted.get("translations")).hasSize(2);
        assertThat((List<?>) map(((List<?>) persisted.get("states")).getFirst()).get("translations")).hasSize(1);
        var gameplay = jdbc.sql("SELECT gameplay::text FROM spell.spell_revision WHERE id=?")
                .param(UUID.fromString(revision.get("id").toString())).query(String.class).single();
        assertThat(gameplay).doesNotContain("Trừng trị", "Punish");
        for (UUID asset : List.of(main, state, extra)) {
            var usage = usageProviders.stream().flatMap(p -> p.findUsages(asset).stream())
                    .filter(u -> u.ownerDomain().equals("SPELL")).toList();
            assertThat(usage).hasSize(1);
            assertThat(usage.getFirst().scope()).isEqualTo(MediaUsageScope.DRAFT);
        }
    }

    @Test
    void branchesKeepTranslatedSuitabilityAndExpectedVersionsAndUnknownQueryParametersAreRejected() throws Exception {
        UUID icon = icon(MediaSemanticType.ENCHANTMENT_ICON), background = icon(MediaSemanticType.OTHER);
        var body = Map.of("expectedVersion", 0, "displayOrder", 0, "color", "#e8b34c", "iconAssetId", icon,
                "backgroundAssetId", background, "translations", List.of(Map.of("locale", "vi-VN", "name",
                        "Tháp quang minh", "description", "Nhánh ánh sáng", "suitability", "Xạ thủ, pháp sư")));
        var created = send(put(ROOT + "/enchantment-branches/light"), body, 200);
        assertThat(number(created, "version")).isEqualTo(1);
        send(put(ROOT + "/enchantment-branches/light"), body, 409);
        var enchantment = create("enchantments", "contrast",
                Map.of("iconAssetId", icon(MediaSemanticType.ENCHANTMENT_ICON),
                        "branchCode", "light", "tier", 1, "position", 0, "translations",
                        List.of(text("vi-VN", "Tương phản", "Tăng sát thương"))));
        assertThat((List<?>) enchantment.get("missingFields")).isEmpty();
        send(get(ROOT + "/enchantments").param("arbitrary", "x"), null, 400);
        send(get(ROOT + "/enchantments").param("size", "101"), null, 400);
        assertThat(usageProviders.stream().flatMap(p -> p.findUsages(background).stream())
                .filter(u -> u.ownerType().equals("ENCHANTMENT_METADATA"))).hasSize(1);
    }

    private Map<String, Object> arcanaContent() {
        var content = new HashMap<String, Object>();
        content.put("iconAssetId", icon(MediaSemanticType.ARCANA_ICON));
        content.put("color", "RED");
        content.put("tier", 3);
        content.put("stats", List.of(Map.of("key", "physical-attack", "value", 3, "unit", "points")));
        content.put("translations", List.of(text("vi-VN", "Ngọc công", "Mô tả gốc")));
        return content;
    }

    @Test
    void archivedSpellsPublishWithoutInventingAPatchAndLaterRecordEvidenceWithoutChangingTheSnapshot()
            throws Exception {
        var content = new HashMap<String, Object>();
        UUID artwork = icon(MediaSemanticType.SPELL_ICON);
        content.put("iconAssetId", artwork);
        content.put("cooldownSeconds", 90);
        content.put("unlockType", "ACCOUNT_CREATION");
        content.put("availability", "REMOVED");
        content.put("legacy", true);
        content.put("translations", List.of(text("vi-VN", "Bất tử", "Thông tin lịch sử đã xác minh")));
        var created = send(post(ROOT + "/spells"), Map.of("code", "legacy-immunity", "rulesetId", RULESET,
                "initialLocale", "vi-VN", "name", "Bất tử", "content", content), 201);
        assertThat((List<?>) created.get("missingFields")).isEmpty();
        var published = send(post(draftPath("spells", created) + "/publish"), Map.of("expectedVersion", 1), 200);
        var publishedRevision = map(send(get(ROOT + "/spells/" + created.get("id")), null, 200).get("revision"));
        assertThat(publishedRevision.get("effectiveFromPatchVariantId")).isNull();
        assertThat(publishedRevision.get("state")).isEqualTo("PUBLISHED");
        send(post(ROOT + "/spells/" + created.get("id") + "/drafts"), Map.of("rulesetId", RULESET,
                "sourceRevisionId", publishedRevision.get("id"), "cause", "GAME_PATCH", "effectiveFromPatchVariantId",
                VARIANT), 422);
        var gameplayContext = new GameplayContext(UUID.randomUUID(), "VN", RULESET,
                "warehouse-tests", PATCH, "warehouse-tests", VARIANT, 1, java.time.Instant.now());
        when(contexts.resolve(eq("VN"), any())).thenReturn(gameplayContext);
        when(contexts.active(any())).thenReturn(List.of(gameplayContext));
        assertThat(number(send(get("/api/wiki/v1/spells"), null, 200), "totalElements")).isZero();
        assertThat(number(send(get("/api/wiki/v1/spells/archived"), null, 200), "totalElements")).isEqualTo(1);
        send(get("/api/wiki/v1/spells/" + created.get("id")), null, 404);
        assertThat(usageProviders.stream().flatMap(p -> p.findUsages(artwork).stream())
                .filter(u -> u.ownerDomain().equals("SPELL")).findFirst().orElseThrow().scope())
                .isEqualTo(MediaUsageScope.HISTORICAL);
        String endpoint = ROOT + "/spells/" + created.get("id") + "/removals";
        var evidence = new HashMap<String, Object>();
        evidence.put("revisionId", publishedRevision.get("id"));
        evidence.put("patchVariantId", VARIANT);
        evidence.put("sourceUrl", "file:///untrusted");
        send(post(endpoint), evidence, 422);
        UUID another = UUID.randomUUID();
        when(contexts.variant(another))
                .thenReturn(new PatchVariantReference(another, PATCH, UUID.randomUUID(), null, 2, true));
        evidence.put("patchVariantId", another);
        evidence.put("sourceUrl", "https://example.com/patch-evidence");
        send(post(endpoint), evidence, 422);
        evidence.put("patchVariantId", VARIANT);
        evidence.put("notes", "Editorial note");
        mvc.perform(post(endpoint).with(jwt().authorities(new SimpleGrantedAuthority("spell:write")))
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(evidence)))
                .andExpect(status().isForbidden());
        var recorded = send(post(endpoint), evidence, 201);
        assertThat(recorded).containsEntry("patchVariantId", VARIANT.toString());
        send(post(endpoint), evidence, 409);
        var unchanged = send(get(ROOT + "/spells/" + created.get("id")), null, 200);
        assertThat(map(unchanged.get("revision"))).isEqualTo(publishedRevision);
        assertThat(unchanged.get("content")).isEqualTo(published.get("content"));
        String events = mvc.perform(get(ROOT + "/spell-removals").param("patchVariantId", VARIANT.toString())
                .with(jwt().authorities(new SimpleGrantedAuthority("catalog:read"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(events).contains("REMOVED", "patch-evidence").doesNotContain("Editorial note");
        assertThat(number(send(get("/api/wiki/v1/spells"), null, 200), "totalElements")).isZero();
    }

    @Test
    void onlyRemovedLegacySpellsCanPublishWithoutPatchAndAnIndependentDraftCanClearAWrongContext() throws Exception {
        var content = new HashMap<String, Object>();
        content.put("iconAssetId", icon(MediaSemanticType.SPELL_ICON));
        content.put("cooldownSeconds", 90);
        content.put("unlockType", "ACCOUNT_CREATION");
        content.put("availability", "AVAILABLE");
        content.put("legacy", true);
        content.put("translations", List.of(text("vi-VN", "Phụ trợ", "Mô tả")));
        var created = send(post(ROOT + "/spells"), Map.of("code", "available-unplaced", "rulesetId", RULESET,
                "initialLocale", "vi-VN", "name", "Phụ trợ", "content", content), 201);
        send(post(draftPath("spells", created) + "/publish"), Map.of("expectedVersion", 1), 422);
        content.put("availability", "REMOVED");
        var placed = create("spells", "legacy-placed", content);
        var cleared = send(put(draftPath("spells", placed)),
                Map.of("expectedVersion", 1, "content", content, "clearPatchContext", true), 200);
        assertThat(map(cleared.get("revision")).get("effectiveFromPatchVariantId")).isNull();
        send(post(draftPath("spells", placed) + "/publish"), Map.of("expectedVersion", 2), 200);
        UUID revision = UUID.fromString(map(placed.get("revision")).get("id").toString());
        assertThatThrownBy(
                () -> jdbc.sql("UPDATE spell.spell_revision SET effective_from_patch_variant_id=? WHERE id=?")
                        .params(VARIANT, revision).update())
                .hasMessageContaining("immutable");
        content.put("legacy", false);
        send(put(draftPath("spells", created)), Map.of("expectedVersion", 1, "content", content), 200);
        send(post(draftPath("spells", created) + "/publish"), Map.of("expectedVersion", 2), 422);
    }

    @Test
    void branchOrderingIsAtomicVersionedAndPreservesMetadataTranslations() throws Exception {
        var first = send(put(ROOT + "/enchantment-branches/first"), Map.of("expectedVersion", 0,
                "displayOrder", 0, "color", "#65b979", "translations", List.of(text("vi-VN", "First", "Source"))), 200);
        var second = send(put(ROOT + "/enchantment-branches/second"), Map.of("expectedVersion", 0,
                "displayOrder", 1, "translations", List.of(text("vi-VN", "Second", "Source"))), 200);
        var stale = Map.of("entries", List.of(Map.of("code", "second", "expectedVersion", 1),
                Map.of("code", "first", "expectedVersion", 99)));
        send(put(ROOT + "/enchantment-branches/order"), stale, 409);
        assertThat(jdbc.sql("SELECT display_order FROM enchantment.enchantment_branch WHERE code='second'")
                .query(Integer.class).single()).isEqualTo(1);
        send(put(ROOT + "/enchantment-branches/order"), Map.of("entries",
                List.of(Map.of("code", "second", "expectedVersion", 1))), 409);
        var body = Map.of("entries", List.of(Map.of("code", "second", "expectedVersion", 1),
                Map.of("code", "first", "expectedVersion", 1)));
        var ordered = reorder("/enchantment-branches/order", body);
        assertThat(ordered.stream().map(row -> row.get("code"))).containsExactly("second", "first");
        assertThat(ordered.get(1)).containsEntry("displayOrder", 1).containsEntry("version", 2)
                .containsEntry("color", first.get("color")).containsEntry("translations", first.get("translations"));
        assertThat(ordered.get(0).get("translations")).isEqualTo(second.get("translations"));
        mvc.perform(put(ROOT + "/enchantment-branches/order")
                .with(jwt().authorities(new SimpleGrantedAuthority("catalog:read")))
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                .andExpect(status().isForbidden());
    }

    @Test
    void tierOrderingValidatesAllDraftsBeforeWritingAndKeepsOtherTiersAndContentIntact() throws Exception {
        send(put(ROOT + "/enchantment-branches/forest"), Map.of("expectedVersion", 0, "displayOrder", 0,
                "translations", List.of(text("vi-VN", "Forest", "Source"))), 200);
        var content = new HashMap<String, Object>();
        content.put("branchCode", "forest");
        content.put("tier", 1);
        content.put("position", 0);
        content.put("iconAssetId", icon(MediaSemanticType.ENCHANTMENT_ICON));
        content.put("translations",
                List.of(text("vi-VN", "First", "Description"), text("en-US", "First", "Description")));
        content.put("notes", "Keep evidence");
        var first = create("enchantments", "first", content);
        content.put("position", 1);
        var second = create("enchantments", "second", content);
        content.put("tier", 2);
        var otherTier = create("enchantments", "other-tier", content);
        var otherTierBefore = send(get(ROOT + "/enchantments/" + otherTier.get("id")), null, 200);
        var body = new HashMap<String, Object>();
        body.put("rulesetId", RULESET);
        body.put("branchCode", "forest");
        body.put("tier", 1);
        body.put("entries", List.of(orderNode(second, 1), orderNode(first, 99)));
        send(put(ROOT + "/enchantments/order"), body, 409);
        var before = send(get(ROOT + "/enchantments/" + second.get("id")), null, 200);
        assertThat(map(before.get("content")).get("position")).isEqualTo(1);
        assertThat(map(before.get("revision")).get("version")).isEqualTo(1);
        body.put("entries", List.of(orderNode(second, 1), orderNode(otherTier, 1)));
        send(put(ROOT + "/enchantments/order"), body, 409);
        body.put("entries", List.of(orderNode(second, 1), orderNode(second, 1)));
        send(put(ROOT + "/enchantments/order"), body, 422);
        body.put("entries", List.of(orderNode(second, 1), orderNode(first, 1)));
        var ordered = reorder("/enchantments/order", body);
        assertThat(map(ordered.get(0).get("content")).get("position")).isEqualTo(0);
        assertThat(map(ordered.get(1).get("content")).get("position")).isEqualTo(1);
        assertThat(map(ordered.get(0).get("content"))).containsEntry("notes", "Keep evidence")
                .containsEntry("translations", map(second.get("content")).get("translations"))
                .containsEntry("iconAssetId", map(second.get("content")).get("iconAssetId"));
        assertThat(send(get(ROOT + "/enchantments/" + otherTier.get("id")), null, 200)).isEqualTo(otherTierBefore);
        send(post(draftPath("enchantments", first) + "/publish"), Map.of("expectedVersion", 2), 200);
        body.put("entries", List.of(orderNode(first, 3), orderNode(second, 2)));
        send(put(ROOT + "/enchantments/order"), body, 409);
        assertThat(map(send(get(ROOT + "/enchantments/" + second.get("id")), null, 200).get("content")))
                .containsEntry("position", 0);
        mvc.perform(
                put(ROOT + "/enchantments/order").with(jwt().authorities(new SimpleGrantedAuthority("catalog:read")))
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                .andExpect(status().isForbidden());
    }

    @Test
    void enchantmentScopeUsesRecordedHistoryBeforeSearchAndPaginationWithoutFutureSnapshotLeaks() throws Exception {
        UUID season3 = UUID.randomUUID(), season4 = UUID.randomUUID(), september = UUID.randomUUID(),
                october = UUID.randomUUID();
        UUID septemberPatch = UUID.randomUUID(), octoberPatch = UUID.randomUUID();
        jdbc.sql(
                "INSERT INTO patch.game_patch(id,code,created_at,created_by_issuer,created_by_subject) VALUES(?,?,now(),'test','editor'),(?,?,now(),'test','editor')")
                .params(septemberPatch, septemberPatch.toString(), octoberPatch, octoberPatch.toString()).update();
        jdbc.sql(
                "INSERT INTO patch.patch_variant(id,patch_id,ruleset_id,variant_code,ruleset_ordinal,status,published_at,created_at) VALUES(?,?,?,'september',2,'PUBLISHED',now(),now()),(?,?,?,'october',3,'PUBLISHED',now(),now())")
                .params(september, septemberPatch, RULESET, october, octoberPatch, RULESET).update();
        var s3 = new PatchVariantReference(VARIANT, PATCH, RULESET, season3, 1, true);
        var s4 = new PatchVariantReference(september, septemberPatch, RULESET, season4, 2, true);
        var later = new PatchVariantReference(october, octoberPatch, RULESET, season4, 3, true);
        when(contexts.variant(VARIANT)).thenReturn(s3);
        when(contexts.variant(september)).thenReturn(s4);
        when(contexts.variant(october)).thenReturn(later);
        when(contexts.catalogVariants(null)).thenReturn(List.of(s3, s4, later));
        when(contexts.catalogVariants(season3)).thenReturn(List.of(s3));
        when(contexts.catalogVariants(season4)).thenReturn(List.of(s4, later));
        send(put(ROOT + "/enchantment-branches/forest"), Map.of("expectedVersion", 0, "displayOrder", 0,
                "translations", List.of(text("vi-VN", "Forest", "Source"))), 200);
        var content = new HashMap<String, Object>();
        content.put("branchCode", "forest");
        content.put("tier", 2);
        content.put("position", 0);
        content.put("iconAssetId", icon(MediaSemanticType.ENCHANTMENT_ICON));
        content.put("translations", List.of(text("vi-VN", "Existing", "S3 description")));
        var existing = create("enchantments", "existing", content);
        var first = send(post(draftPath("enchantments", existing) + "/publish"), Map.of("expectedVersion", 1), 200);
        content.put("translations", List.of(text("vi-VN", "New addition", "S4 addition")));
        var addition = send(post(ROOT + "/enchantments"), Map.of("code", "new-addition", "rulesetId", RULESET,
                "initialLocale", "vi-VN", "name", "New addition", "content", content, "effectiveFromPatchVariantId",
                september), 201);
        send(post(draftPath("enchantments", addition) + "/publish"), Map.of("expectedVersion", 1), 200);
        var changed = send(post(ROOT + "/enchantments/" + existing.get("id") + "/drafts"), Map.of("rulesetId", RULESET,
                "sourceRevisionId", map(first.get("revision")).get("id"), "cause", "GAME_PATCH",
                "effectiveFromPatchVariantId", september), 201);
        content.put("translations", List.of(text("vi-VN", "Existing", "September description")));
        send(put(draftPath("enchantments", changed)), Map.of("expectedVersion", 1, "content", content), 200);
        var changedPublished = send(post(draftPath("enchantments", changed) + "/publish"), Map.of("expectedVersion", 2),
                200);
        var future = send(post(ROOT + "/enchantments/" + existing.get("id") + "/drafts"), Map.of("rulesetId", RULESET,
                "sourceRevisionId", map(changedPublished.get("revision")).get("id"), "cause", "GAME_PATCH",
                "effectiveFromPatchVariantId", october), 201);
        content.put("translations", List.of(text("vi-VN", "Existing", "October description")));
        send(put(draftPath("enchantments", future)), Map.of("expectedVersion", 1, "content", content), 200);
        send(post(draftPath("enchantments", future) + "/publish"), Map.of("expectedVersion", 2), 200);
        var s3Page = send(get(ROOT + "/enchantments").param("rulesetId", RULESET.toString()).param("seasonId",
                season3.toString()), null, 200);
        assertThat(number(s3Page, "totalElements")).isEqualTo(1);
        assertThat(s3Page.toString()).contains("S3 description").doesNotContain("October description", "S4 addition");
        var septemberPage = send(get(ROOT + "/enchantments").param("rulesetId", RULESET.toString())
                .param("seasonId", season4.toString()).param("patchVariantId", september.toString()).param("size", "1"),
                null, 200);
        assertThat(number(septemberPage, "totalElements")).isEqualTo(2);
        assertThat((List<?>) septemberPage.get("items")).hasSize(1);
        assertThat(septemberPage.toString()).contains("September description").doesNotContain("October description");
        var searched = send(
                get(ROOT + "/enchantments").param("patchVariantId", september.toString()).param("q", "new-addition"),
                null, 200);
        assertThat(number(searched, "totalElements")).isEqualTo(1);
        assertThat(searched.toString()).contains("S4 addition");
        assertThat(number(send(get(ROOT + "/enchantments").param("seasonId", season4.toString()), null, 200),
                "totalElements")).isEqualTo(2);
        assertThat(number(send(get(ROOT + "/enchantments").param("patchVariantId", october.toString()), null, 200),
                "totalElements")).isEqualTo(1);
        send(get(ROOT + "/enchantments").param("seasonId", season3.toString()).param("patchVariantId",
                september.toString()), null, 400);
        var inherited = send(get(ROOT + "/enchantments").param("patchVariantId", october.toString())
                .param("includeUnchanged", "true"), null, 200);
        assertThat(number(inherited, "totalElements")).isEqualTo(2);
        assertThat(inherited.toString()).contains("October description", "S4 addition");
        var earlierSnapshot = send(get(ROOT + "/enchantments").param("patchVariantId", VARIANT.toString())
                .param("includeUnchanged", "true"), null, 200);
        assertThat(number(earlierSnapshot, "totalElements")).isEqualTo(1);
        assertThat(earlierSnapshot.toString()).contains("S3 description").doesNotContain("S4 addition",
                "October description");
        var septemberSnapshot = send(get(ROOT + "/enchantments").param("patchVariantId", september.toString())
                .param("includeUnchanged", "true"), null, 200);
        assertThat(number(septemberSnapshot, "totalElements")).isEqualTo(2);
        assertThat(septemberSnapshot.toString()).doesNotContain("October description");
        String reviewPath = ROOT + "/patch-variants/" + VARIANT + "/data-review";
        assertThat(send(put(reviewPath), Map.of("state", "COMPLETE", "expectedVersion", 0), 200))
                .containsEntry("state", "COMPLETE").containsEntry("version", 1);
        send(put(reviewPath), Map.of("state", "COMPLETE", "expectedVersion", 0), 409);
        mvc.perform(put(reviewPath).with(jwt().authorities(new SimpleGrantedAuthority("catalog:read")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("state", "IN_PROGRESS", "expectedVersion", 1))))
                .andExpect(status().isForbidden());

        var correction = send(post(ROOT + "/enchantments/" + existing.get("id") + "/drafts"),
                Map.of("rulesetId", RULESET,
                        "sourceRevisionId", map(first.get("revision")).get("id"), "cause", "CONTENT_CORRECTION"),
                201);
        content.put("translations", List.of(text("vi-VN", "Existing", "Corrected S3 description")));
        send(put(draftPath("enchantments", correction)), Map.of("expectedVersion", 1, "content", content), 200);
        send(post(draftPath("enchantments", correction) + "/publish"), Map.of("expectedVersion", 2), 200);
        assertThat(send(get(ROOT + "/enchantments").param("seasonId", season3.toString()), null, 200).toString())
                .contains("Corrected S3 description").doesNotContain("October description");
        assertThat(jdbc.sql("SELECT state FROM patch.patch_data_review WHERE patch_variant_id=?")
                .param(VARIANT).query(String.class).single()).isEqualTo("COMPLETE");
        var newBaseline = create("arcana", "reopens-review", arcanaContent());
        send(post(draftPath("arcana", newBaseline) + "/publish"), Map.of("expectedVersion", 1), 200);
        assertThat(jdbc.sql("SELECT state FROM patch.patch_data_review WHERE patch_variant_id=?")
                .param(VARIANT).query(String.class).single()).isEqualTo("IN_PROGRESS");

        assertThat(send(get(ROOT + "/enchantments"), null, 200).toString()).contains("October description",
                "S4 addition");
    }

    @Test
    void confirmedChangesSeparateBaselineFromAdditionsValidateSourcesAndProtectHistory() throws Exception {
        var value = create("arcana", "observed", arcanaContent());
        var published = send(post(draftPath("arcana", value) + "/publish"), Map.of("expectedVersion", 1), 200);
        UUID revision = UUID.fromString((String) map(published.get("revision")).get("id"));
        String url = ROOT + "/catalog-changes?rulesetId=" + RULESET + "&domain=ARCANA&locale=en-US";
        var initial = json
                .readValue(mvc.perform(get(url).with(jwt().authorities(new SimpleGrantedAuthority("catalog:read"))))
                        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), List.class);
        assertThat(map(initial.getFirst())).containsEntry("confirmed", false).containsEntry("kinds",
                List.of("DATA_BASELINE"));
        var body = new HashMap<String, Object>();
        body.put("patchVariantId", VARIANT);
        body.put("toRevisionId", revision);
        body.put("kinds", List.of("ADDED"));
        body.put("translations",
                List.of(Map.of("locale", "vi-VN", "text", "Được bổ sung"), Map.of("locale", "en-US", "text", "Added")));
        body.put("sourceUrl", "https://example.com/verified");
        String path = ROOT + "/arcana/" + value.get("id") + "/changes";
        var invalid = new HashMap<>(body);
        invalid.put("sourceUrl", "javascript:invalid");
        send(post(path), invalid, 422);
        invalid = new HashMap<>(body);
        invalid.put("kinds", List.of("BUFF"));
        send(post(path), invalid, 422);
        mvc.perform(post(path).with(jwt().authorities(new SimpleGrantedAuthority("arcana:publish")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body))).andExpect(status().isForbidden());
        var fact = send(post(path), body, 201);
        send(post(path), body, 409);
        var rows = json
                .readValue(mvc.perform(get(url).with(jwt().authorities(new SimpleGrantedAuthority("catalog:read"))))
                        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), List.class);
        assertThat(rows).hasSize(1);
        assertThat(map(rows.getFirst())).containsEntry("summary", "Added").containsEntry("confirmed", true)
                .containsEntry("kinds", List.of("ADDED"));
        assertThatThrownBy(() -> jdbc
                .sql("UPDATE arcana.arcana_patch_change_set SET source_url='https://example.com/other' WHERE id=?")
                .param(UUID.fromString((String) fact.get("id"))).update()).hasMessageContaining("immutable");
        UUID removalPatch = UUID.randomUUID();
        UUID removalVariant = UUID.randomUUID();
        jdbc.sql(
                "INSERT INTO patch.game_patch(id,code,created_at,created_by_issuer,created_by_subject) VALUES(?,?,now(),'test','editor')")
                .params(removalPatch, "removal-" + removalPatch).update();
        jdbc.sql(
                "INSERT INTO patch.patch_variant(id,patch_id,ruleset_id,variant_code,ruleset_ordinal,status,published_at,created_at) VALUES(?,?,?,'standard',99,'PUBLISHED',now(),now())")
                .params(removalVariant, removalPatch, RULESET).update();
        var removedContext = new PatchVariantReference(removalVariant, removalPatch, RULESET, null, 99, true);
        when(contexts.variant(removalVariant)).thenReturn(removedContext);
        var baselineContext = contexts.variant(VARIANT);
        when(contexts.catalogVariants(null)).thenReturn(List.of(baselineContext, removedContext));
        var removal = new HashMap<>(body);
        removal.put("patchVariantId", removalVariant);
        removal.put("kinds", List.of("REMOVED"));
        send(post(path), removal, 201);
        var removalScope = send(get(ROOT + "/arcana").param("rulesetId", RULESET.toString())
                .param("patchVariantId", removalVariant.toString()), null, 200);
        assertThat(number(removalScope, "totalElements")).isEqualTo(1);
        when(contexts.resolve(eq("VN"), any())).thenReturn(new GameplayContext(UUID.randomUUID(), "VN", RULESET,
                "warehouse-tests", removalPatch, "removal", removalVariant, 99, java.time.Instant.now()));
        var publicRemoved = send(get("/api/wiki/v1/arcana"), null, 200);
        assertThat(number(publicRemoved, "totalElements")).isZero();
        when(contexts.resolve(eq("VN"), any())).thenReturn(new GameplayContext(UUID.randomUUID(), "VN", RULESET,
                "warehouse-tests", PATCH, "baseline", VARIANT, 1, java.time.Instant.now()));
        assertThat(number(send(get("/api/wiki/v1/arcana"), null, 200), "totalElements")).isEqualTo(1);
        send(get(ROOT + "/arcana").param("rulesetId", RULESET.toString()).param("patchVariantId", VARIANT.toString()),
                null, 200);
    }

    private Map<String, Object> orderNode(Map<String, Object> entry, long version) {
        return Map.of("id", entry.get("id"), "revisionId", map(entry.get("revision")).get("id"), "expectedVersion",
                version);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> reorder(String path, Object body) throws Exception {
        String response = mvc.perform(put(ROOT + path)
                .with(jwt().jwt(token -> token.issuer("https://test.example/issuer").subject("editor"))
                        .authorities(new SimpleGrantedAuthority("catalog:read"),
                                new SimpleGrantedAuthority("enchantment:write")))
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readValue(response, List.class);
    }

    private Map<String, Object> itemContent(Object component) {
        var content = new HashMap<String, Object>();
        content.put("iconAssetId", icon(MediaSemanticType.ITEM_ICON));
        content.put("tier", component == null ? 1 : 2);
        content.put("price", component == null ? 250 : 910);
        content.put("categoryCode", "attack");
        content.put("shopPositions",
                List.of(Map.of("categoryCode", "attack", "row", 0, "column", component == null ? 0 : 1)));
        content.put("recipeStatus", component == null ? "NONE" : "VERIFIED");
        content.put("components", component == null ? List.of() : List.of(Map.of("itemId", component, "quantity", 1)));
        content.put("translations", List.of(text("vi-VN", "Kiếm", "Tăng công vật lý")));
        return content;
    }

    private void category() throws Exception {
        send(put(ROOT + "/item-categories/attack"), Map.of("expectedVersion", 0, "displayOrder", 0,
                "translations", List.of(Map.of("locale", "vi-VN", "name", "Công"))), 200);
    }

    private Map<String, Object> create(String path, String code, Map<String, Object> content) throws Exception {
        var body = new HashMap<String, Object>();
        body.put("code", code);
        body.put("rulesetId", RULESET);
        body.put("effectiveFromPatchVariantId", VARIANT);
        body.put("initialLocale", "vi-VN");
        body.put("name", "Mục thử nghiệm");
        if (content != null)
            body.put("content", content);
        return send(post(ROOT + "/" + path), body, 201);
    }

    private UUID icon(MediaSemanticType type) {
        UUID id = UUID.randomUUID();
        iconTypes.put(id, type);
        return id;
    }
    private static String draftPath(String path, Map<String, Object> entry) {
        return ROOT + "/" + path + "/" + entry.get("id") + "/drafts/" + map(entry.get("revision")).get("id");
    }
    private static Map<String, Object> text(String locale, String name, String description) {
        return Map.of("locale", locale, "name", name, "description", description);
    }

    private Map<String, Object> send(MockHttpServletRequestBuilder request, Object body, int expected)
            throws Exception {
        var grants = List.of("catalog:read", "item:write", "item:publish", "arcana:write", "arcana:publish",
                "spell:write", "spell:publish", "enchantment:write", "enchantment:publish", "patch:write");
        request.with(jwt().jwt(token -> token.issuer("https://test.example/issuer").subject("editor"))
                .authorities(grants.stream().map(SimpleGrantedAuthority::new).toArray(SimpleGrantedAuthority[]::new)));
        if (body != null)
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        String response = mvc.perform(request).andExpect(status().is(expected)).andReturn().getResponse()
                .getContentAsString();
        return response.isEmpty() ? Map.of() : json.readValue(response, Map.class);
    }
    private static long number(Map<String, Object> row, String key) {
        return ((Number) row.get(key)).longValue();
    }
    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object value) {
        return (Map<String, Object>) value;
    }
}
