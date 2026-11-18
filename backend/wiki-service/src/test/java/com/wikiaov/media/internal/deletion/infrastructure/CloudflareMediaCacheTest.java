package com.wikiaov.media.internal.deletion.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.application.MediaProperties;
import com.wikiaov.platform.ApiException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.util.unit.DataSize;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

class CloudflareMediaCacheTest {
    private static final String BASE = "https://images.example/assets";
    private static final String ZONE = "a".repeat(32);
    private static final String ENDPOINT = "https://api.cloudflare.com/client/v4/zones/" + ZONE + "/purge_cache";

    @Test
    void purgesOnlySpecifiedUrlsInBoundedBatches() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var urls = IntStream.range(0, 41).mapToObj(i -> BASE + "/image-" + i + ".png").toList();
        var json = JsonMapper.builder().build();
        for (var batch : List.of(urls.subList(0, 30), urls.subList(30, 41))) {
            server.expect(requestTo(ENDPOINT)).andExpect(method(HttpMethod.POST))
                    .andExpect(header("Authorization", "Bearer test-purge-token"))
                    .andExpect(content().json(json.writeValueAsString(Map.of("files", batch))))
                    .andRespond(withSuccess("{\"success\":true}", MediaType.APPLICATION_JSON));
        }
        new CloudflareMediaCache(config(true), media(BASE), builder).purge(urls);
        server.verify();
    }

    @Test
    void publicCdnCannotSilentlySkipPurgeWhenCredentialsAreMissing() {
        var cache = new CloudflareMediaCache(config(false), media(BASE), RestClient.builder());
        assertThatThrownBy(cache::requireConfigured).isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getErrorCode()).isEqualTo(MediaErrorCode.MEDIA_CACHE_PURGE_NOT_CONFIGURED));
        assertThatCode(() -> new CloudflareMediaCache(config(false), media("/media"), RestClient.builder())
                .purge(List.of("/media/test.png"))).doesNotThrowAnyException();
    }

    @Test
    void rejectsForeignUrlsAndCloudflareUnsuccessfulResponses() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var cache = new CloudflareMediaCache(config(true), media(BASE), builder);
        assertThatThrownBy(() -> cache.purge(List.of("https://another.example/image.png")))
                .isInstanceOf(ApiException.class);
        server.expect(requestTo(ENDPOINT)).andRespond(withSuccess("{\"success\":false}", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> cache.purge(List.of(BASE + "/image.png")))
                .isInstanceOfSatisfying(ApiException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(MediaErrorCode.MEDIA_CACHE_PURGE_FAILED));
        server.verify();
        assertThat(config(true).toString()).doesNotContain("test-purge-token");
    }

    static MediaDeletionProperties config(boolean enabled) {
        return new MediaDeletionProperties(enabled, ZONE, "test-purge-token", "http://localhost:8082");
    }

    static MediaProperties media(String base) {
        return new MediaProperties(DataSize.ofMegabytes(25), 40000000, 16384, Duration.ofMinutes(15),
                Duration.ofHours(1), Duration.ofMinutes(5), base);
    }
}
