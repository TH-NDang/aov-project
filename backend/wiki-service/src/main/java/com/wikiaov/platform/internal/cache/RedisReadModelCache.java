package com.wikiaov.platform.internal.cache;

import com.wikiaov.platform.ReadModelCache;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.json.JsonMapper;

/** Cache failures fall back to the loader; loader failures retain their original API semantics. */
@Component
class RedisReadModelCache implements ReadModelCache {
    private static final Logger log = LoggerFactory.getLogger(RedisReadModelCache.class);
    private final StringRedisTemplate redis;
    private final CatalogCacheEpoch epochs;
    private final JsonMapper json;
    private final ReadModelCacheProperties properties;
    private final AtomicLong retryAfter = new AtomicLong();
    private final Object[] locks = new Object[64];
    private final Counter hits, misses, bypasses, failures;

    RedisReadModelCache(StringRedisTemplate redis, CatalogCacheEpoch epochs, JsonMapper json,
            ReadModelCacheProperties properties, MeterRegistry metrics) {
        this.redis = redis;
        this.epochs = epochs;
        this.json = json;
        this.properties = properties;
        for (int i = 0; i < locks.length; i++)
            locks[i] = new Object();
        hits = metrics.counter("wiki.read.model.cache", "result", "hit");
        misses = metrics.counter("wiki.read.model.cache", "result", "miss");
        bypasses = metrics.counter("wiki.read.model.cache", "result", "bypass");
        failures = metrics.counter("wiki.read.model.cache", "result", "error");
    }

    @Override
    public <T> T read(Area area, String context, Class<T> type, Supplier<T> loader) {
        if (!properties.enabled() || System.nanoTime() < retryAfter.get()
                || TransactionSynchronizationManager.isActualTransactionActive()
                        && !TransactionSynchronizationManager.isCurrentTransactionReadOnly()) {
            bypasses.increment();
            return loader.get();
        }
        String key = properties.prefix() + ":" + area.name() + ":" + epochs.current() + ":" + digest(context);
        synchronized (locks[(key.hashCode() & Integer.MAX_VALUE) % locks.length]) {
            T cached = lookup(key, type);
            if (cached != null) {
                hits.increment();
                return cached;
            }
            misses.increment();
            T loaded = loader.get();
            if (loaded != null && System.nanoTime() >= retryAfter.get()) {
                try {
                    String value = json.writeValueAsString(loaded);
                    if (value.getBytes(StandardCharsets.UTF_8).length <= properties.maxValueBytes()) {
                        Duration ttl = area == Area.ADMIN_REFERENCES ? properties.adminTtl() : properties.publicTtl();
                        redis.opsForValue().set(key, value, ttl);
                    }
                } catch (RuntimeException error) {
                    unavailable(error);
                }
            }
            return loaded;
        }
    }

    private <T> T lookup(String key, Class<T> type) {
        try {
            String value = redis.opsForValue().get(key);
            if (value == null || value.getBytes(StandardCharsets.UTF_8).length > properties.maxValueBytes())
                return null;
            return json.readValue(value, type);
        } catch (RuntimeException error) {
            unavailable(error);
            return null;
        }
    }

    private void unavailable(RuntimeException error) {
        failures.increment();
        long now = System.nanoTime();
        long previous = retryAfter.getAndSet(now + properties.retryDelay().toNanos());
        if (previous <= now)
            log.warn("Read-model Redis cache unavailable; using database loader ({})",
                    error.getClass().getSimpleName());
    }

    private String digest(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException(error);
        }
    }
}
