package com.wikiaov.media.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.wikiaov.SeaweedFsTestConfiguration;
import com.wikiaov.TestcontainersConfiguration;
import com.wikiaov.access.Capabilities;
import com.wikiaov.media.SourceFileUsage;
import com.wikiaov.media.SourceFileUsageProvider;
import com.wikiaov.media.TestImages;
import com.wikiaov.media.internal.storage.application.port.ObjectStorage;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Collection;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.junit.jupiter.Testcontainers;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.S3Exception;

/**
 * Private source files and the storage report end to end (ADR-030): real PostgreSQL, real S3-compatible storage with
 * a separate sources bucket, real presigned uploads and downloads. Requires Docker.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, SeaweedFsTestConfiguration.class,
        SourceFileAdminApiIntegrationTest.TestBeans.class})
@ActiveProfiles("test")
@TestPropertySource(properties = "wiki.storage.sources-bucket=" + SourceFileAdminApiIntegrationTest.SOURCES_BUCKET)
@Testcontainers(disabledWithoutDocker = true)
class SourceFileAdminApiIntegrationTest {

    static final String SOURCES_BUCKET = "wiki-sources-test";
    private static final String ADMIN = "/api/wiki/v1/admin";

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectStorage storage;

    @Autowired
    S3Client s3;

    @Autowired
    StubEvidence evidence;

    /**
     * Cloud buckets are made in the provider's dashboard and SeaweedFS only creates a bucket on a PUT, never on a copy,
     * so the separate sources bucket is created here, as the storage adapter test does for its public bucket.
     */
    @BeforeEach
    void provisionSourcesBucket() {
        try {
            s3.headBucket(request -> request.bucket(SOURCES_BUCKET));
        } catch (S3Exception ex) {
            if (ex.statusCode() != 404) {
                throw ex;
            }
            s3.createBucket(request -> request.bucket(SOURCES_BUCKET));
        }
    }

    @Test
    void uploadsStoreBytesOnceByContentAndShortLivedLinksServeThem() throws Exception {
        byte[] png = TestImages.png(31, 17);
        String sha = sha256(png);
        String shop = createCollection("shop-" + suffix(), "SHOP_CAPTURE", "2026-09-16");
        String data = createCollection("data-" + suffix(), "IMPORT_DATA", null);

        String requested = requestUpload(shop, "raw/shop/2026-09-16/tuong/airi.png", png, "image/png")
                .andExpect(status().isCreated())
                .andExpect(header().string("Cache-Control", containsString("no-store")))
                .andExpect(jsonPath("$.status").value("UPLOAD_REQUIRED"))
                .andReturn().getResponse().getContentAsString();
        String uploadId = JsonPath.read(requested, "$.upload.uploadId");
        putBytes(requested, png);
        String completed = complete(uploadId).andExpect(status().isOk())
                .andExpect(jsonPath("$.file.sha256").value(sha))
                .andExpect(jsonPath("$.file.contentType").value("image/png"))
                .andReturn().getResponse().getContentAsString();
        String fileId = JsonPath.read(completed, "$.file.id");

        assertThat(s3.headObject(request -> request.bucket(SOURCES_BUCKET).key("sources/" + sha)).contentLength())
                .isEqualTo(png.length);
        assertThat(storage.stat("incoming/" + uploadId)).isEmpty();
        complete(uploadId).andExpect(status().isOk()).andExpect(jsonPath("$.file.id").value(fileId));
        mvc.perform(get(ADMIN + "/source-uploads/" + uploadId).with(reader())).andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("READY")).andExpect(jsonPath("$.fileId").value(fileId));

        // The same bytes elsewhere are placed at once: nothing is uploaded or stored twice.
        requestUpload(data, "copies/airi.png", png, "image/png").andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("STORED"))
                .andExpect(jsonPath("$.file.sha256").value(sha));

        String links = mvc.perform(post(ADMIN + "/source-files/links").with(reader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"sha256\":[\"" + sha + "\",\"" + "0".repeat(64) + "\"]}"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-store")))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.missing[0]").value("0".repeat(64)))
                .andReturn().getResponse().getContentAsString();
        HttpResponse<byte[]> download = fetch(JsonPath.read(links, "$.items[0].url"));
        assertThat(download.statusCode()).isEqualTo(200);
        assertThat(download.body()).isEqualTo(png);
        assertThat(download.headers().firstValue("Content-Type")).contains("image/png");

        mvc.perform(post(ADMIN + "/source-collections/" + shop + "/links").with(reader())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"paths\":[\"raw/shop/2026-09-16/tuong/airi.png\",\"raw/shop/missing.png\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].sha256").value(sha))
                .andExpect(jsonPath("$.missing[0]").value("raw/shop/missing.png"));
        String attachment = mvc.perform(post(ADMIN + "/source-files/" + fileId + "/download-link").with(reader()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        HttpResponse<byte[]> saved = fetch(JsonPath.read(attachment, "$.url"));
        assertThat(saved.headers().firstValue("Content-Disposition")).hasValueSatisfying(
                value -> assertThat(value).contains("attachment").contains("airi.png"));

        mvc.perform(get(ADMIN + "/source-collections/" + shop + "/files?prefix=raw/shop&q=AIRI").with(reader()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].path").value("raw/shop/2026-09-16/tuong/airi.png"));
        mvc.perform(get(ADMIN + "/source-collections/" + shop + "/files?prefix=raw/other").with(reader()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get(ADMIN + "/source-collections/" + shop).with(reader())).andExpect(status().isOk())
                .andExpect(jsonPath("$.fileCount").value(1)).andExpect(jsonPath("$.totalBytes").value(png.length))
                .andExpect(jsonPath("$.capturedOn").value("2026-09-16"));
        mvc.perform(get(ADMIN + "/source-files/" + fileId).with(reader())).andExpect(status().isOk())
                .andExpect(jsonPath("$.collection.category").value("SHOP_CAPTURE"))
                .andExpect(jsonPath("$.otherPlaces[0].path").value("copies/airi.png"));

        mvc.perform(get(ADMIN + "/storage/summary").with(reader())).andExpect(status().isOk())
                .andExpect(jsonPath("$.storage.source").value("DATABASE"))
                .andExpect(jsonPath("$.cloudflare.state").value("NOT_CONFIGURED"))
                .andExpect(jsonPath("$.buckets[1].role").value("SOURCES"))
                .andExpect(jsonPath("$.buckets[1].bucket").value(SOURCES_BUCKET))
                .andExpect(jsonPath("$.buckets[1].groups[*].key", hasItem("SHOP_CAPTURE")))
                .andExpect(jsonPath("$.months", hasSize(12)));
        byte[] other = "fresh,data\n".getBytes(StandardCharsets.UTF_8);
        mvc.perform(post(ADMIN + "/storage/estimates").with(reader()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"target\":\"SOURCES\",\"files\":[{\"sha256\":\"" + sha + "\",\"sizeBytes\":" + png.length
                        + "},{\"sha256\":\"" + sha256(other) + "\",\"sizeBytes\":" + other.length
                        + "},{\"sizeBytes\":5}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.files").value(3))
                .andExpect(jsonPath("$.knownFiles").value(1))
                .andExpect(jsonPath("$.newFiles").value(2))
                .andExpect(jsonPath("$.newBytes").value(other.length + 5))
                .andExpect(jsonPath("$.classA").value(4))
                .andExpect(jsonPath("$.level").value("OK"));
    }

    @Test
    void replacingNeedsTheShownVersionAndPurgingFreesOnlyUnusedBytes() throws Exception {
        String collection = createCollection("hero-" + suffix(), "HERO_CAPTURE", null);
        byte[] first = "{\"version\":1}".getBytes(StandardCharsets.UTF_8);
        byte[] second = "{\"version\":2}".getBytes(StandardCharsets.UTF_8);
        String fileId = upload(collection, "manifest/heroes.json", first, "application/json");

        String taken = requestUpload(collection, "manifest/heroes.json", second, "application/json")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SOURCE_FILE_PATH_TAKEN"))
                .andExpect(jsonPath("$.context.fileId").value(fileId))
                .andReturn().getResponse().getContentAsString();
        int version = JsonPath.read(taken, "$.context.version");
        requestUpload(collection, "manifest/heroes.json", second, "application/json",
                ",\"replace\":{\"fileId\":\"" + fileId + "\",\"expectedVersion\":" + (version + 7) + "}")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SOURCE_FILE_VERSION_CONFLICT"));
        String ticket = requestUpload(collection, "manifest/heroes.json", second, "application/json",
                ",\"replace\":{\"fileId\":\"" + fileId + "\",\"expectedVersion\":" + version + "}")
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        putBytes(ticket, second);
        complete(JsonPath.read(ticket, "$.upload.uploadId")).andExpect(status().isOk())
                .andExpect(jsonPath("$.file.id").value(fileId))
                .andExpect(jsonPath("$.file.sha256").value(sha256(second)))
                .andExpect(jsonPath("$.file.version").value(version + 1));

        mvc.perform(get(ADMIN + "/source-objects/orphans?size=100").with(reader())).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].sha256", hasItem(sha256(first))))
                .andExpect(jsonPath("$.items[*].sha256", not(hasItem(sha256(second)))));
        deleteOrphan(sha256(second)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SOURCE_OBJECT_IN_USE"));
        deleteOrphan(sha256(first)).andExpect(status().isNoContent());
        assertThat(storage.stat("sources/" + sha256(first))).isEmpty();
        deleteOrphan(sha256(first)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("SOURCE_OBJECT_NOT_FOUND"));

        // Removing the collection keeps the bytes; they become orphans until someone purges them.
        long collectionVersion = collectionVersion(collection);
        mvc.perform(post(ADMIN + "/source-collections/" + collection + "/delete").with(editor())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":" + (collectionVersion + 1) + "}"))
                .andExpect(status().isConflict());
        mvc.perform(post(ADMIN + "/source-collections/" + collection + "/delete").with(editor())
                .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":" + collectionVersion + "}"))
                .andExpect(status().isNoContent());
        assertThat(storage.stat("sources/" + sha256(second))).isPresent();
        mvc.perform(get(ADMIN + "/source-objects/orphans?size=100").with(reader())).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].sha256", hasItem(sha256(second))));
    }

    @Test
    void bytesThatDoNotMatchTheDeclarationAreRefusedForGood() throws Exception {
        String collection = createCollection("ranking-" + suffix(), "RANKING_CAPTURE", null);
        byte[] page = TestImages.png(12, 12);

        // Completing before the PUT keeps the upload open; the retry after the PUT succeeds.
        String ticket = requestUpload(collection, "raw/ranking/page-1.png", page, "image/png")
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String uploadId = JsonPath.read(ticket, "$.upload.uploadId");
        complete(uploadId).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SOURCE_UPLOAD_NOT_UPLOADED"));
        putBytes(ticket, page);
        complete(uploadId).andExpect(status().isOk()).andExpect(jsonPath("$.file.sha256").value(sha256(page)));

        byte[] declared = "0123456789".getBytes(StandardCharsets.UTF_8);
        String shorter = requestUpload(collection, "data/short.txt", declared, "text/plain")
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        putBytes(shorter, "01234".getBytes(StandardCharsets.UTF_8));
        complete(JsonPath.read(shorter, "$.upload.uploadId")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.context.reason").value("SIZE_MISMATCH"));

        byte[] text = "not an image".getBytes(StandardCharsets.UTF_8);
        String typed = requestUpload(collection, "raw/ranking/fake.png", text, "image/png")
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String typedId = JsonPath.read(typed, "$.upload.uploadId");
        putBytes(typed, text);
        complete(typedId).andExpect(status().isConflict())
                .andExpect(jsonPath("$.context.reason").value("TYPE_MISMATCH"));
        complete(typedId).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SOURCE_UPLOAD_REJECTED"));
        mvc.perform(get(ADMIN + "/source-uploads/" + typedId).with(reader())).andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("REJECTED"))
                .andExpect(jsonPath("$.errorCode").value("TYPE_MISMATCH"));
        assertThat(storage.stat("incoming/" + typedId)).isEmpty();

        byte[] json = "{}".getBytes(StandardCharsets.UTF_8);
        String hashed = requestUpload(collection, "data/other.json", json, "application/json")
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        putBytes(hashed, "[]".getBytes(StandardCharsets.UTF_8));
        complete(JsonPath.read(hashed, "$.upload.uploadId")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.context.reason").value("SHA256_MISMATCH"));
    }

    @Test
    void evidenceStillUsedByARecordIsNeverPurged() throws Exception {
        String collection = createCollection("builds-" + suffix(), "BUILD_CAPTURE", null);
        byte[] capture = TestImages.png(19, 11);
        String sha = sha256(capture);
        String fileId = upload(collection, "raw/builds/pro-001/pro-001-1.png", capture, "image/png");
        UUID captureId = UUID.randomUUID();
        evidence.uses.put(sha, List.of(new SourceFileUsage("BUILD", "BUILD_CAPTURE", captureId, "vn-pro-20261111",
                "CAPTURE_IMAGE")));

        mvc.perform(get(ADMIN + "/source-files/" + fileId).with(reader())).andExpect(status().isOk())
                .andExpect(jsonPath("$.usages[0].ownerName").value("vn-pro-20261111"));
        long version = JsonPath.<Integer>read(mvc.perform(get(ADMIN + "/source-files/" + fileId).with(reader()))
                .andReturn().getResponse().getContentAsString(), "$.version");
        mvc.perform(post(ADMIN + "/source-files/" + fileId + "/delete").with(editor())
                .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":" + version + "}"))
                .andExpect(status().isNoContent());

        mvc.perform(get(ADMIN + "/source-objects/orphans?size=100").with(reader())).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].sha256", not(hasItem(sha))));
        deleteOrphan(sha).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SOURCE_OBJECT_IN_USE"));
        assertThat(storage.stat("sources/" + sha)).isPresent();
        evidence.uses.remove(sha);
        deleteOrphan(sha).andExpect(status().isNoContent());
    }

    @Test
    void readersSeeEvidenceButOnlyMediaWritersChangeIt() throws Exception {
        String collection = createCollection("modes-" + suffix(), "GAME_MODE_SOURCE", null);

        mvc.perform(get(ADMIN + "/source-collections?category=GAME_MODE_SOURCE&size=100").with(reader()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[*].id", hasItem(collection)));
        mvc.perform(post(ADMIN + "/source-collections").with(reader()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\":\"reader-" + suffix() + "\",\"category\":\"ARCHIVE\",\"label\":\"x\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post(ADMIN + "/source-collections/" + collection + "/uploads").with(reader())
                .contentType(MediaType.APPLICATION_JSON).content(uploadBody("a.txt", new byte[] {1}, "text/plain", "")))
                .andExpect(status().isForbidden());
        mvc.perform(get(ADMIN + "/storage/summary"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get(ADMIN + "/storage/summary?extra=1").with(reader())).andExpect(status().isBadRequest());

        mvc.perform(post(ADMIN + "/source-collections").with(editor()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\":\"" + collectionCode(collection) + "\",\"category\":\"ARCHIVE\",\"label\":\"x\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SOURCE_COLLECTION_CODE_TAKEN"));
        requestUpload(collection, "../escape.png", TestImages.png(5, 5), "image/png")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("SOURCE_FILE_PATH_INVALID"));
        requestUpload(collection, "page.html", "<p>x</p>".getBytes(StandardCharsets.UTF_8), "text/html")
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("SOURCE_FILE_TYPE_NOT_ALLOWED"));
        String tooMany = IntStream.range(0, 201).mapToObj(i -> "\"" + String.format("%064x", i) + "\"")
                .collect(Collectors.joining(","));
        mvc.perform(post(ADMIN + "/source-files/links").with(reader()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"sha256\":[" + tooMany + "]}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("SOURCE_LINK_LIMIT_EXCEEDED"));

        String updated = mvc.perform(put(ADMIN + "/source-collections/" + collection).with(editor())
                .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":" + collectionVersion(collection)
                        + ",\"label\":\"Bách khoa Cờ Liên quân\",\"note\":\"  \",\"capturedOn\":\"2026-11-08\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.label").value("Bách khoa Cờ Liên quân"))
                .andExpect(jsonPath("$.note").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        assertThat((String) JsonPath.read(updated, "$.capturedOn")).isEqualTo("2026-11-08");
    }

    private String createCollection(String code, String category, String capturedOn) throws Exception {
        String body = "{\"code\":\"" + code + "\",\"category\":\"" + category + "\",\"label\":\"Test " + code + "\""
                + (capturedOn == null ? "" : ",\"capturedOn\":\"" + capturedOn + "\"") + "}";
        String created = mvc.perform(post(ADMIN + "/source-collections").with(editor())
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value(code))
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(created, "$.id");
    }

    private long collectionVersion(String collection) throws Exception {
        return JsonPath.<Integer>read(mvc.perform(get(ADMIN + "/source-collections/" + collection).with(reader()))
                .andReturn().getResponse().getContentAsString(), "$.version");
    }

    private String collectionCode(String collection) throws Exception {
        return JsonPath.read(mvc.perform(get(ADMIN + "/source-collections/" + collection).with(reader()))
                .andReturn().getResponse().getContentAsString(), "$.code");
    }

    private String upload(String collection, String path, byte[] bytes, String contentType) throws Exception {
        String ticket = requestUpload(collection, path, bytes, contentType).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        putBytes(ticket, bytes);
        return JsonPath.read(complete(JsonPath.read(ticket, "$.upload.uploadId")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(), "$.file.id");
    }

    private ResultActions requestUpload(String collection, String path, byte[] bytes, String contentType)
            throws Exception {
        return requestUpload(collection, path, bytes, contentType, "");
    }

    private ResultActions requestUpload(String collection, String path, byte[] bytes, String contentType,
            String extra) throws Exception {
        return mvc.perform(post(ADMIN + "/source-collections/" + collection + "/uploads").with(editor())
                .contentType(MediaType.APPLICATION_JSON).content(uploadBody(path, bytes, contentType, extra)));
    }

    private static String uploadBody(String path, byte[] bytes, String contentType, String extra) throws Exception {
        return "{\"path\":\"" + path + "\",\"sha256\":\"" + sha256(bytes) + "\",\"sizeBytes\":" + bytes.length
                + ",\"contentType\":\"" + contentType + "\"" + extra + "}";
    }

    private ResultActions complete(String uploadId) throws Exception {
        return mvc.perform(post(ADMIN + "/source-uploads/" + uploadId + "/complete").with(editor()));
    }

    private ResultActions deleteOrphan(String sha) throws Exception {
        return mvc.perform(post(ADMIN + "/source-objects/" + sha + "/delete").with(editor()));
    }

    /** Uploads like a browser or the sync tool: straight to object storage, with exactly the signed headers. */
    private static void putBytes(String ticket, byte[] bytes) throws Exception {
        Map<String, Object> headers = JsonPath.read(ticket, "$.upload.headers");
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(JsonPath.read(ticket, "$.upload.uploadUrl")))
                .method(JsonPath.read(ticket, "$.upload.method"), HttpRequest.BodyPublishers.ofByteArray(bytes));
        headers.forEach((name, value) -> request.header(name, String.valueOf(value)));
        try (HttpClient http = HttpClient.newHttpClient()) {
            assertThat(http.send(request.build(), HttpResponse.BodyHandlers.discarding()).statusCode()).isEqualTo(200);
        }
    }

    private static HttpResponse<byte[]> fetch(String url) throws Exception {
        try (HttpClient http = HttpClient.newHttpClient()) {
            return http.send(HttpRequest.newBuilder(URI.create(url)).GET().build(),
                    HttpResponse.BodyHandlers.ofByteArray());
        }
    }

    private static String sha256(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    private static String suffix() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private static RequestPostProcessor editor() {
        return jwt().jwt(token -> token.subject("source-editor").issuer("http://localhost/realms/test"))
                .authorities(new SimpleGrantedAuthority(Capabilities.CATALOG_READ),
                        new SimpleGrantedAuthority(Capabilities.MEDIA_WRITE));
    }

    private static RequestPostProcessor reader() {
        return jwt().jwt(token -> token.subject("source-reader").issuer("http://localhost/realms/test"))
                .authorities(new SimpleGrantedAuthority(Capabilities.CATALOG_READ));
    }

    /** A module that keeps some stored screenshots as evidence. */
    static class StubEvidence implements SourceFileUsageProvider {

        final Map<String, List<SourceFileUsage>> uses = new ConcurrentHashMap<>();

        @Override
        public List<SourceFileUsage> findUsages(String sha256) {
            return uses.getOrDefault(sha256, List.of());
        }

        @Override
        public Set<String> findReferenced(Collection<String> sha256s) {
            return sha256s.stream().filter(uses::containsKey).collect(Collectors.toSet());
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class TestBeans {

        @Bean
        StubEvidence stubEvidence() {
            return new StubEvidence();
        }
    }
}
