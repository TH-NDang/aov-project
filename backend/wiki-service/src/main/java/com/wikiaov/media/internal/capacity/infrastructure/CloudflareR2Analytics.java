package com.wikiaov.media.internal.capacity.infrastructure;

import com.wikiaov.media.internal.capacity.application.port.R2Analytics;
import com.wikiaov.media.internal.capacity.domain.R2Operations;
import java.net.http.HttpClient;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Reads R2 storage and operation figures from the Cloudflare GraphQL Analytics API. Answers are cached, failures are
 * reported as {@code UNAVAILABLE} and never logged with the token.
 */
@Component
@EnableConfigurationProperties(R2AnalyticsProperties.class)
class CloudflareR2Analytics implements R2Analytics {

    private static final Logger log = LoggerFactory.getLogger(CloudflareR2Analytics.class);
    private static final String ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";
    /** A failed call is not repeated on every page view. */
    private static final Duration FAILURE_TTL = Duration.ofMinutes(1);
    private static final String QUERY = """
            query R2Usage($accountTag: string!, $from: Time!, $to: Time!, $storageFrom: Time!) {
              viewer {
                accounts(filter: {accountTag: $accountTag}) {
                  operations: r2OperationsAdaptiveGroups(limit: 10000,
                      filter: {datetime_geq: $from, datetime_leq: $to}) {
                    sum { requests }
                    dimensions { actionType bucketName }
                  }
                  storage: r2StorageAdaptiveGroups(limit: 10000,
                      filter: {datetime_geq: $storageFrom, datetime_leq: $to}, orderBy: [datetime_DESC]) {
                    max { objectCount uploadCount payloadSize metadataSize }
                    dimensions { bucketName datetime }
                  }
                }
              }
            }
            """;

    private final R2AnalyticsProperties properties;
    private final RestClient client;
    private final Clock clock;
    private @Nullable Cached cached;

    @Autowired
    CloudflareR2Analytics(R2AnalyticsProperties properties, Clock clock) {
        this(properties, clock, RestClient.builder().requestFactory(requestFactory()));
    }

    CloudflareR2Analytics(R2AnalyticsProperties properties, Clock clock, RestClient.Builder builder) {
        this.properties = properties;
        this.clock = clock;
        this.client = builder.build();
    }

    private static JdkClientHttpRequestFactory requestFactory() {
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build());
        factory.setReadTimeout(Duration.ofSeconds(15));
        return factory;
    }

    @Override
    public synchronized Usage read(Set<String> buckets) {
        if (!properties.configured()) {
            return Usage.notConfigured();
        }

        Instant now = clock.instant();
        if (cached != null && cached.buckets().equals(buckets) && now.isBefore(cached.validUntil())) {
            return cached.usage();
        }

        Usage usage;
        try {
            usage = query(buckets, now);
        } catch (RuntimeException ex) {
            // The message may quote the request; keep only the type.
            log.warn("Cloudflare R2 analytics are unavailable: {}", ex.getClass().getSimpleName());
            usage = Usage.unavailable(now);
        }
        Duration ttl = usage.state() == State.OK ? properties.cacheTtl() : FAILURE_TTL;
        cached = new Cached(Set.copyOf(buckets), usage, now.plus(ttl));
        return usage;
    }

    private Usage query(Set<String> buckets, Instant now) {
        Instant from = now.atZone(ZoneOffset.UTC).toLocalDate().withDayOfMonth(1).atStartOfDay(ZoneOffset.UTC)
                .toInstant();
        Map<String, Object> variables = Map.of("accountTag", properties.accountId(), "from", from.toString(), "to",
                now.toString(), "storageFrom", now.minus(2, ChronoUnit.DAYS).toString());

        Map<String, Object> response = client.post()
                .uri(ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .headers(headers -> headers.setBearerAuth(properties.apiToken()))
                .body(Map.of("query", QUERY, "variables", variables))
                .retrieve()
                .body(new ParameterizedTypeReference<Map<String, Object>>() {
                });
        return parse(Objects.requireNonNull(response, "response"), buckets, from, now);
    }

    /** Package-private for tests: turns the GraphQL answer into figures for the given buckets only. */
    static Usage parse(Map<String, Object> response, Set<String> buckets, Instant from, Instant to) {
        if (response.get("errors") instanceof List<?> errors && !errors.isEmpty()) {
            throw new IllegalStateException("Cloudflare analytics returned errors");
        }
        Map<?, ?> account = firstAccount(response);

        Map<String, R2Analytics.Bucket> latest = new LinkedHashMap<>();
        for (Object row : list(account.get("storage"))) {
            Map<?, ?> group = (Map<?, ?>) row;
            String bucket = String.valueOf(map(group.get("dimensions")).get("bucketName"));
            if (!buckets.contains(bucket) || latest.containsKey(bucket)) {
                continue;
            }
            Map<?, ?> max = map(group.get("max"));
            latest.put(bucket, new R2Analytics.Bucket(bucket, number(max.get("objectCount")),
                    number(max.get("payloadSize")) + number(max.get("metadataSize")), number(max.get("uploadCount"))));
        }

        long classA = 0;
        long classB = 0;
        long free = 0;
        for (Object row : list(account.get("operations"))) {
            Map<?, ?> group = (Map<?, ?>) row;
            Map<?, ?> dimensions = map(group.get("dimensions"));
            if (!buckets.contains(String.valueOf(dimensions.get("bucketName")))) {
                continue;
            }
            long requests = number(map(group.get("sum")).get("requests"));
            switch (R2Operations.classify(String.valueOf(dimensions.get("actionType")))) {
                case CLASS_A -> classA += requests;
                case CLASS_B -> classB += requests;
                case FREE -> free += requests;
            }
        }

        List<R2Analytics.Bucket> ordered = new ArrayList<>();
        for (String bucket : new HashSet<>(buckets).stream().sorted().toList()) {
            ordered.add(latest.getOrDefault(bucket, new R2Analytics.Bucket(bucket, 0, 0, 0)));
        }
        return new Usage(State.OK, to, ordered, new R2Analytics.Operations(from, to, classA, classB, free));
    }

    private static Map<?, ?> firstAccount(Map<String, Object> response) {
        List<?> accounts = list(map(map(response.get("data")).get("viewer")).get("accounts"));
        if (accounts.isEmpty()) {
            throw new IllegalStateException("Cloudflare analytics returned no account");
        }
        return map(accounts.getFirst());
    }

    private static Map<?, ?> map(@Nullable Object value) {
        return value instanceof Map<?, ?> map ? map : Map.of();
    }

    private static List<?> list(@Nullable Object value) {
        return value instanceof List<?> list ? list : List.of();
    }

    private static long number(@Nullable Object value) {
        return value instanceof Number number ? number.longValue() : 0;
    }

    private record Cached(
            Set<String> buckets,
            Usage usage,
            Instant validUntil
    ) {
    }
}
