package com.wikiaov.access.internal.infrastructure;

import com.wikiaov.access.Actor;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

final class AcceptedCommandAuthentication extends AbstractAuthenticationToken {
    private final Actor actor;

    AcceptedCommandAuthentication(Actor actor) {
        super(actor.capabilities().stream().map(SimpleGrantedAuthority::new).toList());
        this.actor = actor;
        setAuthenticated(true);
    }

    @Override
    public Actor getPrincipal() {
        return actor;
    }

    @Override
    public Object getCredentials() {
        return "";
    }
}
