package com.wikiaov.access;

import java.util.Objects;
import java.util.Set;
import org.jspecify.annotations.Nullable;

/**
 * The authenticated caller of a use case.
 *
 * <p>Identity is the pair {@code (issuer, subject)} taken from the verified token, never from the request body.
 *
 * @param issuer       token issuer, e.g. {@code http://localhost:8081/realms/wikiaov}
 * @param subject      stable id of the principal inside that issuer
 * @param type         human or service account
 * @param displayName  optional human-readable name, for display only
 * @param capabilities granted capabilities such as {@code hero:publish}
 */
public record Actor(String issuer, String subject, ActorType type, @Nullable String displayName,
        Set<String> capabilities) {

    public Actor {
        Objects.requireNonNull(issuer, "issuer");
        Objects.requireNonNull(subject, "subject");
        Objects.requireNonNull(type, "type");
        capabilities = Set.copyOf(capabilities);
    }

    public boolean has(String capability) {
        return capabilities.contains(capability);
    }
}
