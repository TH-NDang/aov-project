package com.wikiaov.platform.internal.cache;

import static org.assertj.core.api.Assertions.*;

import com.wikiaov.platform.ReadModelCache.Area;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.lang.reflect.Proxy;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.json.JsonMapper;

class RedisReadModelCacheTest {
    private final FakeRedis redis = new FakeRedis();
    private final FakeEpoch epochs = new FakeEpoch();
    private final SimpleMeterRegistry metrics = new SimpleMeterRegistry();
    private final ReadModelCacheProperties properties = new ReadModelCacheProperties(true, "test:catalog",
            Duration.ofMinutes(2), Duration.ofSeconds(30), Duration.ofMillis(100), 1024);
    private final RedisReadModelCache cache = new RedisReadModelCache(redis, epochs, JsonMapper.builder().build(),
            properties, metrics);

    public record Payload(
            String value
    ) {
    }

    @AfterEach
    void clearTransactionState() {
        TransactionSynchronizationManager.clear();
        metrics.close();
    }

    @Test
    void loadsOnceAndReusesSerializedResultWithTheConfiguredTtl() {
        var loads = new AtomicInteger();
        assertThat(read(Area.PUBLIC_REFERENCES, "VN:vi-VN", loads)).isEqualTo(new Payload("value-1"));
        assertThat(read(Area.PUBLIC_REFERENCES, "VN:vi-VN", loads)).isEqualTo(new Payload("value-1"));

        assertThat(loads).hasValue(1);
        assertThat(redis.writes).hasSize(1);
        assertThat(redis.writes.getFirst().ttl()).isEqualTo(properties.publicTtl());
        assertThat(metrics.get("wiki.read.model.cache").tag("result", "hit").counter().count()).isEqualTo(1);
        assertThat(metrics.get("wiki.read.model.cache").tag("result", "miss").counter().count()).isEqualTo(1);
    }

    @Test
    void isolatesPublicAndAdminAreasAndDifferentCatalogContexts() {
        var loads = new AtomicInteger();
        assertThat(read(Area.PUBLIC_REFERENCES, "VN:vi-VN", loads).value()).isEqualTo("value-1");
        assertThat(read(Area.ADMIN_REFERENCES, "VN:vi-VN", loads).value()).isEqualTo("value-2");
        assertThat(read(Area.PUBLIC_REFERENCES, "TW:zh-TW", loads).value()).isEqualTo("value-3");
        assertThat(read(Area.PUBLIC_TERMS, "VN:vi-VN", loads).value()).isEqualTo("value-4");
        assertThat(read(Area.ADMIN_REFERENCES, "VN:vi-VN", loads).value()).isEqualTo("value-2");

        assertThat(loads).hasValue(4);
        assertThat(redis.writes.stream().map(Write::key)).doesNotHaveDuplicates();
        assertThat(redis.writes.get(1).ttl()).isEqualTo(properties.adminTtl());
    }

    @Test
    void anInFlightOldGenerationCannotPopulateTheNewGeneration() {
        var old = cache.read(Area.PUBLIC_REFERENCES, "VN", Payload.class, () -> {
            epochs.value++;
            return new Payload("old-snapshot");
        });
        assertThat(old.value()).isEqualTo("old-snapshot");

        var loads = new AtomicInteger();
        assertThat(read(Area.PUBLIC_REFERENCES, "VN", loads).value()).isEqualTo("value-1");
        assertThat(read(Area.PUBLIC_REFERENCES, "VN", loads).value()).isEqualTo("value-1");
        assertThat(loads).hasValue(1);
        assertThat(redis.writes.get(0).key()).contains(":PUBLIC_REFERENCES:1:");
        assertThat(redis.writes.get(1).key()).contains(":PUBLIC_REFERENCES:2:");
    }

    @Test
    void redisOutageFallsBackAndBackoffAvoidsRepeatedConnectionAttempts() throws InterruptedException {
        var loads = new AtomicInteger();
        read(Area.PUBLIC_REFERENCES, "VN", loads);
        redis.failReads = true;
        epochs.value++;
        assertThat(read(Area.PUBLIC_REFERENCES, "VN", loads).value()).isEqualTo("value-2");
        int attemptsAfterFailure = redis.reads;
        assertThat(read(Area.PUBLIC_REFERENCES, "VN", loads).value()).isEqualTo("value-3");
        assertThat(redis.reads).isEqualTo(attemptsAfterFailure);

        redis.failReads = false;
        epochs.value++;
        Thread.sleep(125);
        assertThat(read(Area.PUBLIC_REFERENCES, "VN", loads).value()).isEqualTo("value-4");
        assertThat(read(Area.PUBLIC_REFERENCES, "VN", loads).value()).isEqualTo("value-4");
        assertThat(redis.writes.getLast().key()).contains(":PUBLIC_REFERENCES:3:");
        assertThat(loads).hasValue(4);
    }

