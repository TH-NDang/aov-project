package com.wikiaov.access.internal.application;

import com.wikiaov.platform.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

/** One-time PKCE state, bound to an HttpOnly browser cookie and expiring after five minutes. */
@Component
public class GoogleLoginFlows {
    private final Map<String, Flow> flows = new HashMap<>();
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public GoogleLoginFlows() {
        this(Clock.systemUTC());
    }
    GoogleLoginFlows(Clock clock) {
        this.clock = clock;
    }

    public synchronized Flow start() {
        flows.entrySet().removeIf(entry -> entry.getValue().expiresAt() <= clock.millis());
        if (flows.size() >= 1000)
            throw new ApiException(AuthErrorCode.AUTH_RATE_LIMITED, "Too many pending login flows.");
        Flow flow = new Flow(secret(), secret(), secret(), clock.millis() + 300000);
        flows.put(flow.state(), flow);
        return flow;
    }

    public synchronized Flow consume(String state, String binding) {
        Flow flow = flows.get(state);
        if (flow == null || flow.expiresAt() <= clock.millis() || binding == null
                || !MessageDigest.isEqual(flow.binding().getBytes(StandardCharsets.UTF_8),
                        binding.getBytes(StandardCharsets.UTF_8))) {
            throw new ApiException(AuthErrorCode.AUTH_INVALID_STATE, "The login state is invalid or expired.");
        }
        flows.remove(state);
        return flow;
    }

    private String secret() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public record Flow(
            String state,
            String verifier,
            String binding,
            long expiresAt
    ) {
        public String challenge() {
            try {
                return Base64.getUrlEncoder().withoutPadding().encodeToString(
                        MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII)));
            } catch (NoSuchAlgorithmException exception) {
                throw new IllegalStateException(exception);
            }
        }
        @Override
        public String toString() {
            return "Flow[redacted]";
        }
    }
}
