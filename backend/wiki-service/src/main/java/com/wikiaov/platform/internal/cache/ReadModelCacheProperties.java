package com.wikiaov.platform.internal.cache;

import jakarta.validation.constraints.*;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("wiki.read-model-cache")
public record ReadModelCacheProperties(
        @DefaultValue("false") boolean enabled,
        @DefaultValue("wiki:read-model:v1") @Pattern(regexp = "[A-Za-z0-9:_-]{1,96}") String prefix,
        @DefaultValue("2m") Duration publicTtl,
        @DefaultValue("30s") Duration adminTtl,
        @DefaultValue("5s") Duration retryDelay,
        @DefaultValue("8388608") @Min(1024) @Max(16777216) int maxValueBytes
) {
    public ReadModelCacheProperties {
        if (publicTtl == null || publicTtl.isNegative() || publicTtl.isZero()
                || adminTtl == null || adminTtl.isNegative() || adminTtl.isZero()
                || retryDelay == null || retryDelay.isNegative() || retryDelay.isZero())
            throw new IllegalArgumentException("Cache durations must be positive.");
    }
}
