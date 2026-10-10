package com.wikiaov.access.internal.infrastructure;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Settings for mapping tokens to capabilities.
 *
 * @param resourceClientId client id whose client roles are read from {@code resource_access} in the token
 */
@ConfigurationProperties("wiki.security")
record AccessProperties(@DefaultValue("wiki-service") String resourceClientId) {
}
