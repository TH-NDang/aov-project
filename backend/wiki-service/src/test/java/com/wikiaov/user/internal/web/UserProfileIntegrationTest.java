package com.wikiaov.user.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
import com.wikiaov.SeaweedFsTestConfiguration;
import com.wikiaov.TestcontainersConfiguration;
import com.wikiaov.media.TestImages;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = {"wiki.user.profile-defaults.locale=en-GB",
        "wiki.user.profile-defaults.time-zone=Europe/London"})
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, SeaweedFsTestConfiguration.class})
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
class UserProfileIntegrationTest {
    private static final String BASE = "/api/wiki/v1";
    @Autowired
    MockMvc mvc;

    private static RequestPostProcessor person(String subject, String... roles) {
        return jwt().jwt(token -> token.subject(subject).issuer("https://identity.example")
                .claim("preferred_username", subject).claim("name", "Editor"))
                .authorities(java.util.Arrays.stream(roles).map(SimpleGrantedAuthority::new)
                        .toArray(SimpleGrantedAuthority[]::new));
    }

    private static String profile(long version, String avatar) {
        return """
                {"displayName":"Test user","biography":"Hello","locale":"vi-VN","timeZone":"Asia/Ho_Chi_Minh",
                 "avatarAssetId":%s,"expectedVersion":%d}
                """.formatted(avatar == null ? "null" : "\"" + avatar + "\"", version);
    }

    @Test
    void selfRequiresAuthenticationAndDoesNotRequireCatalogRole() throws Exception {
        mvc.perform(get(BASE + "/users/me")).andExpect(status().isUnauthorized());
        mvc.perform(get(BASE + "/users/me").with(person(UUID.randomUUID().toString())))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.version").value(0)).andExpect(jsonPath("$.id").isEmpty())
                .andExpect(jsonPath("$.locale").value("en-GB"))
                .andExpect(jsonPath("$.timeZone").value("Europe/London"));
        mvc.perform(get(BASE + "/users/me?unexpected=1").with(person("one"))).andExpect(status().isBadRequest());
        mvc.perform(get(BASE + "/users/me").with(jwt().jwt(token -> token.subject("service")
                .claim("client_id", "importer")))).andExpect(status().isForbidden());
    }

