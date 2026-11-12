package com.wikiaov.user.internal.account.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withBadRequest;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withNoContent;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withResourceNotFound;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withUnauthorizedRequest;

import com.wikiaov.platform.ApiException;
import com.wikiaov.user.internal.application.UserErrorCode;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class KeycloakIdentityAccountsTest {
    private static final String ISSUER = "http://keycloak.test/realms/test";
    private static final String ADMIN = "http://keycloak.test/admin/realms/test";
    private static final String TOKEN = ISSUER + "/protocol/openid-connect/token";
    private final RestClient.Builder builder = RestClient.builder();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();

    private KeycloakIdentityAccounts accounts(String secret) {
        return new KeycloakIdentityAccounts(new KeycloakAccountProperties("wiki-service", secret), ISSUER,
                Clock.systemUTC(), builder);
    }

    private void expectServiceToken(String token) {
        server.expect(requestTo(TOKEN)).andExpect(method(HttpMethod.POST))
                .andExpect(content().formDataContains(Map.of("grant_type", "client_credentials",
                        "client_id", "wiki-service", "client_secret", "test-secret")))
                .andRespond(withSuccess("{\"access_token\":\"" + token + "\",\"expires_in\":300}",
                        MediaType.APPLICATION_JSON));
    }

    @Test
    void readsAccountStateWithoutSecretsAndReusesTheServiceToken() {
        var accounts = accounts("test-secret");
        expectServiceToken("service");
        server.expect(requestTo(ADMIN + "/users/user-1")).andExpect(header("Authorization", "Bearer service"))
                .andRespond(withSuccess("{\"id\":\"user-1\",\"email\":\"reader@example.com\",\"emailVerified\":true}",
                        MediaType.APPLICATION_JSON));
        server.expect(requestTo(ADMIN + "/users/user-1/credentials"))
                .andExpect(header("Authorization", "Bearer service"))
                .andRespond(withSuccess("""
                        [{"id":"p","type":"password","createdDate":1794206405768,"credentialData":"{}"},
                         {"id":"o","type":"otp","userLabel":"Phone","createdDate":1794206662605,
                          "credentialData":"{\\"subType\\":\\"totp\\"}"},
                         {"id":"r","type":"recovery-authn-codes","createdDate":1794206672749,
                          "credentialData":"{\\"algorithm\\":\\"SHA-512\\",\\"totalCodes\\":12,\\"remainingCodes\\":11}"}]
                        """, MediaType.APPLICATION_JSON));

        var account = accounts.account("user-1");

        assertThat(account.email()).isEqualTo("reader@example.com");
        assertThat(account.emailVerified()).isTrue();
        assertThat(account.password().updatedAt()).isEqualTo(Instant.ofEpochMilli(1794206405768L));
        assertThat(account.otp()).singleElement().satisfies(otp -> {
            assertThat(otp.id()).isEqualTo("o");
            assertThat(otp.label()).isEqualTo("Phone");
        });
        assertThat(account.recoveryCodes().remaining()).isEqualTo(11);
        assertThat(account.recoveryCodes().total()).isEqualTo(12);
        server.verify();
    }

    @Test
    void setsThePasswordAndMapsPolicyRejections() {
        var accounts = accounts("test-secret");
        expectServiceToken("service");
        server.expect(requestTo(ADMIN + "/users/user-1/reset-password")).andExpect(method(HttpMethod.PUT))
                .andExpect(jsonPath("$.type").value("password")).andExpect(jsonPath("$.value").value("new-password-1"))
                .andExpect(jsonPath("$.temporary").value(false)).andRespond(withNoContent());
        server.expect(requestTo(ADMIN + "/users/user-1/reset-password"))
                .andRespond(withBadRequest().contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":\"invalidPasswordMinLengthMessage\",\"error_description\":\"x\"}"));

        accounts.setPassword("user-1", "new-password-1");
        assertThatThrownBy(() -> accounts.setPassword("user-1", "short")).isInstanceOfSatisfying(ApiException.class,
                error -> {
                    assertThat(error.getErrorCode()).isEqualTo(UserErrorCode.USER_PASSWORD_REJECTED);
                    assertThat(error.getContext()).containsEntry("policy", "invalidPasswordMinLengthMessage");
                });
        server.verify();
    }

    @Test
    void listsSessionsAndTreatsMissingSessionsAsSignedOut() {
        var accounts = accounts("test-secret");
        expectServiceToken("service");
        server.expect(requestTo(ADMIN + "/users/user-1/sessions")).andRespond(withSuccess("""
                [{"id":"s1","ipAddress":"203.0.113.10","start":1794206407000,"lastAccess":1794206467000,
                  "clients":{"uuid-1":"aov-wiki","uuid-2":"aov-stream"}}]
                """, MediaType.APPLICATION_JSON));
        server.expect(requestTo(ADMIN + "/sessions/s1")).andExpect(method(HttpMethod.DELETE))
                .andRespond(withResourceNotFound());

        var sessions = accounts.sessions("user-1");
        accounts.signOut("s1");

        assertThat(sessions).singleElement().satisfies(session -> {
            assertThat(session.ipAddress()).isEqualTo("203.0.113.10");
            assertThat(session.lastAccessAt()).isEqualTo(Instant.ofEpochMilli(1794206467000L));
            assertThat(session.clients()).containsExactlyInAnyOrder("aov-wiki", "aov-stream");
        });
        server.verify();
    }

    @Test
    void readsDevicesThroughTokenExchangeAndFailsSoft() {
        var accounts = accounts("test-secret");
        server.expect(requestTo(TOKEN)).andExpect(content().formDataContains(Map.of(
                "grant_type", "urn:ietf:params:oauth:grant-type:token-exchange", "subject_token", "caller-token",
                "audience", "account", "client_id", "wiki-service")))
                .andRespond(withSuccess("{\"access_token\":\"account-token\",\"expires_in\":300}",
                        MediaType.APPLICATION_JSON));
        server.expect(requestTo(ISSUER + "/account/sessions/devices"))
                .andExpect(header("Authorization", "Bearer account-token")).andRespond(withSuccess("""
                        [{"os":"Windows","osVersion":"10","device":"Other","mobile":false,"current":true,
                          "sessions":[{"id":"s1","browser":"Chrome/130.0"}]}]
                        """, MediaType.APPLICATION_JSON));
        server.expect(requestTo(TOKEN)).andRespond(withBadRequest());

        var devices = accounts.devices("caller-token");
        var unavailable = accounts.devices("caller-token");

        assertThat(devices).hasValueSatisfying(map -> assertThat(map.get("s1").browser()).isEqualTo("Chrome/130.0"));
        assertThat(devices.get().get("s1").os()).isEqualTo("Windows");
        assertThat(unavailable).isEmpty();
        server.verify();
    }

    @Test
    void renewsAnExpiredServiceTokenOnce() {
        var accounts = accounts("test-secret");
        expectServiceToken("old");
        server.expect(requestTo(ADMIN + "/users/user-1/sessions")).andRespond(withUnauthorizedRequest());
        expectServiceToken("new");
        server.expect(requestTo(ADMIN + "/users/user-1/sessions")).andExpect(header("Authorization", "Bearer new"))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));

        assertThat(accounts.sessions("user-1")).isEmpty();
        server.verify();
    }

    @Test
    void failsClosedWithoutASecretOrWhenKeycloakFails() {
        var unconfigured = accounts("");
        assertThatThrownBy(() -> unconfigured.account("user-1")).isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getErrorCode()).isEqualTo(UserErrorCode.USER_ACCOUNT_PROVIDER_UNAVAILABLE));
        assertThat(unconfigured.devices("caller-token")).isEmpty();

        var accounts = accounts("test-secret");
        expectServiceToken("service");
        server.expect(requestTo(ADMIN + "/users/user-1/credentials/c1"))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        assertThatThrownBy(() -> accounts.removeCredential("user-1", "c1")).isInstanceOfSatisfying(
                ApiException.class,
                error -> assertThat(error.getErrorCode()).isEqualTo(UserErrorCode.USER_ACCOUNT_PROVIDER_UNAVAILABLE));
        server.verify();
    }
}
