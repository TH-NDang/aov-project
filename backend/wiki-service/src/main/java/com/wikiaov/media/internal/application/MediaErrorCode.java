package com.wikiaov.media.internal.application;

import com.wikiaov.platform.ApiErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.experimental.Accessors;
import org.springframework.http.HttpStatus;

/** Error codes owned by the media module. Codes must stay unique across all modules. */
@Getter
@Accessors(fluent = true)
@RequiredArgsConstructor
public enum MediaErrorCode implements ApiErrorCode {

    /** The bytes referenced by a media version do not exist in object storage. */
    MEDIA_OBJECT_NOT_FOUND(HttpStatus.UNPROCESSABLE_CONTENT, "Storage object not found"),
    /** Object storage could not be reached or returned a server error; the call may be retried. */
    STORAGE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "Storage unavailable");

    private final HttpStatus status;
    private final String title;
}
