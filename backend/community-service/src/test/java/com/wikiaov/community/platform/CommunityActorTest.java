package com.wikiaov.community.platform;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

class CommunityActorTest {
    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void theEditorKeyOfAPersonIsTheirCommunityKey() {
        signIn(token().claim("name", "Editor").build());

        assertThat(CommunityActor.editorKey()).isEqualTo(CommunityActor.require().key());
    }

    @Test
    void theEditorKeyPutsTheIssuerAndTheSubjectOnTwoLines() {
        signIn(token().build());

        assertThat(CommunityActor.editorKey()).isEqualTo("https://identity.example\nsubject-1");
    }

    @Test
    void aServiceAccountHasAnEditorKeyInTheSameForm() {
        signIn(token().claim("client_id", "importer").build());

        assertThat(CommunityActor.editorKey()).isEqualTo("https://identity.example\nsubject-1");
    }

    private static Jwt.Builder token() {
        return Jwt.withTokenValue("token").header("alg", "none").issuer("https://identity.example")
                .subject("subject-1").issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60));
    }

    private static void signIn(Jwt jwt) {
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt, List.of()));
    }
}
