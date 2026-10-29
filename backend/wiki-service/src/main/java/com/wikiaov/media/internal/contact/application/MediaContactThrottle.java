package com.wikiaov.media.internal.contact.application;

import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.platform.ApiException;
import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import org.springframework.stereotype.Component;

/** Bounded, per-process submission guard. Proxy headers are deliberately not trusted. */
@Component
public class MediaContactThrottle {
    private final Clock clock;
    private final LinkedHashMap<String, Window> windows = new LinkedHashMap<>();

    public MediaContactThrottle(Clock clock) {
        this.clock = clock;
    }

    public synchronized void check(String address) {
        var now = clock.instant();
        windows.entrySet().removeIf(entry -> !entry.getValue().expiresAt().isAfter(now));
        var window = windows.get(address);
        if (window != null && window.count() >= 5) {
            throw new ApiException(MediaErrorCode.MEDIA_CONTACT_RATE_LIMITED,
                    "Please wait before submitting another request.");
        }
        if (window == null && windows.size() >= 10000) {
            throw new ApiException(MediaErrorCode.MEDIA_CONTACT_RATE_LIMITED, "Please try again later.");
        }
        windows.put(address,
                window == null
                        ? new Window(now.plusSeconds(600), 1)
                        : new Window(window.expiresAt(), window.count() + 1));
    }

    private record Window(
            Instant expiresAt,
            int count
    ) {
    }
}