    @Test
    void profilesAreIsolatedAndStaleWritesDoNotOverwrite() throws Exception {
        String subject = UUID.randomUUID().toString();
        String saved = mvc.perform(put(BASE + "/users/me").with(person(subject)).contentType("application/json")
                .content(profile(0, null))).andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1))
                .andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(saved, "$.id");
        mvc.perform(get(BASE + "/users/me").with(person(subject))).andExpect(status().isOk())
                .andExpect(jsonPath("$.locale").value("vi-VN"))
                .andExpect(jsonPath("$.timeZone").value("Asia/Ho_Chi_Minh"));
        mvc.perform(get(BASE + "/users/me").with(person(subject + "other"))).andExpect(jsonPath("$.id").isEmpty());
        mvc.perform(
                put(BASE + "/users/me").with(person(subject)).contentType("application/json").content(profile(0, null)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("USER_PROFILE_CONFLICT"));
        mvc.perform(
                put(BASE + "/users/me").with(person(subject)).contentType("application/json").content(profile(1, null)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(2));
        mvc.perform(get(BASE + "/admin/users/" + id).with(person("editor", "catalog:read")))
                .andExpect(status().isForbidden());
        mvc.perform(get(BASE + "/admin/users/" + id).with(person("manager", "catalog:read", "user:read")))
                .andExpect(status().isOk());
        mvc.perform(put(BASE + "/admin/users/" + id).with(person("reader", "catalog:read", "user:read"))
                .contentType("application/json").content(profile(2, null))).andExpect(status().isForbidden());
        mvc.perform(put(BASE + "/admin/users/" + id).with(person("manager", "catalog:read", "user:write"))
                .contentType("application/json").content(profile(2, null))).andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(3));
        mvc.perform(get(BASE + "/admin/users?search=Test&page=0&size=1")
                .with(person("manager", "catalog:read", "user:read")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1));
    }

    @Test
    void concurrentSavesKeepOneProfileAndOneWinningVersion() throws Exception {
        String subject = UUID.randomUUID().toString();
        for (long version = 0; version < 2; version++) {
            String body = profile(version, null);
            var start = new java.util.concurrent.CountDownLatch(1);
            try (var executor = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
                java.util.concurrent.Callable<Integer> save = () -> {
                    start.await();
                    return mvc.perform(put(BASE + "/users/me").with(person(subject))
                            .contentType("application/json").content(body)).andReturn().getResponse().getStatus();
                };
                var first = executor.submit(save);
                var second = executor.submit(save);
                start.countDown();
                assertThat(java.util.List.of(first.get(30, java.util.concurrent.TimeUnit.SECONDS),
                        second.get(30, java.util.concurrent.TimeUnit.SECONDS)))
                        .containsExactlyInAnyOrder(200, 409);
            }
            mvc.perform(get(BASE + "/users/me").with(person(subject)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(version + 1));
        }
    }

    @Test
    void rejectsInvalidProfileAndIdentityInjection() throws Exception {
        var user = person(UUID.randomUUID().toString());
        mvc.perform(put(BASE + "/users/me").with(user).contentType("application/json")
                .content(profile(0, null).replace("vi-VN", "not_a_language")))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(put(BASE + "/users/me").with(user).contentType("application/json")
                .content(profile(0, null).replace("Asia/Ho_Chi_Minh", "Invalid/Zone")))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(put(BASE + "/users/me").with(user).contentType("application/json")
                .content(profile(0, null).replace("\"expectedVersion\":0",
                        "\"expectedVersion\":0,\"subject\":\"victim\"")))
                .andExpect(status().isBadRequest());
        mvc.perform(put(BASE + "/users/me").with(user).contentType("application/json")
                .content(profile(0, UUID.randomUUID().toString())))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void avatarUploadsDirectlyToStorageAndBecomesTrackedUsage() throws Exception {
        String subject = UUID.randomUUID().toString();
        byte[] bytes = TestImages.png(64, 64);
        String ticket = ticket(subject, bytes.length);
        String uploadId = JsonPath.read(ticket, "$.uploadId");
        String assetId = JsonPath.read(ticket, "$.assetId");
        String uploadUrl = JsonPath.read(ticket, "$.uploadUrl");
        mvc.perform(post(BASE + "/users/me/avatar-uploads/" + uploadId + "/complete").with(person("other")))
                .andExpect(status().isForbidden());
        mvc.perform(put(BASE + "/users/me").with(person(subject)).contentType("application/json")
                .content(profile(0, assetId)))
                .andExpect(status().isUnprocessableEntity());

        try (HttpClient client = HttpClient.newHttpClient()) {
            var preflight = client.send(HttpRequest.newBuilder(URI.create(uploadUrl))
                    .method("OPTIONS", HttpRequest.BodyPublishers.noBody())
                    .header("Origin", "https://localhost")
                    .header("Access-Control-Request-Method", "PUT")
                    .header("Access-Control-Request-Headers", "content-type").build(),
                    HttpResponse.BodyHandlers.discarding());
            assertThat(preflight.statusCode()).isBetween(200, 299);
            assertThat(preflight.headers().firstValue("Access-Control-Allow-Origin")).contains("https://localhost");
            HttpRequest.Builder put = HttpRequest.newBuilder(URI.create(uploadUrl))
                    .PUT(HttpRequest.BodyPublishers.ofByteArray(bytes));
            Map<String, String> headers = JsonPath.read(ticket, "$.headers");
            headers.forEach(put::header);
            assertThat(client.send(put.build(), HttpResponse.BodyHandlers.discarding()).statusCode()).isBetween(200,
                    299);
            String result = mvc
                    .perform(post(BASE + "/users/me/avatar-uploads/" + uploadId + "/complete").with(person(subject)))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            String preview = JsonPath.read(result, "$.avatarUrl");
            var downloaded = client.send(HttpRequest.newBuilder(URI.create(preview)).GET().build(),
                    HttpResponse.BodyHandlers.ofByteArray());
            assertThat(downloaded.statusCode()).isEqualTo(200);
            assertThat(downloaded.body()).isEqualTo(bytes);
        }
        mvc.perform(post(BASE + "/users/me/avatar-uploads/" + uploadId + "/complete").with(person(subject)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.assetId").value(assetId));
        mvc.perform(put(BASE + "/users/me").with(person("other")).contentType("application/json")
                .content(profile(0, assetId)))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(put(BASE + "/users/me").with(person(subject)).contentType("application/json")
                .content(profile(0, assetId)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.avatarAssetId").value(assetId));
        mvc.perform(get(BASE + "/admin/media/assets/" + assetId + "/usages").with(person("editor", "catalog:read")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].ownerDomain").value("USER"))
                .andExpect(jsonPath("$.items[0].propertyRole").value("AVATAR"));
        String asset = mvc.perform(get(BASE + "/admin/media/assets/" + assetId).with(person("editor", "catalog:read")))
                .andReturn().getResponse().getContentAsString();
        Number assetVersion = JsonPath.read(asset, "$.version");
        mvc.perform(post(BASE + "/admin/media/assets/" + assetId + "/deprecate")
                .with(person("editor", "catalog:read", "media:write")).contentType("application/json")
                .content("{\"expectedVersion\":" + assetVersion + "}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MEDIA_ASSET_IN_USE"));
        mvc.perform(
                put(BASE + "/users/me").with(person(subject)).contentType("application/json").content(profile(1, null)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.avatarAssetId").isEmpty());
        mvc.perform(get(BASE + "/admin/media/assets/" + assetId + "/usages").with(person("editor", "catalog:read")))
                .andExpect(jsonPath("$.items.length()").value(0));
    }

    @Test
    void rejectsMissingOrInvalidUploadedBytes() throws Exception {
        String subject = UUID.randomUUID().toString();
        String ticket = ticket(subject, 4);
        String uploadId = JsonPath.read(ticket, "$.uploadId");
        mvc.perform(post(BASE + "/users/me/avatar-uploads/" + uploadId + "/complete").with(person(subject)))
                .andExpect(status().isUnprocessableEntity());
        try (HttpClient client = HttpClient.newHttpClient()) {
            String url = JsonPath.read(ticket, "$.uploadUrl");
            var put = HttpRequest.newBuilder(URI.create(url)).PUT(HttpRequest.BodyPublishers.ofString("fake"));
            Map<String, String> headers = JsonPath.read(ticket, "$.headers");
            headers.forEach(put::header);
            client.send(put.build(), HttpResponse.BodyHandlers.discarding());
        }
        mvc.perform(post(BASE + "/users/me/avatar-uploads/" + uploadId + "/complete").with(person(subject)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("INVALID_MEDIA_OBJECT"));
    }

    private String ticket(String subject, int size) throws Exception {
        return mvc.perform(post(BASE + "/users/me/avatar-uploads").with(person(subject)).contentType("application/json")
                .content("{\"fileName\":\"avatar.png\",\"contentType\":\"image/png\",\"sizeBytes\":" + size + "}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }
}
