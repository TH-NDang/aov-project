package com.wikiaov.media.internal.deletion.infrastructure;

import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.application.MediaProperties;
import com.wikiaov.media.internal.deletion.application.port.MediaCachePurge;
import com.wikiaov.platform.ApiException;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
@EnableConfigurationProperties(MediaDeletionProperties.class)
class CloudflareMediaCache implements MediaCachePurge {
    private static final Set<String> LOOPBACK = Set.of("localhost", "127.0.0.1", "::1", "[::1]");
    private final MediaDeletionProperties properties;
    private final String publicBase;
    private final RestClient client;

    @Autowired
    CloudflareMediaCache(MediaDeletionProperties properties, MediaProperties media) {
        this(properties, media, RestClient.builder().requestFactory(requestFactory()));
    }

    CloudflareMediaCache(MediaDeletionProperties properties, MediaProperties media, RestClient.Builder builder) {
        this.properties = properties;
        this.publicBase = media.publicBaseUrl().replaceAll("/+$", "");
        this.client = builder.build();
    }

    static JdkClientHttpRequestFactory requestFactory() {
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build());
        factory.setReadTimeout(Duration.ofSeconds(15));
        return factory;
    }

    @Override
    public void requireConfigured() {
        URI base = URI.create(publicBase);
        boolean local = !base.isAbsolute() && publicBase.startsWith("/") && !publicBase.startsWith("//")
                || base.getHost() != null && LOOPBACK.contains(base.getHost());
        if (!properties.cloudflareEnabled() && local)
            return;
        if (!properties.cloudflareEnabled() || !"https".equals(base.getScheme()) || base.getHost() == null
                || base.getRawUserInfo() != null || base.getRawQuery() != null || base.getRawFragment() != null
                || !properties.cloudflareZoneId().matches("[0-9a-fA-F]{32}")
                || properties.cloudflareApiToken().isBlank()) {
            throw new ApiException(MediaErrorCode.MEDIA_CACHE_PURGE_NOT_CONFIGURED,
                    "Configure the Cloudflare zone and a zone-scoped Cache Purge API token before deleting images.");
        }
    }

    @Override
    public void purge(List<String> publicUrls) {
        requireConfigured();
        if (!properties.cloudflareEnabled() || publicUrls.isEmpty())
            return;
        var urls = publicUrls.stream().distinct().toList();
        for (String url : urls) {
            if (!url.startsWith(publicBase + "/") || URI.create(url).getRawQuery() != null
                    || URI.create(url).getRawFragment() != null) {
                throw new ApiException(MediaErrorCode.MEDIA_CACHE_PURGE_FAILED,
                        "Only immutable URLs under the configured media origin may be purged.");
            }
        }

        try {
            for (int start = 0; start < urls.size(); start += 30) {
                var response = client.post()
                        .uri("https://api.cloudflare.com/client/v4/zones/" + properties.cloudflareZoneId()
                                + "/purge_cache")
                        .headers(headers -> headers.setBearerAuth(properties.cloudflareApiToken()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(Map.of("files", urls.subList(start, Math.min(start + 30, urls.size()))))
                        .retrieve().body(PurgeResponse.class);
                if (response == null || !Boolean.TRUE.equals(response.success()))
                    throw failed();
            }
        } catch (RestClientException exception) {
            throw failed();
        }
    }

    private static ApiException failed() {
        return new ApiException(MediaErrorCode.MEDIA_CACHE_PURGE_FAILED,
                "Cloudflare did not accept the cache purge. The deletion can be retried.");
    }

    record PurgeResponse(
            Boolean success
    ) {
    }
}
