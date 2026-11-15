package com.wikiaov.media.internal.capacity.application.port;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;

/** Real R2 figures from Cloudflare analytics (ADR-030 section 9); optional, read only. */
public interface R2Analytics {

    /**
     * Latest storage of each bucket and the operations since the start of the current UTC month. Never throws: a
     * missing token gives {@code NOT_CONFIGURED}, a failure {@code UNAVAILABLE}.
     */
    Usage read(Set<String> buckets);

    enum State {
        NOT_CONFIGURED,
        OK,
        UNAVAILABLE
    }

    record Usage(
            State state,
            @Nullable Instant checkedAt,
            List<Bucket> buckets,
            @Nullable Operations operations
    ) {

        public Usage {
            buckets = List.copyOf(buckets);
        }

        public static Usage notConfigured() {
            return new Usage(State.NOT_CONFIGURED, null, List.of(), null);
        }

        public static Usage unavailable(Instant checkedAt) {
            return new Usage(State.UNAVAILABLE, checkedAt, List.of(), null);
        }
    }

    /** {@code bytes} counts payload and metadata, as Cloudflare bills them. */
    record Bucket(
            String bucket,
            long objects,
            long bytes,
            long pendingUploads
    ) {
    }

    record Operations(
            Instant from,
            Instant to,
            long classA,
            long classB,
            long free
    ) {
    }
}
