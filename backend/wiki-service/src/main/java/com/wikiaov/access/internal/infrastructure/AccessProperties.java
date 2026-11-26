package com.wikiaov.access.internal.infrastructure;

import java.util.Set;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Settings for mapping tokens to capabilities.
 *
 * @param resourceClientId  client id whose client roles are read from {@code resource_access} in the token
 * @param capabilityClients clients ({@code azp}) whose tokens carry capabilities. Tokens of the public Wiki and Stream
 *                          share the origin with user content, so they sign the user in without any capability.
 */
@ConfigurationProperties("wiki.security")
record AccessProperties(
        @DefaultValue("wiki-service") String resourceClientId,
        @DefaultValue({
                "admin-aov-backend", "wiki-importer"}) Set<String> capabilityClients
) {
}
