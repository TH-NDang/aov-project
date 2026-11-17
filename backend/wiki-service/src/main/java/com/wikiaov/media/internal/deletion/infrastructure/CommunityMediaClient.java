package com.wikiaov.media.internal.deletion.infrastructure;

import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.deletion.application.port.CompetitionMediaGuard;
import com.wikiaov.platform.ApiException;
import java.net.URI;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

/** Checks the owning service over HTTP; no cross-database access or background credential reuse. */
@Component
class CommunityMediaClient implements CompetitionMediaGuard {
    private final String base;
    private final RestClient client;

    @Autowired
    CommunityMediaClient(MediaDeletionProperties properties) {
        this(properties, RestClient.builder().requestFactory(CloudflareMediaCache.requestFactory()));
    }

    CommunityMediaClient(MediaDeletionProperties properties, RestClient.Builder builder) {
        URI uri = URI.create(properties.communityBaseUrl());
        if (uri.getHost() == null || uri.getRawUserInfo() != null || uri.getRawQuery() != null
                || uri.getRawFragment() != null || !Set.of("", "/").contains(uri.getPath())
                || !("https".equals(uri.getScheme())
                        || "http".equals(uri.getScheme()) && isPrivateHost(uri.getHost()))) {
            throw new IllegalArgumentException(
                    "Community media checks require HTTPS, or HTTP to a loopback address or a private service name.");
        }
        this.base = properties.communityBaseUrl().replaceAll("/+$", "") + "/api/community/v1/admin/media-assets/";
        this.client = builder.build();
    }

    /** The caller's token travels on this request. A name without dots only resolves on a private network. */
    private static boolean isPrivateHost(String host) {
        return Set.of("127.0.0.1", "::1", "[::1]").contains(host) || host.matches("[A-Za-z0-9-]+");
    }

    @Override
    public void requireUnused(UUID assetId) {
        exchange(assetId, false);
    }

    @Override
    public void retire(UUID assetId) {
        exchange(assetId, true);
    }

    private void exchange(UUID assetId, boolean retire) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (!(auth instanceof JwtAuthenticationToken jwt)) {
            throw unavailable();
        }
        try {
            var result = client.method(retire ? HttpMethod.POST : HttpMethod.GET)
                    .uri(base + assetId + (retire ? "/retire" : "/usage"))
                    .headers(headers -> headers.setBearerAuth(jwt.getToken().getTokenValue()))
                    .retrieve().body(Usage.class);
            if (result == null || !assetId.equals(result.assetId()) || result.references() == null
                    || result.references() < 0 || retire && !Boolean.TRUE.equals(result.retired())) {
                throw unavailable();
            }
            if (result.references() > 0) {
                throw new ApiException(MediaErrorCode.MEDIA_ASSET_IN_USE,
                        "Competition records or publication history still reference this image.",
                        Map.of("competitionUsages", result.references()));
            }
        } catch (RestClientResponseException exception) {
            if (exception.getStatusCode().value() == 409) {
                throw new ApiException(MediaErrorCode.MEDIA_ASSET_IN_USE,
                        "Competition records still reference this image.");
            }
            throw unavailable();
        } catch (RestClientException exception) {
            throw unavailable();
        }
    }

    private static ApiException unavailable() {
        return new ApiException(MediaErrorCode.MEDIA_COMPETITION_CHECK_FAILED,
                "Could not verify competition image usage. Check the community service and tournament permissions.");
    }

    record Usage(
            UUID assetId,
            Long references,
            Boolean retired
    ) {
    }
}
