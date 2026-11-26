package com.wikiaov.media.internal.upload.application.port;

/** Asks the image service to make the resized copies readers fetch, so the first reader does not wait for them. */
public interface ResizedCopies {
    /** Starts making the copies of the picture at {@code publicUrl} and returns at once; failures are only logged. */
    void warm(String publicUrl);
}
