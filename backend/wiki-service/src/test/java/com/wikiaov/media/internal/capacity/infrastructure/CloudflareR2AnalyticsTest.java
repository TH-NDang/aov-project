package com.wikiaov.media.internal.capacity.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.wikiaov.media.internal.capacity.application.port.R2Analytics;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class CloudflareR2AnalyticsTest {

    private static final Instant FROM = Instant.parse("2026-11-01T00:00:00Z");
    private static final Instant TO = Instant.parse("2026-11-14T10:00:00Z");

    @Test
    void keepsTheLatestStorageOfEachProjectBucketAndSumsOperationsByClass() {
        Map<String, Object> response = Map.of("data", Map.of("viewer", Map.of("accounts", List.of(Map.of(
                "storage", List.of(
                        storage("aov-media-assets", 6888, 1_079_000_000L, 2_000_000L, 0),
                        storage("aov-media-assets", 6000, 900_000_000L, 1_000_000L, 0),
                        storage("aov-media-private", 4, 1_200_000L, 1_000L, 1),
                        storage("someone-else", 1, 5L, 0L, 0)),
                "operations", List.of(
                        operation("aov-media-assets", "PutObject", 10),
                        operation("aov-media-assets", "CopyObject", 5),
                        operation("aov-media-assets", "GetObject", 300),
                        operation("aov-media-private", "HeadObject", 7),
                        operation("aov-media-private", "DeleteObject", 2),
                        operation("someone-else", "PutObject", 1000)))))));

        R2Analytics.Usage usage = CloudflareR2Analytics.parse(response,
                Set.of("aov-media-assets", "aov-media-private", "aov-source-private"), FROM, TO);

        assertThat(usage.state()).isEqualTo(R2Analytics.State.OK);
        assertThat(usage.buckets()).containsExactly(
                new R2Analytics.Bucket("aov-media-assets", 6888, 1_081_000_000L, 0),
                new R2Analytics.Bucket("aov-media-private", 4, 1_201_000L, 1),
                new R2Analytics.Bucket("aov-source-private", 0, 0, 0));
        assertThat(usage.operations()).isEqualTo(new R2Analytics.Operations(FROM, TO, 15, 307, 2));
    }

    @Test
    void graphQlErrorsAreNotTakenForFigures() {
        assertThatThrownBy(() -> CloudflareR2Analytics.parse(Map.of("errors", List.of(Map.of("message", "denied"))),
                Set.of("aov-media-assets"), FROM, TO)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void withoutAccountAndTokenTheFiguresAreNotConfiguredAndNothingIsCalled() {
        var analytics = new CloudflareR2Analytics(new R2AnalyticsProperties("", "", Duration.ofMinutes(15)),
                Clock.fixed(TO, ZoneOffset.UTC));

        assertThat(analytics.read(Set.of("aov-media-assets")).state()).isEqualTo(R2Analytics.State.NOT_CONFIGURED);
    }

    private static Map<String, Object> storage(String bucket, long objects, long payload, long metadata,
            long uploads) {
        return Map.of("dimensions", Map.of("bucketName", bucket, "datetime", TO.toString()), "max",
                Map.of("objectCount", objects, "payloadSize", payload, "metadataSize", metadata, "uploadCount",
                        uploads));
    }

    private static Map<String, Object> operation(String bucket, String action, long requests) {
        return Map.of("dimensions", Map.of("bucketName", bucket, "actionType", action), "sum",
                Map.of("requests", requests));
    }
}
