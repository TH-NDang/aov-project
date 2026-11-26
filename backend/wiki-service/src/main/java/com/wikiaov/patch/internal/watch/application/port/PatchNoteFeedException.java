package com.wikiaov.patch.internal.watch.application.port;

import com.wikiaov.patch.internal.watch.domain.PatchNoteFailure;
import org.jspecify.annotations.Nullable;

/** A list could not be read. The message never quotes the page. */
public class PatchNoteFeedException extends RuntimeException {
    private final PatchNoteFailure failure;
    private final @Nullable Integer status;

    public PatchNoteFeedException(PatchNoteFailure failure, @Nullable Integer status) {
        super(status == null ? failure.name() : failure.name() + " " + status);
        this.failure = failure;
        this.status = status;
    }

    public PatchNoteFailure failure() {
        return failure;
    }

    public @Nullable Integer status() {
        return status;
    }
}
