package com.wikiaov.media.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.endsWith;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.wikiaov.MutableClock;
import com.wikiaov.SeaweedFsTestConfiguration;
import com.wikiaov.TestcontainersConfiguration;
import com.wikiaov.access.Capabilities;
import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.media.MediaUsage;
import com.wikiaov.media.MediaUsageProvider;
import com.wikiaov.media.MediaUsageScope;
import com.wikiaov.media.TestImages;
import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.deletion.application.port.CompetitionMediaGuard;
import com.wikiaov.media.internal.deletion.application.port.MediaCachePurge;
import com.wikiaov.media.internal.query.application.port.CompetitionMediaReferences;
import com.wikiaov.media.internal.storage.application.port.ObjectStorage;
import com.wikiaov.platform.ApiException;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * The admin media API end to end: real PostgreSQL, real S3-compatible storage, real presigned uploads.
 * Requires Docker.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, SeaweedFsTestConfiguration.class,
        MediaAdminApiIntegrationTest.TestBeans.class})
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
class MediaAdminApiIntegrationTest {

    private static final String BASE = "/api/wiki/v1/admin/media";

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectStorage storage;

    @Autowired
    MediaAssets mediaAssets;

    @Autowired
    MutableClock clock;

    @Autowired
    StubUsages usages;

    @MockitoBean
    CompetitionMediaGuard competitionMedia;

    @MockitoBean
    MediaCachePurge mediaCache;

    @MockitoBean
    CompetitionMediaReferences competitionReferences;

