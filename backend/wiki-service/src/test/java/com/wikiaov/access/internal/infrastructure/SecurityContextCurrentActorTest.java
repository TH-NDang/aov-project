package com.wikiaov.access.internal.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.wikiaov.access.Actor;
import com.wikiaov.access.ActorType;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

class SecurityContextCurrentActorTest {

    private final SecurityContextCurrentActor currentActor = new SecurityContextCurrentActor();

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void anonymousRequestHasNoActor() {
        assertThat(currentActor.find()).isEmpty();
        assertThatThrownBy(currentActor::require).isInstanceOf(AuthenticationCredentialsNotFoundException.class);
    }

    @Test
    void humanActorComesFromIssuerSubjectAndAuthorities() {
        authenticate(Jwt.withTokenValue("t").header("alg", "none")
                .issuer("http://localhost:8081/realms/wikiaov").subject("user-1")
                .claim("preferred_username", "editor").claim("name", "Editor Local").build());

        Actor actor = currentActor.require();

        assertThat(actor.issuer()).isEqualTo("http://localhost:8081/realms/wikiaov");
        assertThat(actor.subject()).isEqualTo("user-1");
        assertThat(actor.type()).isEqualTo(ActorType.HUMAN);
        assertThat(actor.displayName()).isEqualTo("Editor Local");
        assertThat(actor.has("hero:write")).isTrue();
        assertThat(actor.has("hero:publish")).isFalse();
    }

    @Test
    void clientCredentialsTokenIsServiceActor() {
        authenticate(Jwt.withTokenValue("t").header("alg", "none")
                .issuer("http://localhost:8081/realms/wikiaov").subject("sa-1")
                .claim("preferred_username", "service-account-wiki-importer")
                .claim("client_id", "wiki-importer").build());

        assertThat(currentActor.require().type()).isEqualTo(ActorType.SERVICE);
    }

    private static void authenticate(Jwt jwt) {
        SecurityContextHolder.getContext().setAuthentication(
                new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("hero:write")), jwt.getSubject()));
    }
}
