package com.wikiaov.user.internal.account.infrastructure;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.wikiaov.platform.ApiException;
import com.wikiaov.user.internal.account.application.port.IdentityAccounts;
import com.wikiaov.user.internal.application.UserErrorCode;
import java.io.IOException;
import java.io.InputStream;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Keycloak Admin API (service account) and Account API (token exchange) for account security (ADR-028).
 *
 * <p>Request and response bodies are never logged: they carry passwords, tokens and personal data.
 */
@Component
@EnableConfigurationProperties(KeycloakAccountProperties.class)
class KeycloakIdentityAccounts implements IdentityAccounts {
    private static final Logger log = LoggerFactory.getLogger(KeycloakIdentityAccounts.class);
    private static final Pattern ISSUER = Pattern.compile("^(https?://[^/?#]+(?:/[^?#]*)?)/realms/([^/?#]+)$");
    private static final Pattern POLICY_KEY = Pattern.compile("\"error\"\\s*:\\s*\"([A-Za-z]{1,80})\"");
    private static final Pattern REMAINING_CODES = Pattern.compile("\"remainingCodes\"\\s*:\\s*(\\d{1,4})");
    private static final Pattern TOTAL_CODES = Pattern.compile("\"totalCodes\"\\s*:\\s*(\\d{1,4})");
    private static final String TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";
    private final KeycloakAccountProperties properties;
    private final String realmUrl;
    private final String adminUrl;
    private final RestClient client;
    private final Clock clock;
    private volatile @Nullable ServiceToken serviceToken;

    /**
     * @param backchannel realm URL this service calls, which may be a private address of the public issuer
     *                    ({@code wiki.auth.identity-backchannel-uri}, ADR-021)
     */
    @Autowired
    KeycloakIdentityAccounts(KeycloakAccountProperties properties,
            @Value("${wiki.auth.identity-backchannel-uri:${spring.security.oauth2.resourceserver.jwt.issuer-uri}}") String backchannel,
            Clock clock) {
        this(properties, backchannel, clock, RestClient.builder().requestFactory(requestFactory()));
    }

    KeycloakIdentityAccounts(KeycloakAccountProperties properties, String backchannel, Clock clock,
            RestClient.Builder builder) {
        Matcher realm = ISSUER.matcher(backchannel.replaceAll("/+$", ""));
        if (!realm.matches()) {
            throw new IllegalArgumentException("The identity provider address must be a Keycloak realm URL");
        }
        String origin = realm.group(1);
        this.properties = properties;
        this.realmUrl = origin + "/realms/" + realm.group(2);
        this.adminUrl = origin + "/admin/realms/" + realm.group(2);
        this.client = builder.build();
        this.clock = clock;
    }

