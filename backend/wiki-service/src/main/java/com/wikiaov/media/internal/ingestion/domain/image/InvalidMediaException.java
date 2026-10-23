package com.wikiaov.media.internal.ingestion.domain.image;

/** The bytes break the media policy. The message is safe to show to clients. */
public class InvalidMediaException extends RuntimeException {

    private final InvalidMediaReason reason;

    public InvalidMediaException(InvalidMediaReason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public InvalidMediaReason reason() {
        return reason;
    }
}
