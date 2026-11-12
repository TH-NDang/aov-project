package com.wikiaov.user.internal.account.application.response;

import java.time.Instant;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** Identity-provider sessions of the caller; the current one comes first. */
public record SessionList(
        List<Session> sessions,
        boolean deviceDetails
) {
    public SessionList {
        sessions = List.copyOf(sessions);
    }

    public record Session(
            String id,
            boolean current,
            @Nullable String ipAddress,
            @Nullable Instant startedAt,
            @Nullable Instant lastAccessAt,
            List<String> applications,
            @Nullable Device device
    ) {
        public Session {
            applications = List.copyOf(applications);
        }
    }

    public record Device(
            @Nullable String browser,
            @Nullable String os,
            @Nullable String osVersion,
            @Nullable String device,
            boolean mobile
    ) {
    }

    public record SignOutResult(
            int signedOut
    ) {
    }
}
