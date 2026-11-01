package com.wikiaov.media.internal.deletion.infrastructure;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties("wiki.media.deletion")
public record MediaDeletionProperties(
        @DefaultValue("false") boolean cloudflareEnabled,
        @DefaultValue("") String cloudflareZoneId,
        @DefaultValue("") String cloudflareApiToken,
        @DefaultValue("http://localhost:8082") String communityBaseUrl
) {
    @Override
    public String toString() {
        return "MediaDeletionProperties[cloudflareEnabled=" + cloudflareEnabled + ", credentials=redacted]";
    }
}
