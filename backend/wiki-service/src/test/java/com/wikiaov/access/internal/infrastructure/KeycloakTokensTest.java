package com.wikiaov.access.internal.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.sun.net.httpserver.HttpServer;
import com.wikiaov.access.internal.application.AuthProperties;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class KeycloakTokensTest {
    private static final String PUBLIC_ISSUER = "https://wiki.example.test/idp/realms/wikiaov";
    private static final String TOKENS = """
            {"access_token":"access","expires_in":300,"refresh_token":"refresh","refresh_expires_in":1800}""";

    private final List<String> calledPaths = new ArrayList<>();
    private HttpServer provider;
    private KeycloakTokens tokens;

    @BeforeEach
    void startProviderOnAPrivateAddress() throws IOException {
        provider = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        provider.createContext("/", exchange -> {
            calledPaths.add(exchange.getRequestURI().getPath());
            byte[] body = TOKENS.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        provider.start();
        var properties = new AuthProperties("https://wiki.example.test", "/admin/", "client", "secret", true, false,
                "/api/wiki/v1/auth/google/callback");
        var backchannel = "http://127.0.0.1:" + provider.getAddress().getPort() + "/idp/realms/wikiaov/";
        tokens = new KeycloakTokens(properties, PUBLIC_ISSUER, backchannel);
    }

    @AfterEach
    void stopProvider() {
        provider.stop(0);
    }

    @Test
    void serverToServerCallsUseTheBackchannel() {
        var issued = tokens.password("editor", "password");
        tokens.revoke(issued.refreshToken());

        assertThat(issued.accessToken()).isEqualTo("access");
        assertThat(calledPaths).containsExactly("/idp/realms/wikiaov/protocol/openid-connect/token",
                "/idp/realms/wikiaov/protocol/openid-connect/revoke");
    }

    @Test
    void browsersAreSentToThePublicIssuer() {
        var url = tokens.authorizationUrl("state", "challenge", "https://wiki.example.test/callback");

        assertThat(url).startsWith(PUBLIC_ISSUER + "/protocol/openid-connect/auth?");
        assertThat(calledPaths).isEmpty();
    }
}
