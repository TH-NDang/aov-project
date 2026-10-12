package com.wikiaov.access.internal.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.wikiaov.access.internal.application.port.IdentityTokens;
import com.wikiaov.platform.ApiException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

class AuthSessionsTest {
    private final IdentityTokens identity = mock(IdentityTokens.class);
    private final JwtDecoder decoder = mock(JwtDecoder.class);
    private final AuthSessions sessions = new AuthSessions(identity, decoder, "wiki-service");
    private final IdentityTokens.Tokens tokens = new IdentityTokens.Tokens("access", 300, "refresh", 1800);

    @Test
    void acceptsVerifiedTokenWithCatalogRead() {
        when(identity.password("editor", "test-password")).thenReturn(tokens);
        when(decoder.decode("access")).thenReturn(jwt(List.of("catalog:read")));
        assertThat(sessions.password("editor", "test-password")).isEqualTo(tokens);
    }

    @Test
    void rejectsAndRevokesAccountWithoutAdminCapability() {
        when(identity.password("reader", "test-password")).thenReturn(tokens);
        when(decoder.decode("access")).thenReturn(jwt(List.of("media:write")));
        assertThatThrownBy(() -> sessions.password("reader", "test-password")).isInstanceOf(ApiException.class);
        verify(identity).revoke("refresh");
    }

    @Test
    void rejectsTokenFailingIssuerAudienceSignatureOrExpiryValidation() {
        when(identity.refresh("previous")).thenReturn(tokens);
        when(decoder.decode("access")).thenThrow(new JwtException("Invalid token"));
        assertThatThrownBy(() -> sessions.refresh("previous")).isInstanceOf(ApiException.class);
        verify(identity).revoke("refresh");
    }

    private Jwt jwt(List<String> roles) {
        return Jwt.withTokenValue("access").header("alg", "RS256").subject("editor")
                .claim("resource_access", Map.of("wiki-service", Map.of("roles", roles))).build();
    }
}
