package com.wikiaov.user.internal.account.infrastructure;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Confidential Keycloak client used for account security (ADR-028).
 *
 * @param clientId     client with a service account ({@code view-users}, {@code manage-users}) and standard token
 *                     exchange to the {@code account} audience
 * @param clientSecret server-only secret; blank disables account security calls
 */
@ConfigurationProperties("wiki.account.keycloak")
record KeycloakAccountProperties(
        @DefaultValue("wiki-service") String clientId,
        @DefaultValue("") String clientSecret
) {
    @Override
    public String toString() {
        return "KeycloakAccountProperties[redacted]";
    }
}
