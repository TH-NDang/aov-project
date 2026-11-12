package com.wikiaov.user.internal.account.application.port;

import java.util.Optional;

/** Identity-provider session behind the current request's bearer token. */
public interface CallerSession {
    /** The token's {@code sid} claim, when the provider issued one. */
    Optional<String> sessionId();

    /** The verified bearer token of the current request, used only for calls made on the caller's behalf. */
    String accessToken();
}
