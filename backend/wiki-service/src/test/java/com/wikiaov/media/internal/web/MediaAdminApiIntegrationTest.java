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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import com.wikiaov.media.internal.application.port.ObjectStorage;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
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
    }
}
