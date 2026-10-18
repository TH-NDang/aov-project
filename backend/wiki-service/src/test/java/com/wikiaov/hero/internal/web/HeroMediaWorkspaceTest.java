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
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.*;
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
@Import(HeroMediaWorkspaceTest.Beans.class)
@EnabledIf("databaseAvailable")
class HeroMediaWorkspaceTest {
    private static final String ROOT = "/api/wiki/v1";
    private static final UUID VN = UUID.fromString("5d5dcd5e-15b9-4d43-884d-111111111111");
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

    @TestConfiguration
    static class Beans {
        @Bean
        @Primary
        MutableClock mediaWorkspaceClock() {
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
    MutableClock clock;
    @Autowired
    List<MediaUsageProvider> usageProviders;
    @MockitoBean
    MediaAssets media;

    private UUID ruleset;
    private UUID variant;
    private UUID release;
    private final Map<UUID, MediaAssetReference> references = new HashMap<>();
    private final Map<MediaSemanticType, UUID> assets = new EnumMap<>(MediaSemanticType.class);

    @BeforeEach
    void setup() throws Exception {
        clock.set(Instant.parse("2026-10-15T00:00:00Z"));
        jdbc.sql("TRUNCATE hero.import_job").update();
        jdbc.sql("TRUNCATE hero.hero CASCADE").update();
        jdbc.sql("TRUNCATE hero.hero_source_reference").update();
        jdbc.sql("TRUNCATE hero.skin_badge CASCADE").update();
        jdbc.sql("TRUNCATE patch.game_patch,patch.gameplay_ruleset,patch.ranked_season CASCADE").update();
        references.clear();
        assets.clear();
        when(media.find(any(UUID.class)))
                .thenAnswer(invocation -> Optional.ofNullable(references.get(invocation.getArgument(0))));
        for (var type : MediaSemanticType.values())
            assets.put(type, asset(type));
        ruleset = id(send(post(ROOT + "/admin/rulesets"),
                Map.of("code", "media-ruleset", "description", "Media workspace fixture"), 201));
        send(post(ROOT + "/admin/regions/" + VN + "/ruleset-assignments"),
                Map.of("rulesetId", ruleset, "validFrom", "2026-01-01T00:00:00Z"), 201);
        UUID patch = id(send(post(ROOT + "/admin/patches"), Map.of("code", "media-patch", "translations",
                List.of(Map.of("locale", "vi-VN", "title", "Media patch", "summary", "Media fixture"))), 201));
        variant = id(send(post(ROOT + "/admin/patches/" + patch + "/variants"),
                Map.of("rulesetId", ruleset, "variantCode", "MEDIA", "rulesetOrdinal", 1), 201));
        send(post(ROOT + "/admin/patch-variants/" + variant + "/publish"), null, 204);
        release = id(send(post(ROOT + "/admin/patch-variants/" + variant + "/releases"),
                Map.of("regionId", VN, "effectiveAt", "2026-01-02T00:00:00Z"), 201));
        var season = send(post(ROOT + "/admin/seasons"), Map.of("code", "media-season", "displayName", "Media season"),
                201);
        send(post(ROOT + "/admin/seasons/" + season.get("id") + "/schedules"), Map.of("regionId", VN,
                "startsAt", "2026-01-01T00:00:00Z", "endsAt", "2027-01-01T00:00:00Z"), 201);
    }

    @Test
    void mainSwitchRetainsHeroAndSkinAlternatesAndUsesOptimisticDraftVersion() throws Exception {
        var draft = create("airi", "Airi");
        UUID alternate = asset(MediaSemanticType.HERO_HEAD);
        var options = List.of(image(assets.get(MediaSemanticType.HERO_HEAD), "Original"),
                image(alternate, "Alternate"));
        draft = update(draft, "media-bindings",
                Map.of("bindings", Map.of("HEAD", assets.get(MediaSemanticType.HERO_HEAD)),
                        "images", Map.of("HEAD", options)));
        long staleVersion = number(draft, "version");
        draft = update(draft, "media-bindings", Map.of("bindings", Map.of("HEAD", alternate)));
        send(put(path(draft) + "/media-bindings"), Map.of("expectedDraftVersion", staleVersion,
                "bindings", Map.of("HEAD", alternate), "images", Map.of("HEAD", options)), 409);

        UUID skinHead = asset(MediaSemanticType.HERO_SKIN_ART);
        UUID skinPortrait = asset(MediaSemanticType.HERO_SKIN_ART);
        UUID skinAlternative = asset(MediaSemanticType.HERO_SKIN_ART);
        var skin = skin("celestial", "Celestial Airi");
        skin.put("headAssetId", skinHead);
        skin.put("portraitAssetId", skinPortrait);
        skin.put("artAssetId", assets.get(MediaSemanticType.HERO_SKIN_ART));
        skin.put("images",
                Map.of("HEAD", List.of(image(skinHead, "Main head"), image(skinAlternative, "Alternate head"))));
        draft = update(draft, "skins", Map.of("skins", List.of(skin)));
        var content = map(send(get(revisionPath(draft)), null, 200).get("content"));
        var bindings = map(content.get("mediaBindings"));
        assertThat(map(bindings.get("bindings"))).containsEntry("HEAD", alternate.toString());
        assertThat(rows(map(bindings.get("images")).get("HEAD"))).extracting(row -> row.get("assetId"))
                .containsExactly(assets.get(MediaSemanticType.HERO_HEAD).toString(), alternate.toString());
        assertThat(rows(map(bindings.get("images")).get("HEAD"))).extracting(row -> row.get("label"))
                .containsExactly("Original", "Alternate");
        var storedSkin = rows(map(content.get("skins")).get("skins")).getFirst();
        assertThat(storedSkin).containsEntry("headAssetId", skinHead.toString())
                .containsEntry("portraitAssetId", skinPortrait.toString())
                .containsEntry("artAssetId", assets.get(MediaSemanticType.HERO_SKIN_ART).toString());
        assertThat(rows(map(storedSkin.get("images")).get("HEAD"))).hasSize(2);
        skin.remove("images");
        skin.put("headAssetId", skinAlternative);
        draft = update(draft, "skins", Map.of("skins", List.of(skin)));
        var switchedContent = map(send(get(revisionPath(draft)), null, 200).get("content"));
        var switchedSkin = rows(map(switchedContent.get("skins")).get("skins")).getFirst();
        assertThat(switchedSkin).containsEntry("headAssetId", skinAlternative.toString());
        assertThat(rows(map(switchedSkin.get("images")).get("HEAD"))).extracting(row -> row.get("assetId"))
                .containsExactly(skinHead.toString(), skinAlternative.toString());
        UUID heroId = uuid(draft, "heroId");
        for (UUID candidate : List.of(assets.get(MediaSemanticType.HERO_HEAD), alternate, skinHead, skinPortrait,
                skinAlternative))
            assertThat(usages(candidate)).anyMatch(usage -> usage.ownerId().equals(heroId)
                    && usage.scope() == MediaUsageScope.DRAFT);
    }

    @Test
    void publishedImageOptionsRemainImmutableWhileVisualDraftRetainsCollectedAlternates() throws Exception {
        var draft = complete(create("nakroth", "Nakroth"));
        UUID mainHead = assets.get(MediaSemanticType.HERO_HEAD);
        UUID alternateHead = asset(MediaSemanticType.HERO_HEAD);
        draft = update(draft, "media-bindings", Map.of("bindings", Map.of("HEAD", mainHead,
                "PORTRAIT", assets.get(MediaSemanticType.HERO_PORTRAIT), "SPLASH",
                assets.get(MediaSemanticType.HERO_SPLASH)),
                "images", Map.of("HEAD",
                        List.of(image(mainHead, "Published main"), image(alternateHead, "Published alternate")))));
        UUID skinHead = asset(MediaSemanticType.HERO_SKIN_ART);
        UUID skinAlternate = asset(MediaSemanticType.HERO_SKIN_ART);
        UUID skinPortrait = asset(MediaSemanticType.HERO_SKIN_ART);
        var skin = skin("celestial", "Celestial Nakroth");
        skin.put("headAssetId", skinHead);
        skin.put("portraitAssetId", skinPortrait);
        skin.put("artAssetId", assets.get(MediaSemanticType.HERO_SKIN_ART));
        skin.put("images",
                Map.of("HEAD",
                        List.of(image(skinHead, "Published skin main"),
                                image(skinAlternate, "Published skin alternate")),
                        "PORTRAIT", List.of(image(skinPortrait, "Published portrait"))));
        draft = update(draft, "skins", Map.of("skins", List.of(skin)));
        var published = publish(draft);
        var sourceContent = map(send(get(revisionPath(published)), null, 200).get("content"));
        UUID mediaSection = UUID.fromString((String) map(published.get("sections")).get("mediaBindings"));
        UUID skinSection = UUID.fromString((String) map(published.get("sections")).get("skins"));

        assertThatThrownBy(() -> jdbc.sql("""
                UPDATE hero.hero_image_option SET label='Tampered'
                WHERE media_binding_revision_id=? AND media_role='HEAD' AND image_order=0
                """)
                .param(mediaSection).update())
                .isInstanceOf(org.springframework.dao.DataAccessException.class)
                .hasStackTraceContaining("Published hero section content is immutable");
        assertThatThrownBy(() -> jdbc.sql("""
                UPDATE hero.skin_image_option SET label='Tampered'
                WHERE skin_set_revision_id=? AND skin_key='celestial' AND media_role='HEAD' AND image_order=0
                """)
                .param(skinSection).update())
                .isInstanceOf(org.springframework.dao.DataAccessException.class)
                .hasStackTraceContaining("Published hero section content is immutable");
        UUID forbiddenCandidate = asset(MediaSemanticType.HERO_SKIN_ART);
        assertThatThrownBy(() -> jdbc.sql("""
                INSERT INTO hero.skin_image_option(skin_set_revision_id,skin_key,media_role,image_order,asset_id,label)
                VALUES(?,'celestial','HEAD',2,?,'Forbidden candidate')
                """)
                .params(skinSection, forbiddenCandidate).update())
                .isInstanceOf(org.springframework.dao.DataAccessException.class)
                .hasStackTraceContaining("Published hero section content is immutable");
        assertThatThrownBy(() -> jdbc.sql("""
                UPDATE hero.hero_skin_snapshot SET head_asset_id=?
                WHERE skin_set_revision_id=? AND skin_key='celestial'
                """)
                .params(skinAlternate, skinSection).update())
                .isInstanceOf(org.springframework.dao.DataAccessException.class)
                .hasStackTraceContaining("Published hero section content is immutable");

        var visual = send(post(ROOT + "/admin/heroes/" + published.get("heroId") + "/drafts"),
                Map.of("rulesetId", ruleset, "sourceRevisionId", published.get("id"), "cause", "VISUAL_UPDATE"), 201);
        visual = update(visual, "media-bindings", Map.of("bindings", Map.of("HEAD", alternateHead,
                "PORTRAIT", assets.get(MediaSemanticType.HERO_PORTRAIT), "SPLASH",
                assets.get(MediaSemanticType.HERO_SPLASH))));
        skin.remove("images");
        skin.put("headAssetId", skinAlternate);
        visual = update(visual, "skins", Map.of("skins", List.of(skin)));
        assertThat(visual).containsEntry("state", "DRAFT").containsEntry("cause", "VISUAL_UPDATE")
                .containsEntry("effectiveFromPatchVariantId", published.get("effectiveFromPatchVariantId"));
        assertThat(map(visual.get("sections")).get("mediaBindings")).isNotEqualTo(mediaSection.toString());
        assertThat(map(visual.get("sections")).get("skins")).isNotEqualTo(skinSection.toString());
        assertThat(map(send(get(revisionPath(published)), null, 200).get("content"))).isEqualTo(sourceContent);
        var visualContent = map(send(get(revisionPath(visual)), null, 200).get("content"));
        var visualBindings = map(visualContent.get("mediaBindings"));
        assertThat(map(visualBindings.get("bindings"))).containsEntry("HEAD", alternateHead.toString());
        assertThat(rows(map(visualBindings.get("images")).get("HEAD"))).extracting(row -> row.get("assetId"))
                .containsExactly(mainHead.toString(), alternateHead.toString());
        var visualSkin = rows(map(visualContent.get("skins")).get("skins")).getFirst();
        assertThat(visualSkin).containsEntry("headAssetId", skinAlternate.toString());
        assertThat(rows(map(visualSkin.get("images")).get("HEAD"))).extracting(row -> row.get("assetId"))
                .containsExactly(skinHead.toString(), skinAlternate.toString());
    }

    @Test
    void mediaGalleryPagesHeroGroupsAndIncludesMissingMainAndSkinOptions() throws Exception {
        var draft = create("airi", "Airi");
        UUID alternate = asset(MediaSemanticType.HERO_HEAD);
        draft = update(draft, "media-bindings",
                Map.of("bindings", Map.of("HEAD", assets.get(MediaSemanticType.HERO_HEAD)),
                        "images", Map.of("HEAD", List.of(image(alternate, "Alternate"),
                                image(assets.get(MediaSemanticType.HERO_HEAD), "Main")))));
        var populated = skin("celestial", "Celestial Airi");
        populated.put("headAssetId", assets.get(MediaSemanticType.HERO_SKIN_ART));
        UUID skinAlternate = asset(MediaSemanticType.HERO_SKIN_ART);
        populated.put("images", Map.of("HEAD", List.of(image(skinAlternate, "Skin alternate"))));
        draft = update(draft, "skins", Map.of("skins", List.of(populated, skin("uncollected", "Uncollected skin"))));
        create("zill", "Zill");

        var result = gallery("HEAD", 0, 1);
        assertThat(number(result, "totalElements")).isEqualTo(2);
        assertThat(rows(result.get("items"))).hasSize(1);
        var hero = rows(result.get("items")).getFirst();
        assertThat(hero).containsEntry("heroId", uuid(draft, "heroId").toString()).containsEntry("code", "airi")
                .containsEntry("name", "Airi").containsEntry("actualLocale", "vi-VN");
        var entries = rows(hero.get("entries"));
        var base = entries.stream().filter(row -> "HERO".equals(row.get("ownerType"))).toList();
        assertThat(base).hasSize(2);
        assertThat(base.getFirst()).containsEntry("assetId", assets.get(MediaSemanticType.HERO_HEAD).toString())
                .containsEntry("main", true);
        assertThat(base.getLast()).containsEntry("assetId", alternate.toString()).containsEntry("main", false);
        var skinRows = entries.stream().filter(row -> "celestial".equals(row.get("skinKey"))).toList();
        assertThat(skinRows).hasSize(2);
        assertThat(skinRows.getFirst()).containsEntry("assetId", assets.get(MediaSemanticType.HERO_SKIN_ART).toString())
                .containsEntry("main", true);
        assertThat(entries).anySatisfy(row -> {
            assertThat(row).containsEntry("skinKey", "uncollected").containsEntry("main", true);
            assertThat(row.get("assetId")).isNull();
        });
        assertThat(rows(rows(gallery("PORTRAIT", 1, 1).get("items")).getFirst().get("entries"))).anySatisfy(row -> {
            assertThat(row).containsEntry("ownerType", "HERO").containsEntry("main", true);
            assertThat(row.get("assetId")).isNull();
        });
        var searched = send(get(ROOT + "/admin/hero-media").param("rulesetId", ruleset.toString()).param("role", "HEAD")
                .param("q", "celestial").param("locale", "en-US"), null, 200);
        assertThat(number(searched, "totalElements")).isEqualTo(1);
        assertThat(rows(searched.get("items")).getFirst()).containsEntry("actualLocale", "vi-VN");
    }

    @Test
    void gallerySelectsGameplayOrdinalBeforeLaterHistoricalRevisionNumber() throws Exception {
        var original = complete(create("nakroth", "Nakroth"));
        original = publish(original);
        UUID patch = id(send(post(ROOT + "/admin/patches"), Map.of("code", "media-next", "translations",
                List.of(Map.of("locale", "vi-VN", "title", "Next", "summary", "Next"))), 201));
        UUID laterVariant = id(send(post(ROOT + "/admin/patches/" + patch + "/variants"),
                Map.of("rulesetId", ruleset, "variantCode", "MEDIA-NEXT", "rulesetOrdinal", 2), 201));
        send(post(ROOT + "/admin/patch-variants/" + laterVariant + "/publish"), null, 204);
        var later = send(post(ROOT + "/admin/heroes/" + original.get("heroId") + "/drafts"),
                Map.of("rulesetId", ruleset, "sourceRevisionId", original.get("id"), "cause", "GAME_PATCH",
                        "effectiveFromPatchVariantId", laterVariant),
                201);
        UUID currentHead = asset(MediaSemanticType.HERO_HEAD);
        later = update(later, "media-bindings", Map.of("bindings", Map.of("HEAD", currentHead,
                "PORTRAIT", assets.get(MediaSemanticType.HERO_PORTRAIT), "SPLASH",
                assets.get(MediaSemanticType.HERO_SPLASH))));
        later = publish(later);
        var backfill = send(post(ROOT + "/admin/heroes/" + original.get("heroId") + "/drafts"),
                Map.of("rulesetId", ruleset, "sourceRevisionId", original.get("id"), "cause", "CONTENT_CORRECTION"),
                201);
        backfill = update(backfill, "media-bindings",
                Map.of("bindings", Map.of("HEAD", asset(MediaSemanticType.HERO_HEAD))));
        assertThat(number(backfill, "revisionNo")).isGreaterThan(number(later, "revisionNo"));
        var group = rows(gallery("HEAD", 0, 20).get("items")).getFirst();
        assertThat(map(group.get("revision"))).containsEntry("id", later.get("id"));
        assertThat(rows(group.get("entries")).getFirst()).containsEntry("assetId", currentHead.toString());
    }

    @Test
    void invalidCandidateSemanticsAndDuplicateOptionsAreRejectedWithoutMutatingDraft() throws Exception {
        var draft = create("airi", "Airi");
        send(put(path(draft) + "/media-bindings"), Map.of("expectedDraftVersion", 1, "bindings", Map.of(),
                "images", Map.of("HEAD", List.of(image(assets.get(MediaSemanticType.HERO_PORTRAIT), "Wrong role")))),
                422);
        UUID head = assets.get(MediaSemanticType.HERO_HEAD);
        send(put(path(draft) + "/media-bindings"), Map.of("expectedDraftVersion", 1, "bindings", Map.of(),
                "images", Map.of("HEAD", List.of(image(head, "First"), image(head, "Duplicate")))), 422);
        send(put(path(draft) + "/media-bindings"), Map.of("expectedDraftVersion", 1, "bindings", Map.of(),
                "images", Map.of("HEAD", List.of(image(head, "x".repeat(256))))), 422);
        send(put(path(draft) + "/media-bindings"), Map.of("expectedDraftVersion", 1, "bindings", Map.of(),
                "images", Map.of("HEAD", Collections.singletonList(null))), 422);
        var excessive = new ArrayList<Map<String, Object>>();
        for (int index = 0; index < 201; index++)
            excessive.add(image(asset(MediaSemanticType.HERO_HEAD), "Candidate " + index));
        send(put(path(draft) + "/media-bindings"), Map.of("expectedDraftVersion", 1, "bindings", Map.of(),
                "images", Map.of("HEAD", excessive)), 422);
        var invalidSkin = skin("bad-skin", "Bad skin");
        invalidSkin.put("portraitAssetId", assets.get(MediaSemanticType.HERO_PORTRAIT));
        send(put(path(draft) + "/skins"), Map.of("expectedDraftVersion", 1, "skins", List.of(invalidSkin)), 422);
        invalidSkin.remove("portraitAssetId");
        invalidSkin.put("images", Map.of("SPLASH", List.of(image(UUID.randomUUID(), "Missing asset"))));
        send(put(path(draft) + "/skins"), Map.of("expectedDraftVersion", 1, "skins", List.of(invalidSkin)), 422);
        assertThat(map(send(get(revisionPath(draft)), null, 200).get("revision"))).containsEntry("version", 1);
        draft = update(draft, "media-bindings",
                Map.of("bindings", Map.of(), "images", Map.of("HEAD", excessive.subList(0, 200))));
        send(put(path(draft) + "/media-bindings"), Map.of("expectedDraftVersion", draft.get("version"),
                "bindings", Map.of(), "images", Map.of("HEAD", List.of(image(head, "Retained overflow")))), 422);
        assertThat(map(send(get(revisionPath(draft)), null, 200).get("revision"))).containsEntry("version",
                draft.get("version"));
    }

    @Test
    void skinBadgeCatalogTracksSkinReferencesAndProtectsUpdatesAndIcons() throws Exception {
        String endpoint = ROOT + "/admin/skin-badges";
        UUID vietnameseIcon = assets.get(MediaSemanticType.valueOf("SKIN_BADGE"));
        UUID englishIcon = asset(MediaSemanticType.valueOf("SKIN_BADGE"));
        var translations = List.of(Map.of("locale", "vi-VN", "displayName", "Celestial", "iconAssetId", vietnameseIcon),
                Map.of("locale", "en-US", "displayName", "Celestial English", "iconAssetId", englishIcon),
                Map.of("locale", "th-TH", "displayName", "Celestial Thai"));
        var body = Map.of("code", "celestial", "kind", "RARITY", "translations", translations);
        mvc.perform(post(endpoint).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                .andExpect(status().isUnauthorized());
        mvc.perform(post(endpoint).with(jwt().authorities(new SimpleGrantedAuthority("catalog:read")))
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                .andExpect(status().isForbidden());
        var badge = send(post(endpoint), body, 201);
        send(post(endpoint), body, 409);
        UUID badgeId = id(badge);
        long version = number(badge, "version");
        var invalid = Map.of("expectedVersion", version, "kind", "EVENT", "translations",
                List.of(Map.of("locale", "vi-VN", "displayName", "Wrong icon", "iconAssetId",
                        assets.get(MediaSemanticType.HERO_HEAD))));
        send(put(endpoint + "/" + badgeId), invalid, 422);
        var updated = send(put(endpoint + "/" + badgeId), Map.of("expectedVersion", version, "kind", "EVENT",
                "translations", translations), 200);
        assertThat(updated).containsEntry("code", "celestial").containsEntry("kind", "EVENT");
        send(put(endpoint + "/" + badgeId), Map.of("expectedVersion", version,
                "kind", "UNKNOWN", "translations", List.of()), 409);
        var draft = create("airi", "Airi");
        var skin = skin("celestial-airi", "Celestial Airi");
        skin.put("rarityCode", "celestial");
        skin.put("artAssetId", assets.get(MediaSemanticType.HERO_SKIN_ART));
        draft = update(draft, "skins", Map.of("skins", List.of(skin)));
        var catalog = send(
                get(endpoint).param("rulesetId", ruleset.toString()).param("q", "Celestial").param("locale", "en-US"),
                null, 200);
        assertThat(rows(catalog.get("items"))).hasSize(1);
        assertThat(number(rows(catalog.get("items")).getFirst(), "skinCount")).isEqualTo(1);
        assertThat(rows(catalog.get("items")).getFirst()).containsEntry("displayName", "Celestial English")
                .containsEntry("iconAssetId", englishIcon.toString()).containsEntry("actualLocale", "en-US")
                .containsEntry("fallbackApplied", false);
        var thai = send(get(endpoint).param("locale", "th-TH"), null, 200);
        assertThat(rows(thai.get("items")).getFirst()).containsEntry("displayName", "Celestial Thai")
                .containsEntry("actualLocale", "th-TH").containsEntry("fallbackApplied", false);
        assertThat(rows(thai.get("items")).getFirst().get("iconAssetId")).isNull();
        var fallback = send(get(endpoint).param("locale", "fr-FR"), null, 200);
        assertThat(rows(fallback.get("items")).getFirst()).containsEntry("displayName", "Celestial")
                .containsEntry("iconAssetId", vietnameseIcon.toString()).containsEntry("actualLocale", "vi-VN")
                .containsEntry("fallbackApplied", true);
        var empty = send(post(endpoint), Map.of("code", "unclassified", "kind", "UNKNOWN", "translations", List.of()),
                201);
        assertThat(empty).containsEntry("displayName", "unclassified").containsEntry("fallbackApplied", true);
        assertThat(empty.get("actualLocale")).isNull();
        assertThat(empty.get("iconAssetId")).isNull();
        var related = send(get(endpoint + "/" + badgeId + "/skins").param("rulesetId", ruleset.toString())
                .param("locale", "en-US"), null, 200);
        var importedDraft = draft;
        assertThat(rows(related.get("items"))).singleElement().satisfies(row -> assertThat(row)
                .containsEntry("heroId", importedDraft.get("heroId")).containsEntry("heroCode", "airi")
                .containsEntry("heroName", "Airi").containsEntry("skinKey", "celestial-airi")
                .containsEntry("skinName", "Celestial Airi").containsEntry("revisionId", importedDraft.get("id")));
        assertThat(usages(vietnameseIcon)).anyMatch(usage -> usage.ownerId().equals(badgeId));
        assertThat(usages(englishIcon)).anyMatch(usage -> usage.ownerId().equals(badgeId));
    }

    @Test
    void mappedImportsPersistAllSkinImageRolesAndCandidateLabels() throws Exception {
        var skin = skin("celestial", "Celestial Airi");
        UUID head = asset(MediaSemanticType.HERO_SKIN_ART);
        UUID portrait = asset(MediaSemanticType.HERO_SKIN_ART);
        UUID alternate = asset(MediaSemanticType.HERO_SKIN_ART);
        skin.put("headAssetId", head);
        skin.put("portraitAssetId", portrait);
        skin.put("artAssetId", assets.get(MediaSemanticType.HERO_SKIN_ART));
        skin.put("images", Map.of("PORTRAIT", List.of(image(alternate, "Collection variant"))));
        var imported = send(post(ROOT + "/admin/heroes/import/apply"), Map.of("code", "airi", "rulesetId", ruleset,
                "releaseId", release, "mode", "BASELINE", "locale", "vi-VN", "policies", Map.of(),
                "values", Map.of("name", "Airi", "roles", List.of("ASSASSIN"), "skins", List.of(skin))), 200);
        var stored = rows(map(imported.get("after")).get("skins")).getFirst();
        assertThat(stored).containsEntry("headAssetId", head.toString()).containsEntry("portraitAssetId",
                portrait.toString());
        assertThat(rows(map(stored.get("images")).get("PORTRAIT"))).singleElement()
                .satisfies(row -> assertThat(row).containsEntry("assetId", alternate.toString()).containsEntry("label",
                        "Collection variant"));
    }

    @Test
    void repeatedSubsetImportsKeepRetainedCandidatesAndDoNotCreateChangesOrExtraDrafts() throws Exception {
        var source = complete(create("nakroth", "Nakroth"));
        UUID originalHead = assets.get(MediaSemanticType.HERO_HEAD);
        UUID nextHead = asset(MediaSemanticType.HERO_HEAD);
        source = update(source, "media-bindings", Map.of("bindings", Map.of("HEAD", originalHead,
                "PORTRAIT", assets.get(MediaSemanticType.HERO_PORTRAIT),
                "SPLASH", assets.get(MediaSemanticType.HERO_SPLASH)),
                "images", Map.of("HEAD", List.of(image(originalHead, "Original hero image")))));
        UUID originalSkinHead = asset(MediaSemanticType.HERO_SKIN_ART);
        UUID nextSkinHead = asset(MediaSemanticType.HERO_SKIN_ART);
        var skin = skin("celestial", "Celestial Nakroth");
        skin.put("artAssetId", assets.get(MediaSemanticType.HERO_SKIN_ART));
        skin.put("headAssetId", originalSkinHead);
        skin.put("images", Map.of("HEAD", List.of(image(originalSkinHead, "Original skin image"))));
        source = update(source, "skins", Map.of("skins", List.of(skin)));
        source = publish(source);

        skin.put("headAssetId", nextSkinHead);
        skin.put("images", Map.of("HEAD", List.of(image(nextSkinHead, "New skin image"))));
        var request = new HashMap<String, Object>();
        request.put("code", "nakroth");
        request.put("rulesetId", ruleset);
        request.put("releaseId", release);
        request.put("mode", "CORRECTION");
        request.put("locale", "vi-VN");
        request.put("expectedRevisionId", source.get("id"));
        request.put("expectedVersion", source.get("version"));
        request.put("policies", Map.of("head", "OVERWRITE", "images", "OVERWRITE", "skins", "OVERWRITE"));
        request.put("values", Map.of("head", nextHead,
                "images", Map.of("HEAD", List.of(image(nextHead, "New hero image"))), "skins", List.of(skin)));
        String endpoint = ROOT + "/admin/heroes/import";
        assertThat(send(post(endpoint + "/preview"), request, 200)).containsEntry("changed", true)
                .containsEntry("classification", "CHANGED");
        var applied = send(post(endpoint + "/apply"), request, 200);
        assertThat(applied).containsEntry("changed", false).containsEntry("classification", "UNCHANGED");
        var after = map(applied.get("after"));
        assertThat(after).containsEntry("head", nextHead.toString());
        assertThat(rows(map(after.get("images")).get("HEAD"))).extracting(row -> row.get("assetId"))
                .containsExactly(originalHead.toString(), nextHead.toString());
        var storedSkin = rows(after.get("skins")).getFirst();
        assertThat(storedSkin).containsEntry("headAssetId", nextSkinHead.toString());
        assertThat(rows(map(storedSkin.get("images")).get("HEAD"))).extracting(row -> row.get("assetId"))
                .containsExactly(originalSkinHead.toString(), nextSkinHead.toString());

        request.put("expectedRevisionId", applied.get("revisionId"));
        request.put("expectedVersion", applied.get("version"));
        for (String operation : List.of("preview", "apply", "apply")) {
            var unchanged = send(post(endpoint + "/" + operation), request, 200);
            assertThat(unchanged).containsEntry("changed", false).containsEntry("classification", "UNCHANGED")
                    .containsEntry("revisionId", applied.get("revisionId"))
                    .containsEntry("version", applied.get("version"));
            assertThat(unchanged.get("before")).isEqualTo(unchanged.get("after"));
        }
        var published = send(post(ROOT + "/admin/heroes/" + applied.get("heroId") + "/drafts/"
                + applied.get("revisionId") + "/publish"), Map.of("expectedVersion", applied.get("version")), 200);
        request.put("expectedRevisionId", published.get("id"));
        request.put("expectedVersion", published.get("version"));
        var publishedNoOp = send(post(endpoint + "/apply"), request, 200);
        assertThat(publishedNoOp).containsEntry("changed", false).containsEntry("classification", "UNCHANGED")
                .containsEntry("revisionId", published.get("id")).containsEntry("version", published.get("version"));
        var revisions = rows(send(get(ROOT + "/admin/heroes/" + applied.get("heroId")), null, 200).get("revisions"));
        assertThat(revisions).hasSize(2).noneMatch(revision -> "DRAFT".equals(revision.get("state")));
        var persisted = map(send(get(ROOT + "/admin/heroes/" + applied.get("heroId") + "/revisions/"
                + published.get("id")), null, 200).get("content"));
        assertThat(rows(map(map(persisted.get("mediaBindings")).get("images")).get("HEAD"))).hasSize(2);
        assertThat(rows(map(rows(map(persisted.get("skins")).get("skins")).getFirst().get("images")).get("HEAD")))
                .hasSize(2);
    }

    @Test
    void galleryRequiresCatalogReadAndValidatesScopeAndQueryParameters() throws Exception {
        String endpoint = ROOT + "/admin/hero-media";
        mvc.perform(get(endpoint).param("rulesetId", ruleset.toString()).param("role", "HEAD"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get(endpoint).param("rulesetId", ruleset.toString()).param("role", "HEAD")
                .with(jwt().authorities(new SimpleGrantedAuthority("hero:write"))))
                .andExpect(status().isForbidden());
        send(get(endpoint).param("rulesetId", UUID.randomUUID().toString()).param("role", "HEAD"), null, 422);
        send(get(endpoint).param("rulesetId", ruleset.toString()).param("role", "HEAD").param("unknown", "1"), null,
                400);
        send(get(endpoint).param("rulesetId", ruleset.toString()).param("role", "HEAD").param("size", "101"), null,
                422);
    }

    private UUID asset(MediaSemanticType type) {
        UUID id = UUID.randomUUID();
        references.put(id, new MediaAssetReference(id, type, MediaAssetState.ACTIVE,
                new MediaAssetReference.CurrentVersion(UUID.randomUUID(), "image/webp", 128, 128,
                        "/media/" + id + "/v1.webp")));
        return id;
    }

    private Map<String, Object> create(String code, String name) throws Exception {
        return send(post(ROOT + "/admin/heroes"), Map.of("code", code, "initialLocale", "vi-VN", "name", name,
                "rulesetId", ruleset, "releaseId", release), 201);
    }

    private Map<String, Object> complete(Map<String, Object> draft) throws Exception {
        draft = update(draft, "profile", Map.of("translations", List.of(Map.of("locale", "vi-VN", "name", "Nakroth")),
                "roles", List.of("ASSASSIN")));
        draft = update(draft, "overview-ratings", Map.of("scaleCode", "GAME_OVERVIEW_10", "survivability", 5,
                "attackDamage", 8, "skillEffects", 6, "difficulty", 8));
        draft = update(draft, "combat-stats",
                Map.of("values", List.of(Map.of("statKey", "HP", "baseValue", 3500, "unit", "POINT"))));
        draft = update(draft, "skills", Map.of("skills", List.of(Map.of("skillKey", "skill-1", "kind", "ACTIVE",
                "displayOrder", 0, "iconAssetId", assets.get(MediaSemanticType.HERO_SKILL_ICON), "translations",
                List.of(Map.of("locale", "vi-VN", "name", "Skill", "description", "Complete description")), "effects",
                List.of()))));
        draft = update(draft, "skins", Map.of("skins", List.of()));
        return update(draft, "media-bindings",
                Map.of("bindings", Map.of("HEAD", assets.get(MediaSemanticType.HERO_HEAD),
                        "PORTRAIT", assets.get(MediaSemanticType.HERO_PORTRAIT), "SPLASH",
                        assets.get(MediaSemanticType.HERO_SPLASH))));
    }

    private Map<String, Object> update(Map<String, Object> draft, String section, Map<String, Object> content)
            throws Exception {
        var body = new HashMap<>(content);
        body.put("expectedDraftVersion", draft.get("version"));
        return send(put(path(draft) + "/" + section), body, 200);
    }

    private Map<String, Object> publish(Map<String, Object> draft) throws Exception {
        return send(post(path(draft) + "/publish"), Map.of("expectedVersion", draft.get("version")), 200);
    }

    @Test
    void legacySkinKeysNormalizeBeforeRetainingImagesAndNeverCreateDuplicateIdentities() throws Exception {
        var draft = create("airi", "Airi");
        UUID first = asset(MediaSemanticType.HERO_SKIN_ART), second = asset(MediaSemanticType.HERO_SKIN_ART);
        var canonical = skin("airi-mac-dinh-1", "Mặc định");
        canonical.put("portraitAssetId", first);
        canonical.put("images", Map.of("PORTRAIT", List.of(image(first, "Original"))));
        draft = update(draft, "skins", Map.of("skins", List.of(canonical)));
        jdbc.sql("INSERT INTO hero.skin_key_alias(id,hero_id,legacy_key,skin_key) VALUES(?,?,?,?)")
                .params(UUID.randomUUID(), uuid(draft, "heroId"), "airi-heroskin-1", "airi-mac-dinh-1").update();
        var legacy = skin("airi-heroskin-1", "Mặc định");
        legacy.put("portraitAssetId", second);
        legacy.put("images", Map.of("PORTRAIT", List.of(image(second, "New"))));
        draft = update(draft, "skins", Map.of("skins", List.of(legacy)));
        var content = map(send(get(revisionPath(draft)), null, 200).get("content"));
        var saved = rows(map(content.get("skins")).get("skins"));
        assertThat(saved).hasSize(1);
        assertThat(saved.getFirst()).containsEntry("skinKey", "airi-mac-dinh-1");
        assertThat(rows(map(saved.getFirst().get("images")).get("PORTRAIT")))
                .extracting(row -> row.get("assetId")).containsExactly(first.toString(), second.toString());
        assertThat(jdbc.sql("SELECT count(*) FROM hero.hero_skin WHERE hero_id=?")
                .param(uuid(draft, "heroId")).query(Long.class).single()).isEqualTo(1);
    }

    private Map<String, Object> gallery(String role, int page, int size) throws Exception {
        return send(get(ROOT + "/admin/hero-media").param("rulesetId", ruleset.toString()).param("role", role)
                .param("page", Integer.toString(page)).param("size", Integer.toString(size)), null, 200);
    }

    private List<MediaUsage> usages(UUID assetId) {
        return usageProviders.stream().flatMap(provider -> provider.findUsages(assetId).stream()).toList();
    }

    private Map<String, Object> send(MockHttpServletRequestBuilder request, Object body, int expectedStatus)
            throws Exception {
        request.with(jwt().jwt(token -> token.issuer("https://test.example/issuer").subject("editor")).authorities(
                new SimpleGrantedAuthority("catalog:read"), new SimpleGrantedAuthority("hero:write"),
                new SimpleGrantedAuthority("hero:publish"), new SimpleGrantedAuthority("patch:write"),
                new SimpleGrantedAuthority("patch:publish"), new SimpleGrantedAuthority("region:admin")));
        if (body != null)
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        String response = mvc.perform(request).andExpect(status().is(expectedStatus)).andReturn().getResponse()
                .getContentAsString();
        return response.isEmpty() ? Map.of() : json.readValue(response, Map.class);
    }

    private static Map<String, Object> image(UUID assetId, String label) {
        return Map.of("assetId", assetId, "label", label);
    }

    private static Map<String, Object> skin(String key, String name) {
        return new HashMap<>(Map.of("skinKey", key, "displayOrder", "uncollected".equals(key) ? 1 : 0,
                "translations", List.of(Map.of("locale", "vi-VN", "name", name))));
    }

    private static String path(Map<String, Object> draft) {
        return ROOT + "/admin/heroes/" + draft.get("heroId") + "/drafts/" + draft.get("id");
    }

    private static String revisionPath(Map<String, Object> draft) {
        return ROOT + "/admin/heroes/" + draft.get("heroId") + "/revisions/" + draft.get("id");
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

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object value) {
        return (Map<String, Object>) value;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> rows(Object value) {
        return (List<Map<String, Object>>) value;
    }
}
