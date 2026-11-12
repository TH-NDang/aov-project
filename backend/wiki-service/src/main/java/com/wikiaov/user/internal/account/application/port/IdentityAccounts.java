package com.wikiaov.user.internal.account.application.port;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.jspecify.annotations.Nullable;

/**
 * Account data owned by the identity provider (Keycloak). Implementations never return secrets, password hashes or
 * tokens, and throw {@code USER_ACCOUNT_PROVIDER_UNAVAILABLE} when the provider cannot be reached or is not configured.
 */
public interface IdentityAccounts {
    Account account(String subject);

    /**
     * Replaces the account password.
     *
     * @throws com.wikiaov.platform.ApiException {@code USER_PASSWORD_REJECTED} when the password policy refuses it
     */
    void setPassword(String subject, String password);

    List<Session> sessions(String subject);

    /**
     * Browser and operating system per session id, read on behalf of the caller. Empty when the provider cannot
     * supply device details; callers must still work with {@link #sessions(String)} alone.
     */
    Optional<Map<String, Device>> devices(String callerAccessToken);

    /** Ends one session. A session that no longer exists is treated as already ended. */
    void signOut(String sessionId);

    /** Removes one credential. A credential that no longer exists is treated as already removed. */
    void removeCredential(String subject, String credentialId);

    record Account(
            @Nullable String email,
            boolean emailVerified,
            @Nullable Password password,
            List<Otp> otp,
            @Nullable RecoveryCodes recoveryCodes
    ) {
        public Account {
            otp = List.copyOf(otp);
        }
    }

    record Password(
            @Nullable Instant updatedAt
    ) {
    }

    record Otp(
            String id,
            @Nullable String label,
            @Nullable Instant createdAt
    ) {
    }

    record RecoveryCodes(
            String id,
            @Nullable Integer remaining,
            @Nullable Integer total,
            @Nullable Instant createdAt
    ) {
    }

    record Session(
            String id,
            @Nullable String ipAddress,
            @Nullable Instant startedAt,
            @Nullable Instant lastAccessAt,
            List<String> clients
    ) {
        public Session {
            clients = List.copyOf(clients);
        }
    }

    record Device(
            @Nullable String browser,
            @Nullable String os,
            @Nullable String osVersion,
            @Nullable String device,
            boolean mobile
    ) {
    }
}
