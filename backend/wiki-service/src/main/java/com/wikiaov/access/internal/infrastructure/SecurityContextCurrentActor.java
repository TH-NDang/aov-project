package com.wikiaov.access.internal.infrastructure;

import com.wikiaov.access.Actor;
import com.wikiaov.access.ActorType;
import com.wikiaov.access.CurrentActor;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/** Builds the {@link Actor} from the verified JWT of the current request. */
@Component
class SecurityContextCurrentActor implements CurrentActor {

    private static final String SERVICE_ACCOUNT_PREFIX = "service-account-";

    @Override
    public Optional<Actor> find() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken token) || !token.isAuthenticated()) {
            return Optional.empty();
        }
        return Optional.of(toActor(token));
    }

    @Override
    public Actor require() {
        return find().orElseThrow(
                () -> new AuthenticationCredentialsNotFoundException("No authenticated actor for this request."));
    }

    static Actor toActor(JwtAuthenticationToken token) {
        Jwt jwt = token.getToken();
        String issuer = jwt.getIssuer() != null ? jwt.getIssuer().toString() : "unknown";
        String username = jwt.getClaimAsString("preferred_username");
        Set<String> capabilities = token.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toUnmodifiableSet());
        return new Actor(issuer, jwt.getSubject(), typeOf(jwt, username), displayName(jwt, username), capabilities);
    }

    /** Keycloak marks client-credentials tokens with a client_id claim and a service-account-* username. */
    private static ActorType typeOf(Jwt jwt, String username) {
        boolean serviceAccount = jwt.hasClaim("client_id")
                || (username != null && username.startsWith(SERVICE_ACCOUNT_PREFIX));
        return serviceAccount ? ActorType.SERVICE : ActorType.HUMAN;
    }

    private static String displayName(Jwt jwt, String username) {
        String name = jwt.getClaimAsString("name");
        return name != null ? name : username;
    }
}