    @Test
    void deletionRemovesAllVersionsAndResumesAfterCacheFailure() throws Exception {
        String assetId = createAsset("OTHER");
        String first = uploadVersion(assetId, TestImages.png(35, 35), "image/png");
        String second = uploadVersion(assetId, TestImages.png(45, 45), "image/png");
        String firstId = JsonPath.read(first, "$.versionId");
        String secondId = JsonPath.read(second, "$.versionId");
        String firstKey = "assets/" + assetId + "/" + firstId + ".png";
        String secondKey = "assets/" + assetId + "/" + secondId + ".png";
        long expected = assetVersion(assetId);
        var id = UUID.fromString(assetId);
        org.mockito.Mockito.doAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            return null;
        }).when(competitionMedia).retire(id);
        org.mockito.Mockito.doThrow(new ApiException(MediaErrorCode.MEDIA_CACHE_PURGE_FAILED, "Synthetic CDN failure"))
                .doNothing().when(mediaCache).purge(org.mockito.ArgumentMatchers.anyList());

        deleteAsset(assetId, expected).andExpect(status().isBadGateway());
        assertThat(storage.stat(firstKey)).isEmpty();
        assertThat(storage.stat(secondKey)).isEmpty();
        mvc.perform(get(BASE + "/assets/" + assetId + "/deletion").with(editor()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.state").value("ORIGIN_DELETED"))
                .andExpect(jsonPath("$.expectedVersion").value(expected))
                .andExpect(jsonPath("$.lastError").value("MEDIA_CACHE_PURGE_FAILED"));
        assertThat(mediaAssets.find(id).orElseThrow().usable()).isFalse();
        uploadRequest(assetId, "{\"contentType\":\"image/png\",\"sizeBytes\":100}")
                .andExpect(status().isConflict());

        deleteAsset(assetId, expected).andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("COMPLETE"))
                .andExpect(jsonPath("$.publicUrls").value(2))
                .andExpect(jsonPath("$.lastError").value(nullValue()));
        deleteAsset(assetId, expected).andExpect(status().isOk()).andExpect(jsonPath("$.state").value("COMPLETE"));
        org.mockito.Mockito.verify(mediaCache, org.mockito.Mockito.times(2)).purge(List.of(
                "/media/" + assetId + "/" + secondId + ".png", "/media/" + assetId + "/" + firstId + ".png"));
        mvc.perform(get(BASE + "/assets?semanticType=OTHER&size=100").with(reader()))
                .andExpect(jsonPath("$.items[*].id", org.hamcrest.Matchers.not(hasItem(assetId))));
    }

    @Test
    void deletionProtectsEveryUsageScopeAndOutstandingUploads() throws Exception {
        String assetId = createAsset("OTHER");
        UUID id = UUID.fromString(assetId);
        for (var scope : MediaUsageScope.values()) {
            usages.byAsset.put(id,
                    List.of(new MediaUsage("HERO", "HERO", UUID.randomUUID(), UUID.randomUUID(), "HEAD", scope)));
            deleteAsset(assetId, 0).andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("MEDIA_ASSET_IN_USE"));
        }
        usages.byAsset.remove(id);
        uploadRequest(assetId, "{\"contentType\":\"image/png\",\"sizeBytes\":100}").andExpect(status().isCreated());
        deleteAsset(assetId, assetVersion(assetId)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MEDIA_UPLOAD_IN_PROGRESS"));
        org.mockito.Mockito.verify(mediaCache, org.mockito.Mockito.never())
                .purge(org.mockito.ArgumentMatchers.anyList());
    }

    @Test
    void deletionRequiresWritePermissionFreshVersionAndSuccessfulExternalChecks() throws Exception {
        String assetId = createAsset("OTHER");
        mvc.perform(post(BASE + "/assets/" + assetId + "/delete").with(reader())
                .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":0,\"reason\":\"Unused\"}"))
                .andExpect(status().isForbidden());
        deleteAsset(assetId, 42).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MEDIA_ASSET_VERSION_CONFLICT"));
        org.mockito.Mockito.doThrow(new ApiException(MediaErrorCode.MEDIA_ASSET_IN_USE, "Competition reference"))
                .when(competitionMedia).requireUnused(UUID.fromString(assetId));
        deleteAsset(assetId, 0).andExpect(status().isConflict());
        mvc.perform(get(BASE + "/assets/" + assetId).with(reader()))
                .andExpect(jsonPath("$.state").value("ACTIVE"));
        mvc.perform(get(BASE + "/assets/" + assetId + "/deletion").with(editor()))
                .andExpect(status().isNotFound());
    }

    private long assetVersion(String assetId) throws Exception {
        String body = mvc.perform(get(BASE + "/assets/" + assetId).with(editor()))
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.version")).longValue();
    }

    private ResultActions deleteAsset(String assetId, long version) throws Exception {
        return mvc.perform(post(BASE + "/assets/" + assetId + "/delete").with(editor())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":" + version + ",\"reason\":\"Unused image cleanup\"}"));
    }

    @Test
    void uploadCreatesAndActivatesTheFirstVersion() throws Exception {
        String asset = mvc.perform(post(BASE + "/assets").with(editor()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"semanticType": "HERO_PORTRAIT",
                         "source": {"type": "OFFICIAL", "label": "Press kit", "url": "https://example.com/kit"}}
                        """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.state").value("ACTIVE"))
                .andExpect(jsonPath("$.version").value(0))
                .andExpect(jsonPath("$.currentVersionId").value(nullValue()))
                .andReturn().getResponse().getContentAsString();
        String assetId = JsonPath.read(asset, "$.id");

        byte[] png = TestImages.png(40, 30);
        String ticket = mvc.perform(post(BASE + "/assets/" + assetId + "/version-uploads").with(editor())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"fileName": "C:\\\\art\\\\portrait.png", "contentType": "image/png", "sizeBytes": %d}
                        """.formatted(png.length)))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("http://localhost" + BASE + "/uploads/")))
                .andExpect(jsonPath("$.method").value("PUT"))
                .andExpect(jsonPath("$.objectKey").value(startsWith("incoming/")))
                .andReturn().getResponse().getContentAsString();
        String uploadId = JsonPath.read(ticket, "$.uploadId");
        putBytes(ticket, png);

        String result = complete(uploadId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.versionNo").value(1))
                .andExpect(jsonPath("$.current").value(true))
                .andExpect(jsonPath("$.duplicate").value(false))
                .andExpect(jsonPath("$.mimeType").value("image/png"))
                .andExpect(jsonPath("$.width").value(40))
                .andExpect(jsonPath("$.height").value(30))
                .andExpect(jsonPath("$.sizeBytes").value(png.length))
                .andReturn().getResponse().getContentAsString();
        String versionId = JsonPath.read(result, "$.versionId");
        assertThat((String) JsonPath.read(result, "$.url")).isEqualTo("/media/" + assetId + "/" + versionId + ".png");

        // Completing again (e.g. after a lost response) returns the same version.
        complete(uploadId).andExpect(status().isOk()).andExpect(jsonPath("$.versionId").value(versionId));

        // Bytes now live under the immutable key with the verified type; the incoming copy is gone.
        assertThat(storage.stat("assets/" + assetId + "/" + versionId + ".png"))
                .hasValueSatisfying(object -> assertThat(object.contentType()).isEqualTo("image/png"));
        assertThat(storage.stat(JsonPath.read(ticket, "$.objectKey"))).isEmpty();

        mvc.perform(get(BASE + "/assets/" + assetId).with(reader()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentVersionId").value(versionId))
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.versions", hasSize(1)))
                .andExpect(jsonPath("$.versions[0].current").value(true))
                .andExpect(jsonPath("$.provenance[0].label").value("Press kit"));
        mvc.perform(get(BASE + "/uploads/" + uploadId).with(reader()))
                .andExpect(jsonPath("$.state").value("READY"))
                .andExpect(jsonPath("$.fileName").value("portrait.png"))
                .andExpect(jsonPath("$.versionId").value(versionId));

        MediaAssetReference reference = mediaAssets.find(UUID.fromString(assetId)).orElseThrow();
        assertThat(reference.usable()).isTrue();
        assertThat(reference.currentVersion().url()).endsWith(versionId + ".png");
    }

    @Test
    void laterVersionsWaitForAnExplicitActivation() throws Exception {
        String assetId = createAsset("HERO_SPLASH");
        uploadVersion(assetId, TestImages.png(20, 20), "image/png");
        String second = uploadVersion(assetId, TestImages.jpeg(40, 40), "image/jpeg");
        String secondId = JsonPath.read(second, "$.versionId");
        assertThat((Boolean) JsonPath.read(second, "$.current")).isFalse();
        assertThat((Integer) JsonPath.read(second, "$.versionNo")).isEqualTo(2);

        activate(assetId, secondId, 0)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MEDIA_ASSET_VERSION_CONFLICT"))
                .andExpect(jsonPath("$.context.currentVersion").value(2));
        activate(assetId, secondId, 2)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentVersionId").value(secondId))
                .andExpect(jsonPath("$.version").value(3));
        // Activating the current version again changes nothing.
        activate(assetId, secondId, 3).andExpect(status().isOk()).andExpect(jsonPath("$.version").value(3));
    }

    @Test
    void sameBytesReturnTheExistingVersion() throws Exception {
        String assetId = createAsset("HERO_SKILL_ICON");
        byte[] png = TestImages.png(16, 16);
        String first = uploadVersion(assetId, png, "image/png");
        String second = uploadVersion(assetId, png, "image/png");

        assertThat((Boolean) JsonPath.read(second, "$.duplicate")).isTrue();
        assertThat((String) JsonPath.read(second, "$.versionId")).isEqualTo(JsonPath.read(first, "$.versionId"));
        mvc.perform(get(BASE + "/assets/" + assetId).with(reader())).andExpect(jsonPath("$.versions", hasSize(1)));
    }

    @Test
    void completingBeforeTheBytesArriveKeepsTheUploadOpen() throws Exception {
        String assetId = createAsset("HERO_HEAD");
        byte[] png = TestImages.png(10, 10);
        String ticket = requestUpload(assetId, "image/png", png.length);
        String uploadId = JsonPath.read(ticket, "$.uploadId");

        complete(uploadId)
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("MEDIA_OBJECT_NOT_FOUND"));
        mvc.perform(get(BASE + "/uploads/" + uploadId).with(reader()))
                .andExpect(jsonPath("$.state").value("REQUESTED"));

        putBytes(ticket, png);
        complete(uploadId).andExpect(status().isOk());
    }

    @Test
    void invalidBytesRejectTheUploadForGood() throws Exception {
        String assetId = createAsset("HERO_HEAD");
        byte[] notAnImage = "hello world".getBytes(StandardCharsets.UTF_8);
        String ticket = requestUpload(assetId, "image/png", notAnImage.length);
        String uploadId = JsonPath.read(ticket, "$.uploadId");
        putBytes(ticket, notAnImage);

        complete(uploadId)
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("INVALID_MEDIA_OBJECT"))
                .andExpect(jsonPath("$.context.reason").value("UNSUPPORTED_FORMAT"));
        complete(uploadId)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MEDIA_UPLOAD_REJECTED"));
        mvc.perform(get(BASE + "/uploads/" + uploadId).with(reader()))
                .andExpect(jsonPath("$.state").value("REJECTED"))
                .andExpect(jsonPath("$.errorCode").value("UNSUPPORTED_FORMAT"));
    }

    @Test
    void declaredTypeAndSizeAreCheckedUpFront() throws Exception {
        String assetId = createAsset("OTHER");

        uploadRequest(assetId, """
                {"contentType": "image/gif", "sizeBytes": 100}
                """)
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("INVALID_MEDIA_OBJECT"))
                .andExpect(jsonPath("$.context.reason").value("UNSUPPORTED_FORMAT"))
                .andExpect(jsonPath("$.errors[0].path").value("contentType"));
        uploadRequest(assetId, """
                {"contentType": "image/webp", "sizeBytes": 26214401}
                """)
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.context.reason").value("TOO_LARGE"))
                .andExpect(jsonPath("$.context.maxBytes").value(26214400));
        uploadRequest(assetId, """
                {"sizeBytes": 100}
                """)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void expiredUploadsCannotBeCompleted() throws Exception {
        String assetId = createAsset("PATCH_ART");
        byte[] png = TestImages.png(12, 12);
        String ticket = requestUpload(assetId, "image/png", png.length);
        String uploadId = JsonPath.read(ticket, "$.uploadId");
        putBytes(ticket, png);

        clock.advance(Duration.ofHours(2));

        complete(uploadId)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MEDIA_UPLOAD_EXPIRED"));
        mvc.perform(get(BASE + "/uploads/" + uploadId).with(reader())).andExpect(jsonPath("$.state").value("EXPIRED"));
    }

    @Test
    void importsRegisterObjectsPlacedUnderImports() throws Exception {
        String assetId = createAsset("ITEM_ICON");
        byte[] webp = TestImages.webpLossless(128, 128);
        String key = "imports/items/" + assetId + ".webp";
        storage.put(key, new ByteArrayInputStream(webp), webp.length, "application/octet-stream");
        String body = """
                {"assetId": "%s", "objectKey": "%s", "source": {"type": "GAME_CLIENT", "label": "Client 1.62"}}
                """.formatted(assetId, key);

        String result = register(body)
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", endsWith(BASE + "/assets/" + assetId)))
                .andExpect(jsonPath("$.mimeType").value("image/webp"))
                .andExpect(jsonPath("$.width").value(128))
                .andExpect(jsonPath("$.current").value(true))
                .andReturn().getResponse().getContentAsString();
        register(body).andExpect(status().isOk()).andExpect(jsonPath("$.duplicate").value(true));

        String versionId = JsonPath.read(result, "$.versionId");
        assertThat(storage.stat("assets/" + assetId + "/" + versionId + ".webp"))
                .hasValueSatisfying(object -> assertThat(object.contentType()).isEqualTo("image/webp"));
        assertThat(storage.stat(key)).as("import source is kept").isPresent();

        register("""
                {"assetId": "%s", "objectKey": "assets/elsewhere.webp"}
                """.formatted(assetId))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].path").value("objectKey"))
                .andExpect(jsonPath("$.errors[0].code").value("NOT_ALLOWED"));
        register("""
                {"assetId": "%s", "objectKey": "imports/missing.webp"}
                """.formatted(assetId))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("MEDIA_OBJECT_NOT_FOUND"));
    }

    @Test
    void changesNeedMediaWrite() throws Exception {
        mvc.perform(post(BASE + "/assets").with(reader()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"semanticType\": \"OTHER\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        mvc.perform(get(BASE + "/assets").with(reader())).andExpect(status().isOk());
        mvc.perform(get(BASE + "/assets"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void listSaysWhereImagesAreUsedAndFiltersByTheStrongestUse() throws Exception {
        UUID hero = UUID.randomUUID();
        UUID shown = UUID.fromString(createAsset("OTHER"));
        UUID draftOnly = UUID.fromString(createAsset("OTHER"));
        UUID historyOnly = UUID.fromString(createAsset("OTHER"));
        UUID storedOnly = UUID.fromString(createAsset("OTHER"));
        UUID unused = UUID.fromString(createAsset("OTHER"));
        UUID competition = UUID.fromString(createAsset("OTHER"));
        var current = new MediaUsage("HERO", "HERO", hero, UUID.randomUUID(), "SKIN_ART:a", MediaUsageScope.CURRENT);
        var old = new MediaUsage("HERO", "HERO", hero, UUID.randomUUID(), "SKIN_ART:a", MediaUsageScope.HISTORICAL);
        var draft = new MediaUsage("HERO", "HERO", hero, UUID.randomUUID(), "SKIN_ART:a", MediaUsageScope.DRAFT);
        var option = new MediaUsage("HERO", "HERO", hero, UUID.randomUUID(), "SKIN_HEAD:b", MediaUsageScope.CURRENT)
                .storedOnly();
        usages.byAsset.put(shown, List.of(current, old, draft, option));
        usages.byAsset.put(draftOnly, List.of(draft));
        usages.byAsset.put(historyOnly, List.of(old));
        usages.byAsset.put(storedOnly, List.of(option));
        org.mockito.Mockito.when(competitionReferences.references())
                .thenReturn(java.util.Optional.of(Map.of(competition, 2L)));

        var rows = BASE + "/assets";
        mvc.perform(get(rows).param("withUsage", "true").param("size", "100").with(reader()))
                .andExpect(status().isOk())
                // The same place in three revisions counts once, as its strongest use.
                .andExpect(jsonPath(usageOf(shown) + ".state").value(hasItem("SHOWN")))
                .andExpect(jsonPath(usageOf(shown) + ".current").value(hasItem(1)))
                .andExpect(jsonPath(usageOf(shown) + ".draft").value(hasItem(0)))
                .andExpect(jsonPath(usageOf(shown) + ".historical").value(hasItem(0)))
                .andExpect(jsonPath(usageOf(shown) + ".stored").value(hasItem(1)))
                .andExpect(jsonPath(usageOf(draftOnly) + ".state").value(hasItem("DRAFT_ONLY")))
                .andExpect(jsonPath(usageOf(historyOnly) + ".state").value(hasItem("HISTORY_ONLY")))
                .andExpect(jsonPath(usageOf(storedOnly) + ".state").value(hasItem("STORED_ONLY")))
                .andExpect(jsonPath(usageOf(unused) + ".state").value(hasItem("NONE")))
                .andExpect(jsonPath(usageOf(competition) + ".state").value(hasItem("SHOWN")))
                .andExpect(jsonPath(usageOf(competition) + ".competition").value(hasItem(2)));
        mvc.perform(get(rows).param("size", "100").with(reader()))
                .andExpect(jsonPath("$.items[0].usage").value(nullValue()));

        for (var filter : Map.of("STORED_ONLY", storedOnly, "NONE", unused, "DRAFT_ONLY", draftOnly).entrySet()) {
            mvc.perform(get(rows).param("usage", filter.getKey()).param("size", "100").with(reader()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items[*].id").value(hasItem(filter.getValue().toString())))
                    .andExpect(jsonPath("$.items[*].usage.state").value(everyItem(is(filter.getKey()))));
        }
        mvc.perform(get(rows).param("usage", "EVERYWHERE").with(reader())).andExpect(status().isBadRequest());
        mvc.perform(get(BASE + "/usage-totals").param("arbitrary", "x").with(reader()))
                .andExpect(status().isBadRequest());
        mvc.perform(get(BASE + "/usage-totals").with(reader()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.competitionChecked").value(true))
                .andExpect(jsonPath("$.states.STORED_ONLY").isNumber())
                .andExpect(jsonPath("$.states.NONE").isNumber());

        org.mockito.Mockito.when(competitionReferences.references()).thenReturn(java.util.Optional.empty());
        mvc.perform(get(BASE + "/usage-totals").with(reader()))
                .andExpect(jsonPath("$.competitionChecked").value(false));
        mvc.perform(get(rows).param("withUsage", "true").param("size", "100").with(reader()))
                .andExpect(jsonPath(usageOf(competition) + ".state").value(hasItem("NONE")))
                .andExpect(jsonPath(usageOf(competition) + ".competition").value(hasItem(nullValue())));

        for (var id : List.of(shown, draftOnly, historyOnly, storedOnly))
            usages.byAsset.remove(id);
    }

    @Test
    void usageReportSaysWhetherAPlaceReallyShowsTheImage() throws Exception {
        String assetId = createAsset("HERO_SKIN_ART");
        var stored = new MediaUsage("HERO", "HERO", UUID.randomUUID(), UUID.randomUUID(), "SKIN_HEAD:a",
                MediaUsageScope.CURRENT).storedOnly().named("Airi", "Celestial Airi");
        usages.byAsset.put(UUID.fromString(assetId), List.of(stored));

        mvc.perform(get(BASE + "/assets/" + assetId + "/usages").with(reader()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].shown").value(false))
                .andExpect(jsonPath("$.items[0].ownerName").value("Airi"))
                .andExpect(jsonPath("$.items[0].partName").value("Celestial Airi"));

        usages.byAsset.remove(UUID.fromString(assetId));
    }

    private static String usageOf(UUID asset) {
        return "$.items[?(@.id=='" + asset + "')].usage";
    }

    @Test
    void deprecationIsRefusedWhileACurrentRevisionShowsTheAsset() throws Exception {
        String assetId = createAsset("HERO_HEAD");
        UUID id = UUID.fromString(assetId);
        MediaUsage current = new MediaUsage("HERO", "HERO", UUID.randomUUID(), UUID.randomUUID(), "HEAD",
                MediaUsageScope.CURRENT);
        MediaUsage historical = new MediaUsage("HERO", "HERO", UUID.randomUUID(), UUID.randomUUID(), "HEAD",
                MediaUsageScope.HISTORICAL);
        usages.byAsset.put(id, List.of(current, historical));

        mvc.perform(get(BASE + "/assets/" + assetId + "/usages").with(reader()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.counts.current").value(1))
                .andExpect(jsonPath("$.counts.historical").value(1))
                .andExpect(jsonPath("$.items", hasSize(2)));
        mvc.perform(get(BASE + "/assets/" + assetId + "/usages").param("scope", "CURRENT").with(reader()))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].propertyRole").value("HEAD"));

        deprecate(assetId, 0)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MEDIA_ASSET_IN_USE"))
                .andExpect(jsonPath("$.context.currentUsages").value(1));

        usages.byAsset.put(id, List.of(historical));
        deprecate(assetId, 0).andExpect(status().isOk()).andExpect(jsonPath("$.state").value("DEPRECATED"));
        uploadRequest(assetId, """
                {"contentType": "image/png", "sizeBytes": 100}
                """)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MEDIA_ASSET_NOT_ACTIVE"));
    }

    @Test
    void listFiltersBySemanticTypeAndValidatesTheQuery() throws Exception {
        String assetId = createAsset("HERO_SKIN_ART");

        mvc.perform(get(BASE + "/assets").param("semanticType", "HERO_SKIN_ART").param("size", "100").with(reader()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].id", hasItem(assetId)))
                .andExpect(jsonPath("$.items[*].semanticType", everyItem(is("HERO_SKIN_ART"))));
        mvc.perform(get(BASE + "/assets").param("sematicType", "HERO_SKIN_ART").with(reader()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_QUERY_PARAMETER"));
        mvc.perform(get(BASE + "/assets").param("size", "101").with(reader()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void missingCreditFilterUsesCurrentSourcesBeforePagingAndUpdatesAfterCorrection() throws Exception {
        String pendingId = createAsset("PATCH_ART");
        String missingId = createAsset("PATCH_ART");
        uploadVersion(missingId, TestImages.png(24, 24), "image/png");
        String otherId = createAsset("OTHER");
        uploadVersion(otherId, TestImages.png(25, 25), "image/png");
        String legacy = mvc.perform(post(BASE + "/assets").with(editor()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"semanticType":"PATCH_ART","source":{"type":"GAME_CLIENT","label":"Game capture","ownerName":"Garena"}}
                        """))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String creditedId = JsonPath.read(legacy, "$.id");
        String firstVersion = JsonPath.read(uploadVersion(creditedId, TestImages.png(26, 26), "image/png"),
                "$.versionId");
        String filter = BASE + "/assets?needsCredit=true&semanticType=PATCH_ART&size=100";

        String initial = mvc.perform(get(filter).with(reader())).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<String> initialIds = JsonPath.read(initial, "$.items[*].id");
        assertThat(initialIds).contains(missingId).doesNotContain(pendingId, creditedId, otherId);

        String firstSources = BASE + "/assets/" + creditedId + "/versions/" + firstVersion + "/sources";
        mvc.perform(post(firstSources).with(editor()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"label\":\"Original image\",\"url\":\"https://example.com/image.png\"}"))
                .andExpect(status().isOk());
        mvc.perform(get(filter).with(reader())).andExpect(jsonPath("$.items[*].id", hasItem(creditedId)));

        mvc.perform(post(firstSources).with(editor()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"type\":\"GAME_CLIENT\",\"label\":\"Verified game capture\",\"ownerName\":\"Garena\"}"))
                .andExpect(status().isOk());
        String corrected = mvc.perform(get(filter).with(reader())).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(JsonPath.<List<String>>read(corrected, "$.items[*].id")).doesNotContain(creditedId);

        String replacement = JsonPath.read(uploadVersion(creditedId, TestImages.png(27, 27), "image/png"),
                "$.versionId");
        String beforeActivation = mvc.perform(get(filter).with(reader())).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(JsonPath.<List<String>>read(beforeActivation, "$.items[*].id")).doesNotContain(creditedId);
        String details = mvc.perform(get(BASE + "/assets/" + creditedId).with(reader()))
                .andReturn().getResponse().getContentAsString();
        Number lockVersion = JsonPath.read(details, "$.version");
        activate(creditedId, replacement, lockVersion.longValue()).andExpect(status().isOk());

        String filtered = mvc.perform(get(filter).with(reader())).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].semanticType", everyItem(is("PATCH_ART"))))
                .andReturn().getResponse().getContentAsString();
        List<String> expectedIds = JsonPath.read(filtered, "$.items[*].id");
        assertThat(expectedIds).contains(missingId, creditedId).doesNotContain(pendingId, otherId);
        assertThat(JsonPath.<Number>read(filtered, "$.totalElements").intValue()).isEqualTo(expectedIds.size());
        for (int page = 0; page < expectedIds.size(); page++) {
            mvc.perform(get(BASE + "/assets").with(reader()).param("needsCredit", "true")
                    .param("semanticType", "PATCH_ART").param("page", String.valueOf(page)).param("size", "1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items[0].id").value(expectedIds.get(page)))
                    .andExpect(jsonPath("$.totalElements").value(expectedIds.size()));
        }
        mvc.perform(get(BASE + "/assets?needsCredit=true&size=100").with(reader()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[*].id", hasItem(otherId)));
        mvc.perform(get(BASE + "/assets?needsCredit=invalid").with(reader())).andExpect(status().isBadRequest());

        String avatarId = createAsset("USER_AVATAR");
        uploadVersion(avatarId, TestImages.png(23, 23), "image/png");
        mvc.perform(get(BASE + "/assets?needsCredit=true&semanticType=USER_AVATAR&size=100").with(reader()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get(BASE + "/assets?semanticType=USER_AVATAR&size=100").with(reader()))
                .andExpect(jsonPath("$.items[*].id", hasItem(avatarId)));
    }

    @Test
    void unknownIdsAreNotFound() throws Exception {
        String assetId = createAsset("OTHER");

        mvc.perform(get(BASE + "/assets/" + UUID.randomUUID()).with(reader()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MEDIA_ASSET_NOT_FOUND"));
        complete(UUID.randomUUID().toString())
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MEDIA_UPLOAD_NOT_FOUND"));
        activate(assetId, UUID.randomUUID().toString(), 0)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MEDIA_VERSION_NOT_FOUND"));
    }

    @Test
    void severalAssetsAreReadTogetherInTheRequestedOrder() throws Exception {
        String empty = createAsset("OTHER");
        String image = createAsset("HERO_SKIN_ART");
        String versionId = JsonPath.read(uploadVersion(image, TestImages.png(30, 30), "image/png"), "$.versionId");
        addSource(image, versionId, "{\"label\":\"Garena\",\"ownerName\":\"Garena\"}").andExpect(status().isOk());
        String laterVersionId = JsonPath.read(uploadVersion(image, TestImages.png(40, 40), "image/png"), "$.versionId");
        String unknown = UUID.randomUUID().toString();

        String single = mvc.perform(get(BASE + "/assets/" + image).with(reader()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        mvc.perform(get(BASE + "/assets/batch").param("ids", String.join(",", image, unknown, empty, image))
                .with(reader()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].id").value(image))
                .andExpect(jsonPath("$.items[0].versions[0].id").value(laterVersionId))
                .andExpect(jsonPath("$.items[0].versions[1].id").value(versionId))
                .andExpect(jsonPath("$.items[0].provenance[*].ownerName", hasItem("Garena")))
                .andExpect(jsonPath("$.items[1].id").value(empty))
                .andExpect(jsonPath("$.items[1].versions", hasSize(0)))
                .andExpect(result -> assertThat(JsonPath.<Object>read(result.getResponse().getContentAsString(),
                        "$.items[0]")).isEqualTo(JsonPath.<Object>read(single, "$")));
        mvc.perform(get(BASE + "/assets/batch").param("ids", unknown).with(reader()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    void readingSeveralAssetsValidatesTheQuery() throws Exception {
        String id = UUID.randomUUID().toString();
        String tooMany = String.join(",", java.util.Collections.nCopies(101, id));

        for (String ids : List.of(tooMany, "", "not-a-uuid", id + ",," + id)) {
            mvc.perform(get(BASE + "/assets/batch").param("ids", ids).with(reader()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_QUERY_PARAMETER"));
        }
        mvc.perform(get(BASE + "/assets/batch").with(reader()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_QUERY_PARAMETER"));
        mvc.perform(get(BASE + "/assets/batch").param("ids", id).param("page", "0").with(reader()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_QUERY_PARAMETER"));
        mvc.perform(get(BASE + "/assets/batch").param("ids", id))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void sourceSurvivesUploadRetriesAndCanBeBackfilledWithoutReplacingBytes() throws Exception {
        UUID ownerPage = UUID.randomUUID();
        UUID relatedPage = UUID.randomUUID();
        String assetId = createAsset("HERO_HEAD");
        byte[] png = TestImages.png(30, 20);
        String ticket = uploadRequest(assetId, """
                {"fileName":"head.png","contentType":"image/png","sizeBytes":%d,
                 "source":{"type":"GAME_CLIENT","label":"Game capture","ownerName":"Garena",
                           "contactUrl":"https://example.com/contact","note":"private/path.png",
                           "ownerPageId":"%s","relatedPageId":"%s"}}
                """.formatted(png.length, ownerPage, relatedPage)).andExpect(status().isCreated()).andReturn()
                .getResponse()
                .getContentAsString();
        putBytes(ticket, png);
        String uploadId = JsonPath.read(ticket, "$.uploadId");
        String result = complete(uploadId).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String versionId = JsonPath.read(result, "$.versionId");
        complete(uploadId).andExpect(status().isOk());
        mvc.perform(get(BASE + "/assets/" + assetId).with(reader()))
                .andExpect(jsonPath("$.provenance", hasSize(1)))
                .andExpect(jsonPath("$.provenance[0].versionId").value(versionId))
                .andExpect(jsonPath("$.provenance[0].ownerName").value("Garena"));
        assertThat(mediaAssets.find(UUID.fromString(assetId)).orElseThrow().currentVersion().sources().getFirst()
                .ownerName())
                .isEqualTo("Garena");
        var credit = mediaAssets.find(UUID.fromString(assetId)).orElseThrow().currentVersion().sources().getFirst();
        assertThat(credit.ownerPageId()).isEqualTo(ownerPage);
        assertThat(credit.relatedPageId()).isEqualTo(relatedPage);
        String details = mvc.perform(get(BASE + "/assets/" + assetId).with(reader())).andReturn().getResponse()
                .getContentAsString();
        String sourceId = JsonPath.read(details, "$.provenance[0].id");
        String referencesPath = BASE + "/assets/" + assetId + "/sources/" + sourceId + "/references";
        String referencesBody = "{\"expectedVersion\":0,\"relatedPageId\":\"" + relatedPage + "\"}";
        mvc.perform(put(referencesPath).with(reader()).contentType(MediaType.APPLICATION_JSON).content(referencesBody))
                .andExpect(status().isForbidden());
        mvc.perform(put(referencesPath).with(editor()).contentType(MediaType.APPLICATION_JSON).content(referencesBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentVersionId").value(versionId))
                .andExpect(jsonPath("$.provenance[0].ownerPageId").isEmpty())
                .andExpect(jsonPath("$.provenance[0].relatedPageId").value(relatedPage.toString()))
                .andExpect(jsonPath("$.provenance[0].ownerName").value("Garena"))
                .andExpect(jsonPath("$.provenance[0].referenceVersion").value(1));
        mvc.perform(put(referencesPath).with(editor()).contentType(MediaType.APPLICATION_JSON).content(referencesBody))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MEDIA_SOURCE_VERSION_CONFLICT"));
        mvc.perform(put(referencesPath.replace(assetId, createAsset("OTHER"))).with(editor())
                .contentType(MediaType.APPLICATION_JSON).content(referencesBody))
                .andExpect(status().isNotFound());
        mvc.perform(get(BASE + "/assets").param("semanticType", "HERO_HEAD").param("size", "100").with(reader()))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.items[?(@.id == '%s')].sources[*].ownerName".formatted(assetId), hasItem("Garena")))
                .andExpect(jsonPath("$.items[?(@.id == '%s')].sources[*].note".formatted(assetId)).doesNotExist());

        String sourcePath = BASE + "/assets/" + assetId + "/versions/" + versionId + "/sources";
        mvc.perform(post(sourcePath).with(reader()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"label\":\"Correction\"}")).andExpect(status().isForbidden());
        for (int i = 0; i < 2; i++) {
            mvc.perform(post(sourcePath).with(editor()).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"label\":\"Additional evidence\",\"url\":\"https://example.com/original\"}"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.provenance", hasSize(2)))
                    .andExpect(jsonPath("$.currentVersionId").value(versionId));
        }
        mvc.perform(get(BASE + "/assets").param("semanticType", "HERO_HEAD").param("size", "100").with(reader()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.id == '%s')].sources[*].ownerName".formatted(assetId),
                        hasItem(nullValue())));
    }

    @Test
    void ownerNamesShareOneCatalogEntryThatRenamesAndMergesEverySource() throws Exception {
        String unique = UUID.randomUUID().toString().substring(0, 8);
        String name = "Studio " + unique;
        String first = createAsset("OTHER");
        String firstVersion = JsonPath.read(uploadVersion(first, TestImages.png(28, 28), "image/png"), "$.versionId");
        String second = createAsset("OTHER");
        String secondVersion = JsonPath.read(uploadVersion(second, TestImages.png(29, 29), "image/png"),
                "$.versionId");
        addSource(first, firstVersion, "{\"label\":\"Capture\",\"ownerName\":\"  " + name + " \"}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.provenance[0].ownerName").value(name));
        addSource(second, secondVersion,
                "{\"label\":\"Capture\",\"ownerName\":\"" + name.toUpperCase().replace(" ", "   ") + "\"}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.provenance[0].ownerName").value(name));

        String listed = mvc.perform(get(BASE + "/owners").param("q", " studio  " + unique.toUpperCase()).with(reader()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].name").value(name))
                .andExpect(jsonPath("$.items[0].assetCount").value(2))
                .andReturn().getResponse().getContentAsString();
        String ownerId = JsonPath.read(listed, "$.items[0].id");
        long version = JsonPath.<Number>read(listed, "$.items[0].version").longValue();
        mvc.perform(get(BASE + "/owners").param("unknown", "x").with(reader())).andExpect(status().isBadRequest());

        String renamed = "Renamed " + unique;
        String update = "{\"name\":\"" + renamed + "\",\"contactUrl\":\"https://example.com/owner\","
                + "\"expectedVersion\":%d}";
        mvc.perform(put(BASE + "/owners/" + ownerId).with(reader()).contentType(MediaType.APPLICATION_JSON)
                .content(update.formatted(version))).andExpect(status().isForbidden());
        mvc.perform(put(BASE + "/owners/" + ownerId).with(editor()).contentType(MediaType.APPLICATION_JSON)
                .content(update.formatted(version)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value(renamed))
                .andExpect(jsonPath("$.assetCount").value(2));
        mvc.perform(get(BASE + "/assets/" + first).with(reader()))
                .andExpect(jsonPath("$.provenance[0].ownerName").value(renamed))
                .andExpect(jsonPath("$.provenance[0].ownerId").value(ownerId))
                .andExpect(jsonPath("$.provenance[0].contactUrl").value("https://example.com/owner"));
        assertThat(mediaAssets.find(UUID.fromString(second)).orElseThrow().currentVersion().sources().getFirst()
                .ownerName()).isEqualTo(renamed);
        mvc.perform(put(BASE + "/owners/" + ownerId).with(editor()).contentType(MediaType.APPLICATION_JSON)
                .content(update.formatted(version)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MEDIA_OWNER_VERSION_CONFLICT"));

        String other = "Other " + unique;
        addSource(second, secondVersion, "{\"label\":\"Second capture\",\"ownerName\":\"" + other + "\"}")
                .andExpect(status().isOk());
        String otherListed = mvc.perform(get(BASE + "/owners").param("q", other).with(reader()))
                .andReturn().getResponse().getContentAsString();
        String otherId = JsonPath.read(otherListed, "$.items[0].id");
        long otherVersion = JsonPath.<Number>read(otherListed, "$.items[0].version").longValue();
        mvc.perform(put(BASE + "/owners/" + otherId).with(editor()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + renamed.toLowerCase() + "\",\"expectedVersion\":" + otherVersion + "}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MEDIA_OWNER_NAME_TAKEN"))
                .andExpect(jsonPath("$.context.ownerId").value(ownerId));

        String merge = "{\"targetId\":\"%s\",\"expectedVersion\":%d}";
        mvc.perform(post(BASE + "/owners/" + otherId + "/merge").with(editor()).contentType(MediaType.APPLICATION_JSON)
                .content(merge.formatted(otherId, otherVersion))).andExpect(status().isBadRequest());
        mvc.perform(post(BASE + "/owners/" + otherId + "/merge").with(editor()).contentType(MediaType.APPLICATION_JSON)
                .content(merge.formatted(ownerId, otherVersion)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(ownerId))
                .andExpect(jsonPath("$.assetCount").value(2));
        mvc.perform(get(BASE + "/owners").param("q", other).with(reader())).andExpect(jsonPath("$.items", hasSize(0)));
        mvc.perform(get(BASE + "/assets/" + second).with(reader()))
                .andExpect(jsonPath("$.provenance[*].ownerName", everyItem(is(renamed))));
        mvc.perform(post(BASE + "/owners/" + otherId + "/merge").with(editor()).contentType(MediaType.APPLICATION_JSON)
                .content(merge.formatted(ownerId, otherVersion)))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MEDIA_OWNER_NOT_FOUND"));
    }

    private ResultActions addSource(String assetId, String versionId, String json) throws Exception {
        return mvc.perform(post(BASE + "/assets/" + assetId + "/versions/" + versionId + "/sources").with(editor())
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    @Test
    void contactRequestsAreAcceptedPrivatelyAndOnlyMediaEditorsCanReadThem() throws Exception {
        String result = mvc.perform(post("/api/wiki/v1/media/contact-requests").contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name":"Image contributor","email":"contributor@example.com","topic":"SOURCE","message":"Please add the original source."}
                        """))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.email").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(result, "$.id");
        mvc.perform(get(BASE + "/contact-requests")).andExpect(status().isUnauthorized());
        mvc.perform(get(BASE + "/contact-requests").with(reader())).andExpect(status().isForbidden());
        mvc.perform(get(BASE + "/contact-requests").with(editor())).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].id", hasItem(id)));
        mvc.perform(post(BASE + "/contact-requests/" + id + "/resolve").with(editor()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("RESOLVED"));
        mvc.perform(post("/api/wiki/v1/media/contact-requests").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"A\",\"email\":\"invalid\",\"topic\":\"SOURCE\",\"message\":\"hello\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aFocalPointBelongsToOneVersionAndReachesOtherModules() throws Exception {
        String assetId = createAsset("HERO_SPLASH");
        String versionId = JsonPath.read(uploadVersion(assetId, TestImages.png(32, 18), "image/png"), "$.versionId");
        String path = BASE + "/assets/" + assetId + "/versions/" + versionId + "/focal-point";
        String body = "{\"x\":0.62,\"y\":0.2}";

        mvc.perform(put(path).with(reader()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
        mvc.perform(put(path).with(editor()).contentType(MediaType.APPLICATION_JSON).content("{\"x\":1.2,\"y\":0.2}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put(path).with(editor()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.versions[0].focalPoint.x").value(0.62))
                .andExpect(jsonPath("$.versions[0].focalPoint.y").value(0.2));
        assertThat(mediaAssets.find(UUID.fromString(assetId)).orElseThrow().currentVersion().focalPoint())
                .isEqualTo(new MediaAssetReference.FocalPoint(0.62, 0.2));

        mvc.perform(delete(path).with(editor())).andExpect(status().isOk())
                .andExpect(jsonPath("$.versions[0].focalPoint").isEmpty());
        assertThat(mediaAssets.find(UUID.fromString(assetId)).orElseThrow().currentVersion().focalPoint()).isNull();
    }

    private String createAsset(String semanticType) throws Exception {
        String body = mvc.perform(post(BASE + "/assets").with(editor()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"semanticType\": \"" + semanticType + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    private ResultActions uploadRequest(String assetId, String json) throws Exception {
        return mvc.perform(post(BASE + "/assets/" + assetId + "/version-uploads").with(editor())
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private String requestUpload(String assetId, String contentType, long sizeBytes) throws Exception {
        return uploadRequest(assetId, "{\"contentType\": \"" + contentType + "\", \"sizeBytes\": " + sizeBytes + "}")
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
    }

    /** Uploads like a browser would: straight to object storage, with exactly the signed headers. */
    private static void putBytes(String ticket, byte[] bytes) throws Exception {
        Map<String, Object> headers = JsonPath.read(ticket, "$.headers");
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(JsonPath.read(ticket, "$.uploadUrl")))
                .method(JsonPath.read(ticket, "$.method"), HttpRequest.BodyPublishers.ofByteArray(bytes));
        headers.forEach((name, value) -> request.header(name, String.valueOf(value)));
        try (HttpClient http = HttpClient.newHttpClient()) {
            assertThat(http.send(request.build(), HttpResponse.BodyHandlers.discarding()).statusCode()).isEqualTo(200);
        }
    }

    private ResultActions complete(String uploadId) throws Exception {
        return mvc.perform(post(BASE + "/uploads/" + uploadId + "/complete").with(editor()));
    }

    private String uploadVersion(String assetId, byte[] bytes, String contentType) throws Exception {
        String ticket = requestUpload(assetId, contentType, bytes.length);
        putBytes(ticket, bytes);
        return complete(JsonPath.read(ticket, "$.uploadId"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    private ResultActions activate(String assetId, String versionId, long expectedVersion) throws Exception {
        return mvc.perform(post(BASE + "/assets/" + assetId + "/versions/" + versionId + "/activate").with(editor())
                .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\": " + expectedVersion + "}"));
    }

    private ResultActions deprecate(String assetId, long expectedVersion) throws Exception {
        return mvc.perform(post(BASE + "/assets/" + assetId + "/deprecate").with(editor())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\": " + expectedVersion + ", \"reason\": \"Replaced\"}"));
    }

    private ResultActions register(String json) throws Exception {
        return mvc.perform(post(BASE + "/imports/register").with(editor())
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    @Test
    void realMediaUploadsFlowThroughHeroPublicationAndQualityUpgrade() throws Exception {
        clock.set(Instant.parse("2030-01-01T00:00:00Z"));
        String root = "/api/wiki/v1";
        String suffix = UUID.randomUUID().toString();
        String ruleset = (String) pipeline(post(root + "/admin/rulesets"),
                Map.of("code", "TEST-" + suffix, "description", "Synthetic integration fixture"), 201).get("id");
        String region = "5d5dcd5e-15b9-4d43-884d-111111111111";
        pipeline(post(root + "/admin/regions/" + region + "/ruleset-assignments"),
                Map.of("rulesetId", ruleset, "validFrom", "2029-01-01T00:00:00Z"), 201);
        String patch = (String) pipeline(post(root + "/admin/patches"), Map.of("code", "fixture-" + suffix,
                "translations",
                List.of(Map.of("locale", "vi-VN", "title", "Synthetic test patch", "summary", "Not game data"))), 201)
                .get("id");
        String variant = (String) pipeline(post(root + "/admin/patches/" + patch + "/variants"),
                Map.of("rulesetId", ruleset, "variantCode", "TEST", "rulesetOrdinal", 1), 201).get("id");
        pipeline(post(root + "/admin/patch-variants/" + variant + "/publish"), null, 204);
        String season = (String) pipeline(post(root + "/admin/seasons"),
                Map.of("code", "fixture-season", "displayName", "Test season"), 201).get("id");
        pipeline(post(root + "/admin/seasons/" + season + "/schedules"),
                Map.of("regionId", region, "startsAt", "2029-01-01T00:00:00Z", "endsAt", "2030-01-01T00:00:00Z"),
                201);
        String release = (String) pipeline(post(root + "/admin/patch-variants/" + variant + "/releases"),
                Map.of("regionId", region, "seasonId", season, "effectiveAt", "2029-01-02T00:00:00Z"), 201).get("id");
        Map<String, String> assets = new java.util.HashMap<>();
        for (String semantic : List.of("HEAD", "PORTRAIT", "SPLASH", "SKILL_ICON", "SKIN_ART")) {
            String asset = createAsset("HERO_" + semantic);
            uploadVersion(asset, TestImages.png(40, 30), "image/png");
            assets.put(semantic, asset);
        }
        var draft = pipeline(post(root + "/admin/heroes"), Map.of("code", "fixture-" + suffix,
                "name", "Synthetic test hero", "initialLocale", "vi-VN", "rulesetId", ruleset, "releaseId", release),
                201);
        String hero = (String) draft.get("heroId"), revision = (String) draft.get("id");
        String path = root + "/admin/heroes/" + hero + "/drafts/" + revision;
        mvc.perform(get(root + "/heroes/" + hero)).andExpect(status().isNotFound());
        Map<String, Object> sections = new java.util.LinkedHashMap<>();
        sections.put("profile", Map.of("translations",
                List.of(Map.of("locale", "vi-VN", "name", "Synthetic test hero")), "roles", List.of("ASSASSIN")));
        sections.put("overview-ratings", Map.of("scaleCode", "GAME_OVERVIEW_10", "survivability", 1, "attackDamage", 2,
                "skillEffects", 3, "difficulty", 4));
        sections.put("combat-stats",
                Map.of("values", List.of(Map.of("statKey", "HP", "baseValue", 100, "unit", "POINT"))));
        sections.put("skills",
                Map.of("skills", List.of(Map.of("skillKey", "skill-1", "kind", "ACTIVE", "displayOrder", 0,
                        "iconAssetId", assets.get("SKILL_ICON"), "translations", List.of(Map.of("locale", "vi-VN",
                                "name", "Test skill", "description", "Synthetic description, not game data")),
                        "effects", List.of()))));
        sections.put("skins", Map.of("skins", List.of(Map.of("skinKey", "skin-1", "displayOrder", 0,
                "artAssetId", assets.get("SKIN_ART"), "translations",
                List.of(Map.of("locale", "vi-VN", "name", "Test skin"))))));
        sections.put("media-bindings", Map.of("bindings", Map.of("HEAD", assets.get("HEAD"), "PORTRAIT",
                assets.get("PORTRAIT"), "SPLASH", assets.get("SPLASH"))));
        for (var section : sections.entrySet()) {
            Map<String, Object> body = new java.util.HashMap<>((Map<String, Object>) section.getValue());
            body.put("expectedDraftVersion", draft.get("version"));
            draft = pipeline(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                    .put(path + "/" + section.getKey()), body, 200);
        }
        var published = pipeline(post(path + "/publish"), Map.of("expectedVersion", draft.get("version")), 200);
        var first = mvc.perform(get(root + "/heroes/" + hero)).andExpect(status().isOk())
                .andExpect(jsonPath("$.skillMedia.skill-1.currentVersion.url").isNotEmpty())
                .andExpect(jsonPath("$.skinMedia.skin-1.currentVersion.url").isNotEmpty()).andReturn().getResponse();
        String tag = first.getHeader("ETag");
        mvc.perform(get(root + "/heroes/" + hero).header("If-None-Match", tag)).andExpect(status().isNotModified());
        String upgraded = uploadVersion(assets.get("PORTRAIT"), TestImages.png(80, 60), "image/png");
        String versionId = JsonPath.read(upgraded, "$.versionId");
        String assetDetails = mvc.perform(get(BASE + "/assets/" + assets.get("PORTRAIT")).with(editor()))
                .andReturn().getResponse().getContentAsString();
        Number expectedVersion = JsonPath.read(assetDetails, "$.version");
        activate(assets.get("PORTRAIT"), versionId, expectedVersion.longValue()).andExpect(status().isOk());
        mvc.perform(get(root + "/heroes/" + hero).header("If-None-Match", tag)).andExpect(status().isOk())
                .andExpect(jsonPath("$.revisionId").value(published.get("id")))
                .andExpect(jsonPath("$.media.PORTRAIT.currentVersion.versionId").value(versionId));
        mvc.perform(get(BASE + "/assets/" + assets.get("PORTRAIT") + "/usages").with(reader()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[*].scope", hasItem("CURRENT")));
    }

    private Map<String, Object> pipeline(
            org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request,
            Object body, int expected) throws Exception {
        request.with(jwt().jwt(t -> t.subject("pipeline").issuer("http://localhost/realms/test"))
                .authorities(java.util.stream.Stream
                        .of("catalog:read", "hero:write", "hero:publish", "region:admin", "patch:write",
                                "patch:publish")
                        .map(SimpleGrantedAuthority::new).toArray(SimpleGrantedAuthority[]::new)));
        var mapper = tools.jackson.databind.json.JsonMapper.builder().build();
        if (body != null)
            request.contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body));
        String result = mvc.perform(request).andExpect(status().is(expected)).andReturn().getResponse()
                .getContentAsString();
        return result.isEmpty() ? Map.of() : mapper.readValue(result, Map.class);
    }

    private static RequestPostProcessor editor() {
        return jwt().jwt(token -> token.subject("editor-1").issuer("http://localhost/realms/test"))
                .authorities(new SimpleGrantedAuthority(Capabilities.CATALOG_READ),
                        new SimpleGrantedAuthority(Capabilities.MEDIA_WRITE));
    }

    private static RequestPostProcessor reader() {
        return jwt().jwt(token -> token.subject("reader-1").issuer("http://localhost/realms/test"))
                .authorities(new SimpleGrantedAuthority(Capabilities.CATALOG_READ));
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class TestBeans {

        @Bean
        @Primary
        MutableClock testClock() {
            return new MutableClock(Instant.now());
        }

        @Bean
        StubUsages stubUsages() {
            return new StubUsages();
        }
    }

    /** Stands in for the hero module until it implements the usage contract (Phase 3). */
    static class StubUsages implements MediaUsageProvider {

        final Map<UUID, List<MediaUsage>> byAsset = new ConcurrentHashMap<>();

        @Override
        public List<MediaUsage> findUsages(UUID assetId) {
            return byAsset.getOrDefault(assetId, List.of());
        }

        @Override
        public Map<UUID, List<MediaUsage>> findAllUsages() {
            return Map.copyOf(byAsset);
        }
    }
}
