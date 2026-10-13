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

    MEDIA_ASSET_NOT_FOUND(HttpStatus.NOT_FOUND, "Media asset not found"),
    /** The asset is DEPRECATED or BLOCKED; context: {@code state}. */
    MEDIA_ASSET_NOT_ACTIVE(HttpStatus.CONFLICT, "Media asset not active"),
    /** {@code expectedVersion} is stale; context: {@code currentVersion}. */
    MEDIA_ASSET_VERSION_CONFLICT(HttpStatus.CONFLICT, "Media asset version conflict"),
    /** A current revision still references the asset; context: {@code currentUsages}. */
    MEDIA_ASSET_IN_USE(HttpStatus.CONFLICT, "Media asset in use"),
    MEDIA_VERSION_NOT_FOUND(HttpStatus.NOT_FOUND, "Media version not found"),
    /** Only READY versions can be activated; context: {@code state}. */
    MEDIA_VERSION_NOT_READY(HttpStatus.CONFLICT, "Media version not ready"),
    MEDIA_UPLOAD_NOT_FOUND(HttpStatus.NOT_FOUND, "Upload not found"),
    /** The completion deadline has passed; request a new upload. Context: {@code expiresAt}. */
    MEDIA_UPLOAD_EXPIRED(HttpStatus.CONFLICT, "Upload expired"),
    /** The bytes were refused earlier; request a new upload. Context: {@code reason}. */
    MEDIA_UPLOAD_REJECTED(HttpStatus.CONFLICT, "Upload rejected"),
    /** Another request is validating this upload right now; retry later. */
    MEDIA_UPLOAD_IN_PROGRESS(HttpStatus.CONFLICT, "Upload validation in progress"),
    /** The file breaks the media policy (format, size, dimensions); context: {@code reason}. */
    INVALID_MEDIA_OBJECT(HttpStatus.UNPROCESSABLE_CONTENT, "Invalid media object"),
    /** The bytes referenced by an upload or import do not exist in object storage. */
    MEDIA_OBJECT_NOT_FOUND(HttpStatus.UNPROCESSABLE_CONTENT, "Storage object not found"),
    /** Object storage could not be reached or returned a server error; the call may be retried. */
    STORAGE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "Storage unavailable");

    private final HttpStatus status;
    private final String title;
}
