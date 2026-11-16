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

    MEDIA_CONTACT_NOT_FOUND(HttpStatus.NOT_FOUND, "Contact request not found"),
    MEDIA_CONTACT_RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "Too many contact requests"),
    MEDIA_OWNER_NOT_FOUND(HttpStatus.NOT_FOUND, "Media owner not found"),
    /** Another owner has the same name once case and whitespace are ignored; context: {@code ownerId}. */
    MEDIA_OWNER_NAME_TAKEN(HttpStatus.CONFLICT, "Media owner name taken"),
    /** {@code expectedVersion} is stale; context: {@code currentVersion}. */
    MEDIA_OWNER_VERSION_CONFLICT(HttpStatus.CONFLICT, "Media owner version conflict"),

    MEDIA_ASSET_NOT_FOUND(HttpStatus.NOT_FOUND, "Media asset not found"),
    MEDIA_SOURCE_NOT_FOUND(HttpStatus.NOT_FOUND, "Media source not found"),
    MEDIA_SOURCE_VERSION_CONFLICT(HttpStatus.CONFLICT, "Media source reference version conflict"),
    MEDIA_DELETION_NOT_FOUND(HttpStatus.NOT_FOUND, "Media deletion not found"),
    MEDIA_DELETION_IN_PROGRESS(HttpStatus.CONFLICT, "Media deletion in progress"),
    MEDIA_CACHE_PURGE_NOT_CONFIGURED(HttpStatus.SERVICE_UNAVAILABLE, "Media cache purge not configured"),
    MEDIA_CACHE_PURGE_FAILED(HttpStatus.BAD_GATEWAY, "Media cache purge failed"),
    MEDIA_COMPETITION_CHECK_FAILED(HttpStatus.BAD_GATEWAY, "Competition media check failed"),
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
    STORAGE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "Storage unavailable"),

    // Private source files (ADR-030).
    SOURCE_COLLECTION_NOT_FOUND(HttpStatus.NOT_FOUND, "Source collection not found"),
    SOURCE_COLLECTION_CODE_TAKEN(HttpStatus.CONFLICT, "Source collection code taken"),
    /** {@code expectedVersion} is stale; context: {@code currentVersion}. */
    SOURCE_COLLECTION_VERSION_CONFLICT(HttpStatus.CONFLICT, "Source collection version conflict"),
    SOURCE_FILE_NOT_FOUND(HttpStatus.NOT_FOUND, "Source file not found"),
    /** The path already names other bytes; context: {@code fileId}, {@code sha256}, {@code version}. */
    SOURCE_FILE_PATH_TAKEN(HttpStatus.CONFLICT, "Source file path taken"),
    /** The file to replace changed or is gone; context: {@code currentVersion} when it still exists. */
    SOURCE_FILE_VERSION_CONFLICT(HttpStatus.CONFLICT, "Source file version conflict"),
    /** Context: {@code contentType}. */
    SOURCE_FILE_TYPE_NOT_ALLOWED(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Source file type not allowed"),
    /** Context: {@code maxBytes}. */
    SOURCE_FILE_TOO_LARGE(HttpStatus.CONTENT_TOO_LARGE, "Source file too large"),
    SOURCE_UPLOAD_NOT_FOUND(HttpStatus.NOT_FOUND, "Source upload not found"),
    /** The bytes were not uploaded yet; the upload stays open. */
    SOURCE_UPLOAD_NOT_UPLOADED(HttpStatus.CONFLICT, "Source upload not uploaded"),
    /** Context: {@code expiresAt}. */
    SOURCE_UPLOAD_EXPIRED(HttpStatus.CONFLICT, "Source upload expired"),
    /** The bytes do not match what was declared; context: {@code reason}. */
    SOURCE_UPLOAD_REJECTED(HttpStatus.CONFLICT, "Source upload rejected"),
    SOURCE_UPLOAD_IN_PROGRESS(HttpStatus.CONFLICT, "Source upload validation in progress"),
    SOURCE_OBJECT_NOT_FOUND(HttpStatus.NOT_FOUND, "Source object not found"),
    /** Context: {@code files}, {@code usages}. */
    SOURCE_OBJECT_IN_USE(HttpStatus.CONFLICT, "Source object in use"),
    /** The same bytes are being purged right now; retry later. */
    SOURCE_OBJECT_BUSY(HttpStatus.CONFLICT, "Source object being deleted"),
    /** Context: {@code max}. */
    SOURCE_LINK_LIMIT_EXCEEDED(HttpStatus.BAD_REQUEST, "Too many source links requested"),
    /** Context: {@code max}. */
    STORAGE_ESTIMATE_LIMIT_EXCEEDED(HttpStatus.BAD_REQUEST, "Too many files to estimate");

    private final HttpStatus status;
    private final String title;
}
