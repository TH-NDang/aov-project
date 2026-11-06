package com.wikiaov.media.internal.deletion.infrastructure;

import com.wikiaov.media.internal.query.application.port.CompetitionMediaReferences;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Asks with the actor's own token, as the deletion guard does; a failed answer only leaves competition unchecked. Each
 * actor's answer is kept for a moment, since what they may read decides it and a scrolling list asks page after page.
 */
@Component
class CommunityMediaReferences implements CompetitionMediaReferences {
    private final String url;
    private final RestClient client;
    private final Clock clock;
    private final Duration lifetime;
    private final Map<String, Answer> answers = new ConcurrentHashMap<>();

    @Autowired
    CommunityMediaReferences(MediaDeletionProperties properties, Clock clock,
            @Value("${wiki.media.usage-report-lifetime:1m}") Duration lifetime) {
        this(properties, RestClient.builder().requestFactory(CloudflareMediaCache.requestFactory()), clock, lifetime);
    }

    CommunityMediaReferences(MediaDeletionProperties properties, RestClient.Builder builder, Clock clock,
            Duration lifetime) {
        this.url = properties.communityBaseUrl().replaceAll("/+$", "")
                + "/api/community/v1/admin/media-assets/references";
        this.client = builder.build();
        this.clock = clock;
        this.lifetime = lifetime;
    }

    @Override
    public Optional<Map<UUID, Long>> references() {
        if (!(SecurityContextHolder.getContext().getAuthentication() instanceof JwtAuthenticationToken jwt))
            return Optional.empty();

        var now = clock.instant();
        answers.values().removeIf(answer -> !now.isBefore(answer.expires()));

        return answers.computeIfAbsent(jwt.getName(), actor -> new Answer(read(jwt), now.plus(lifetime))).references();
    }

    private Optional<Map<UUID, Long>> read(JwtAuthenticationToken jwt) {
        try {
            var result = client.get().uri(url)
                    .headers(headers -> headers.setBearerAuth(jwt.getToken().getTokenValue()))
                    .retrieve().body(References.class);
            return result == null || result.references() == null ? Optional.empty() : Optional.of(result.references());
        } catch (RestClientException exception) {
            return Optional.empty();
        }
    }

    private record Answer(
            Optional<Map<UUID, Long>> references,
            Instant expires
    ) {
    }

    record References(
            Map<UUID, Long> references
    ) {
    }
}
