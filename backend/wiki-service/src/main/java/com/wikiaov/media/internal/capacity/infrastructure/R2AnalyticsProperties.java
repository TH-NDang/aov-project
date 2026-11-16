package com.wikiaov.media.internal.capacity.infrastructure;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Optional Cloudflare GraphQL Analytics access ({@code wiki.storage.analytics.*}, ADR-030 section 9). The token needs
 * only the "Account Analytics: Read" permission and never leaves the backend.
 *
 * @param accountId Cloudflare account id; empty disables the analytics
 * @param apiToken  read-only analytics token; empty disables the analytics
 * @param cacheTtl  how long one answer is reused
 */
@ConfigurationProperties("wiki.storage.analytics")
record R2AnalyticsProperties(
        @DefaultValue("") String accountId,
        @DefaultValue("") String apiToken,
        @DefaultValue("15m") Duration cacheTtl
) {

    boolean configured() {
        return accountId.matches("[0-9a-fA-F]{32}") && !apiToken.isBlank();
    }

    @Override
    public String toString() {
        return "R2AnalyticsProperties[accountId=" + accountId + ", token=redacted, cacheTtl=" + cacheTtl + "]";
    }
}
