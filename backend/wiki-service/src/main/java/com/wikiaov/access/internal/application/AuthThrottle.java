package com.wikiaov.access.internal.application;

import com.wikiaov.platform.ApiException;
import java.time.Clock;
import java.util.HashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Bounded per-instance limiter; a trusted edge should additionally enforce distributed IP limits. */
@Component
public class AuthThrottle {
    private final Clock clock;
    private final Map<String, Window> windows = new HashMap<>();

    public AuthThrottle() {
        this(Clock.systemUTC());
    }

    AuthThrottle(Clock clock) {
        this.clock = clock;
    }

    public synchronized void check(String key, int limit) {
        long now = clock.millis();
        windows.entrySet().removeIf(entry -> entry.getValue().until <= now);
        Window window = windows.get(key);
        if (window == null) {
            if (windows.size() >= 10000)
                throw limited();
            window = new Window(now + 60000);
            windows.put(key, window);
        }
        if (++window.count > limit)
            throw limited();
    }

    private ApiException limited() {
        return new ApiException(AuthErrorCode.AUTH_RATE_LIMITED, "Too many authentication attempts. Try again later.");
    }

    private static class Window {
        private final long until;
        private int count;

        Window(long until) {
            this.until = until;
        }
    }
}
