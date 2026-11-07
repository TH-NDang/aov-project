package com.wikiaov.access.internal.infrastructure;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.wikiaov.access.internal.application.AuthErrorCode;
import com.wikiaov.access.internal.application.AuthProperties;
import com.wikiaov.access.internal.application.port.IdentityTokens;
import com.wikiaov.platform.ApiException;
import java.io.IOException;
import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

@Component
@EnableConfigurationProperties(AuthProperties.class)
class KeycloakTokens implements IdentityTokens {
    private static final JsonMapper JSON = JsonMapper.builder().build();

    private final AuthProperties properties;
    private final String issuer;
    private final String backchannel;
    private final RestClient client;

    /**
     * @param issuer      public issuer; browsers are sent here and tokens carry it
     * @param backchannel where this service calls the provider, which may be a private address of the same realm
     */
    KeycloakTokens(AuthProperties properties,
            @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuer,
            @Value("${wiki.auth.identity-backchannel-uri:${spring.security.oauth2.resourceserver.jwt.issuer-uri}}") String backchannel) {
        this.properties = properties;
        this.issuer = issuer.replaceAll("/+$", "");
        this.backchannel = backchannel.replaceAll("/+$", "");
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build());
        factory.setReadTimeout(Duration.ofSeconds(10));
        this.client = RestClient.builder().requestFactory(factory).build();
    }

    public Tokens password(String username, String password) {
        var form = form("password");
        form.add("username", username);
        form.add("password", password);
        form.add("scope", "openid");
        return exchange(form, AuthErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    public Tokens refresh(String refreshToken) {
        var form = form("refresh_token");
        form.add("refresh_token", refreshToken);
        return exchange(form, AuthErrorCode.AUTH_SESSION_EXPIRED);
    }

    public Tokens code(String code, String verifier, String redirectUri) {
        var form = form("authorization_code");
        form.add("code", code);
        form.add("code_verifier", verifier);
        form.add("redirect_uri", redirectUri);
        return exchange(form, AuthErrorCode.AUTH_INVALID_STATE);
    }

    public void revoke(String refreshToken) {
        var form = form(null);
        form.add("token", refreshToken);
        form.add("token_type_hint", "refresh_token");
        try {
            client.post().uri(backchannel + "/protocol/openid-connect/revoke")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form).retrieve().toBodilessEntity();
        } catch (RestClientException exception) {
            throw unavailable();
        }
    }

    public String authorizationUrl(String state, String challenge, String redirectUri) {
        return UriComponentsBuilder.fromUriString(issuer + "/protocol/openid-connect/auth")
                .queryParam("client_id", properties.clientId()).queryParam("redirect_uri", redirectUri)
                .queryParam("response_type", "code").queryParam("scope", "openid")
                .queryParam("state", state).queryParam("code_challenge", challenge)
                .queryParam("code_challenge_method", "S256").queryParam("kc_idp_hint", "google")
                .build().encode().toUriString();
    }

    private MultiValueMap<String, String> form(String grant) {
        if (properties.clientSecret().isBlank())
            throw unavailable();
        var form = new LinkedMultiValueMap<String, String>();
        form.add("client_id", properties.clientId());
        form.add("client_secret", properties.clientSecret());
        if (grant != null)
            form.add("grant_type", grant);
        return form;
    }

    private Tokens exchange(MultiValueMap<String, String> form, AuthErrorCode rejected) {
        try {
            TokenBody body = client.post().uri(backchannel + "/protocol/openid-connect/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form).retrieve()
                    .onStatus(status -> status.value() == 400 || status.value() == 401, (request, response) -> {
                        if (response.getStatusCode().value() == 401 && !isRejectedGrant(response))
                            throw unavailable();

                        throw new ApiException(rejected, "The identity provider rejected the authentication request.");
                    }).body(TokenBody.class);
            if (body == null || body.accessToken() == null || body.refreshToken() == null
                    || body.expiresIn() <= 0 || body.refreshExpiresIn() <= 0)
                throw unavailable();
            return new Tokens(body.accessToken(), body.expiresIn(), body.refreshToken(), body.refreshExpiresIn());
        } catch (RestClientException exception) {
            // Do not propagate upstream response bodies or request credentials to logs or API errors.
            throw unavailable();
        }
    }

    /** A 401 means a wrong password, the user's to fix, or a wrong client secret, which is ours. */
    private boolean isRejectedGrant(ClientHttpResponse response) throws IOException {
        try {
            return "invalid_grant".equals(JSON.readTree(response.getBody()).path("error").asString());
        } catch (JacksonException exception) {
            return false;
        }
    }

    private ApiException unavailable() {
        return new ApiException(AuthErrorCode.AUTH_PROVIDER_UNAVAILABLE, "The identity provider is unavailable.");
    }

    record TokenBody(
            @JsonProperty("access_token") String accessToken,
            @JsonProperty("expires_in") long expiresIn,
            @JsonProperty("refresh_token") String refreshToken,
            @JsonProperty("refresh_expires_in") long refreshExpiresIn
    ) {
        @Override
        public String toString() {
            return "TokenBody[redacted]";
        }
    }
}
