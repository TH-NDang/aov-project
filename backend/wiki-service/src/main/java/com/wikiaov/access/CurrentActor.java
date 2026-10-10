package com.wikiaov.access;

import java.util.Optional;

/** Port that gives application code the caller of the current request without touching Spring Security. */
public interface CurrentActor {

    /** Returns the authenticated actor, or empty for anonymous requests. */
    Optional<Actor> find();

    /**
     * Returns the authenticated actor.
     *
     * @throws org.springframework.security.core.AuthenticationException if the request is anonymous
     */
    Actor require();
}