    static JdkClientHttpRequestFactory requestFactory() {
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER).build());
        factory.setReadTimeout(Duration.ofSeconds(10));
        return factory;
    }

    @Override
    public Account account(String subject) {
        KcUser user = admin(token -> client.get().uri(adminUrl + "/users/{id}", subject)
                .headers(headers -> headers.setBearerAuth(token)).retrieve().body(KcUser.class));
        KcCredential[] credentials = admin(token -> client.get().uri(adminUrl + "/users/{id}/credentials", subject)
                .headers(headers -> headers.setBearerAuth(token)).retrieve().body(KcCredential[].class));
        if (user == null || credentials == null) {
            throw unavailable();
        }

        List<KcCredential> list = Arrays.asList(credentials);
        Password password = list.stream().filter(credential -> "password".equals(credential.type())).findFirst()
                .map(credential -> new Password(instant(credential.createdDate()))).orElse(null);
        List<Otp> otp = list.stream().filter(credential -> "otp".equals(credential.type()) && credential.id() != null)
                .map(credential -> new Otp(credential.id(), blankToNull(credential.userLabel()),
                        instant(credential.createdDate())))
                .toList();
        RecoveryCodes codes = list.stream()
                .filter(credential -> "recovery-authn-codes".equals(credential.type()) && credential.id() != null)
                .findFirst().map(credential -> new RecoveryCodes(credential.id(),
                        number(REMAINING_CODES, credential.credentialData()),
                        number(TOTAL_CODES, credential.credentialData()), instant(credential.createdDate())))
                .orElse(null);
        return new Account(blankToNull(user.email()), Boolean.TRUE.equals(user.emailVerified()), password, otp,
                codes);
    }

    @Override
    public void setPassword(String subject, String password) {
        admin(token -> client.put().uri(adminUrl + "/users/{id}/reset-password", subject)
                .headers(headers -> headers.setBearerAuth(token)).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("type", "password", "value", password, "temporary", false)).retrieve()
                .onStatus(status -> status.value() == 400, (request, response) -> {
                    throw rejected(response.getBody());
                }).toBodilessEntity());
    }

    @Override
    public List<Session> sessions(String subject) {
        KcSession[] sessions = admin(token -> client.get().uri(adminUrl + "/users/{id}/sessions", subject)
                .headers(headers -> headers.setBearerAuth(token)).retrieve().body(KcSession[].class));
        if (sessions == null) {
            throw unavailable();
        }
        return Arrays.stream(sessions).filter(session -> session.id() != null)
                .map(session -> new Session(session.id(), blankToNull(session.ipAddress()),
                        instant(session.start()), instant(session.lastAccess()),
                        session.clients() == null ? List.of() : List.copyOf(session.clients().values())))
                .toList();
    }

    @Override
    public Optional<Map<String, Device>> devices(String callerAccessToken) {
        if (properties.clientSecret().isBlank()) {
            return Optional.empty();
        }
        try {
            var form = new LinkedMultiValueMap<String, String>();
            form.add("grant_type", "urn:ietf:params:oauth:grant-type:token-exchange");
            form.add("client_id", properties.clientId());
            form.add("client_secret", properties.clientSecret());
            form.add("subject_token", callerAccessToken);
            form.add("subject_token_type", TOKEN_TYPE);
            form.add("requested_token_type", TOKEN_TYPE);
            form.add("audience", "account");
            TokenBody exchanged = client.post().uri(realmUrl + "/protocol/openid-connect/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form).retrieve().body(TokenBody.class);
            if (exchanged == null || exchanged.accessToken() == null) {
                return Optional.empty();
            }

            KcDevice[] devices = client.get().uri(realmUrl + "/account/sessions/devices")
                    .accept(MediaType.APPLICATION_JSON)
                    .headers(headers -> headers.setBearerAuth(exchanged.accessToken())).retrieve()
                    .body(KcDevice[].class);
            return Optional.ofNullable(devices).map(KeycloakIdentityAccounts::bySession);
        } catch (RestClientException exception) {
            log.info("Session device details are unavailable: {}", exception.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    @Override
    public void signOut(String sessionId) {
        admin(token -> client.delete().uri(adminUrl + "/sessions/{id}", sessionId)
                .headers(headers -> headers.setBearerAuth(token)).retrieve()
                .onStatus(status -> status.value() == 404, (request, response) -> {
                }).toBodilessEntity());
    }

    @Override
    public void removeCredential(String subject, String credentialId) {
        admin(token -> client.delete().uri(adminUrl + "/users/{id}/credentials/{credential}", subject, credentialId)
                .headers(headers -> headers.setBearerAuth(token)).retrieve()
                .onStatus(status -> status.value() == 404, (request, response) -> {
                }).toBodilessEntity());
    }

    private static Map<String, Device> bySession(KcDevice[] devices) {
        var result = new HashMap<String, Device>();
        for (KcDevice device : devices) {
            if (device == null || device.sessions() == null) {
                continue;
            }
            for (KcDeviceSession session : device.sessions()) {
                if (session != null && session.id() != null) {
                    result.put(session.id(), new Device(blankToNull(session.browser()), blankToNull(device.os()),
                            blankToNull(device.osVersion()), blankToNull(device.device()),
                            Boolean.TRUE.equals(device.mobile())));
                }
            }
        }
        return result;
    }

    /** Runs an Admin API call with the service-account token, renewing it once when Keycloak rejects it. */
    private <T> T admin(Function<String, T> call) {
        if (properties.clientSecret().isBlank()) {
            throw unavailable();
        }
        try {
            try {
                return call.apply(serviceToken());
            } catch (HttpClientErrorException.Unauthorized expired) {
                serviceToken = null;
                return call.apply(serviceToken());
            }
        } catch (RestClientException exception) {
            log.warn("Keycloak account call failed: {}", exception.getClass().getSimpleName());
            throw unavailable();
        }
    }

    private String serviceToken() {
        ServiceToken cached = serviceToken;
        if (cached != null && cached.expiresAt().isAfter(clock.instant().plusSeconds(30))) {
            return cached.value();
        }
        synchronized (this) {
            cached = serviceToken;
            if (cached != null && cached.expiresAt().isAfter(clock.instant().plusSeconds(30))) {
                return cached.value();
            }
            var form = new LinkedMultiValueMap<String, String>();
            form.add("grant_type", "client_credentials");
            form.add("client_id", properties.clientId());
            form.add("client_secret", properties.clientSecret());
            TokenBody body = client.post().uri(realmUrl + "/protocol/openid-connect/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form).retrieve().body(TokenBody.class);
            if (body == null || body.accessToken() == null || body.expiresIn() <= 0) {
                throw unavailable();
            }
            serviceToken = new ServiceToken(body.accessToken(), clock.instant().plusSeconds(body.expiresIn()));
            return body.accessToken();
        }
    }

    private static ApiException rejected(InputStream body) {
        String policy = "invalidPasswordMessage";
        try (body) {
            Matcher matcher = POLICY_KEY.matcher(new String(body.readNBytes(4096), StandardCharsets.UTF_8));
            if (matcher.find()) {
                policy = matcher.group(1);
            }
        } catch (IOException exception) {
            // Keep the generic policy key.
        }
        return new ApiException(UserErrorCode.USER_PASSWORD_REJECTED,
                "The identity provider rejected the password under its password policy.", Map.of("policy", policy));
    }

    private static ApiException unavailable() {
        return new ApiException(UserErrorCode.USER_ACCOUNT_PROVIDER_UNAVAILABLE,
                "The identity provider is unavailable.");
    }

    private static @Nullable Instant instant(@Nullable Long epochMillis) {
        return epochMillis == null || epochMillis <= 0 ? null : Instant.ofEpochMilli(epochMillis);
    }

    private static @Nullable Integer number(Pattern pattern, @Nullable String data) {
        if (data == null) {
            return null;
        }
        Matcher matcher = pattern.matcher(data);
        return matcher.find() ? Integer.valueOf(matcher.group(1)) : null;
    }

    private static @Nullable String blankToNull(@Nullable String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private record ServiceToken(
            String value,
            Instant expiresAt
    ) {
        @Override
        public String toString() {
            return "ServiceToken[redacted]";
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record TokenBody(
            @JsonProperty("access_token") @Nullable String accessToken,
            @JsonProperty("expires_in") long expiresIn
    ) {
        @Override
        public String toString() {
            return "TokenBody[redacted]";
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record KcUser(
            @Nullable String email,
            @Nullable Boolean emailVerified
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record KcCredential(
            @Nullable String id,
            @Nullable String type,
            @Nullable String userLabel,
            @Nullable Long createdDate,
            @Nullable String credentialData
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record KcSession(
            @Nullable String id,
            @Nullable String ipAddress,
            @Nullable Long start,
            @Nullable Long lastAccess,
            @Nullable Map<String, String> clients
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record KcDevice(
            @Nullable String os,
            @Nullable String osVersion,
            @Nullable String device,
            @Nullable Boolean mobile,
            @Nullable List<KcDeviceSession> sessions
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record KcDeviceSession(
            @Nullable String id,
            @Nullable String browser
    ) {
    }
}