    @Test
    void redisWriteFailuresDoNotFailTheSuccessfulDatabaseResponse() {
        redis.failWrites = true;
        var loads = new AtomicInteger();
        assertThat(read(Area.PUBLIC_REFERENCES, "VN", loads).value()).isEqualTo("value-1");
        assertThat(read(Area.PUBLIC_REFERENCES, "VN", loads).value()).isEqualTo("value-2");
        assertThat(redis.reads).isEqualTo(1);
    }

    @Test
    void bypassesRedisAndEpochReadsInsideWritableTransactions() {
        TransactionSynchronizationManager.setActualTransactionActive(true);
        TransactionSynchronizationManager.setCurrentTransactionReadOnly(false);
        var loads = new AtomicInteger();

        read(Area.ADMIN_REFERENCES, "draft", loads);
        read(Area.ADMIN_REFERENCES, "draft", loads);

        assertThat(loads).hasValue(2);
        assertThat(redis.reads).isZero();
        assertThat(redis.writes).isEmpty();
        assertThat(epochs.reads).isZero();
    }

    @Test
    void cachesReadOnlyTransactionResultsAndBypassesWhenDisabled() {
        TransactionSynchronizationManager.setActualTransactionActive(true);
        TransactionSynchronizationManager.setCurrentTransactionReadOnly(true);
        var loads = new AtomicInteger();
        read(Area.ADMIN_REFERENCES, "draft", loads);
        read(Area.ADMIN_REFERENCES, "draft", loads);
        assertThat(loads).hasValue(1);

        var disabled = new RedisReadModelCache(redis, epochs, JsonMapper.builder().build(),
                new ReadModelCacheProperties(false, "disabled", properties.publicTtl(), properties.adminTtl(),
                        properties.retryDelay(), properties.maxValueBytes()),
                metrics);
        int epochReads = epochs.reads;
        disabled.read(Area.PUBLIC_REFERENCES, "VN", Payload.class, () -> new Payload("uncached"));
        assertThat(epochs.reads).isEqualTo(epochReads);
        assertThat(redis.writes).hasSize(1);
    }

    @Test
    void doesNotCacheLoaderFailuresOrNullResults() {
        var failure = new IllegalStateException("Database rejected the query");
        assertThatThrownBy(() -> cache.read(Area.PUBLIC_REFERENCES, "VN", Payload.class, () -> {
            throw failure;
        })).isSameAs(failure);
        assertThat(cache.read(Area.PUBLIC_REFERENCES, "VN", Payload.class, () -> null)).isNull();
        assertThat(redis.writes).isEmpty();
        assertThat(read(Area.PUBLIC_REFERENCES, "VN", new AtomicInteger()).value()).isEqualTo("value-1");
    }

    @Test
    void payloadLimitCountsUtf8BytesAndRejectsOversizedCachedValues() {
        var payload = new Payload("\u00e9".repeat(600));
        assertThat(cache.read(Area.PUBLIC_REFERENCES, "VN", Payload.class, () -> payload)).isEqualTo(payload);
        assertThat(redis.writes).isEmpty();

        var loads = new AtomicInteger();
        read(Area.PUBLIC_REFERENCES, "VN", loads);
        redis.values.put(redis.writes.getFirst().key(), "x".repeat(1100));
        assertThat(read(Area.PUBLIC_REFERENCES, "VN", loads).value()).isEqualTo("value-2");
    }

    @Test
    void malformedCachedJsonFallsBackToTheLoader() {
        var loads = new AtomicInteger();
        read(Area.PUBLIC_TERMS, "terms", loads);
        redis.values.put(redis.writes.getFirst().key(), "not-json");
        assertThat(read(Area.PUBLIC_TERMS, "terms", loads).value()).isEqualTo("value-2");
    }

    private Payload read(Area area, String context, AtomicInteger loads) {
        return cache.read(area, context, Payload.class, () -> new Payload("value-" + loads.incrementAndGet()));
    }

    private static class FakeEpoch extends CatalogCacheEpoch {
        long value = 1;
        int reads;
        FakeEpoch() {
            super(null, null);
        }
        @Override
        long current() {
            reads++;
            return value;
        }
    }

    private record Write(
            String key,
            String value,
            Duration ttl
    ) {
    }

    private static class FakeRedis extends StringRedisTemplate {
        final Map<String, String> values = new HashMap<>();
        final List<Write> writes = new ArrayList<>();
        boolean failReads;
        boolean failWrites;
        int reads;
        @Override
        @SuppressWarnings("unchecked")
        public ValueOperations<String, String> opsForValue() {
            return (ValueOperations<String, String>) Proxy.newProxyInstance(ValueOperations.class.getClassLoader(),
                    new Class<?>[] {ValueOperations.class}, (proxy, method, args) -> {
                        if (method.getName().equals("get")) {
                            reads++;
                            if (failReads)
                                throw new RedisConnectionFailureException("Redis is offline");
                            return values.get(args[0]);
                        }
                        if (method.getName().equals("set")) {
                            if (failWrites)
                                throw new RedisConnectionFailureException("Redis is offline");
                            writes.add(new Write((String) args[0], (String) args[1], (Duration) args[2]));
                            values.put((String) args[0], (String) args[1]);
                            return null;
                        }
                        throw new UnsupportedOperationException(method.getName());
                    });
        }
    }
}
