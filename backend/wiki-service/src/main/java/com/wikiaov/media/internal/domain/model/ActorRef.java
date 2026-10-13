package com.wikiaov.media.internal.domain.model;

import java.util.Objects;

/** Who created a record: the verified token's issuer and subject. */
public record ActorRef(
        String issuer,
        String subject
) {

    public ActorRef {
        Objects.requireNonNull(issuer, "issuer");
        Objects.requireNonNull(subject, "subject");
    }
}
