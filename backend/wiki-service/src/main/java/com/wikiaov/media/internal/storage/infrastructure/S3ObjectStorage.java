package com.wikiaov.media.internal.storage.infrastructure;

import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.storage.application.port.ObjectStorage;
import com.wikiaov.media.internal.storage.application.port.PresignedRequest;
import com.wikiaov.media.internal.storage.application.port.StoredObject;

import com.wikiaov.platform.ApiException;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URISyntaxException;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.MetadataDirective;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;

/** {@link ObjectStorage} backed by the standard S3 API. Uses only operations every S3-compatible service offers. */
@Component
class S3ObjectStorage implements ObjectStorage {

    private final S3Client s3;
    private final S3Presigner presigner;
    private final StorageProperties properties;

    S3ObjectStorage(S3Client s3, S3Presigner presigner, StorageProperties properties) {
        this.s3 = s3;
        this.presigner = presigner;
        this.properties = properties;
    }

    @Override
    public void put(String key, InputStream content, long contentLength, String contentType) {
        call("put", key, () -> s3.putObject(
                request -> request.bucket(properties.bucketFor(key)).key(key).contentType(contentType)
                        .contentLength(contentLength),
                RequestBody.fromInputStream(content, contentLength)));
    }

    @Override
    public Optional<StoredObject> stat(String key) {
        try {
            HeadObjectResponse head = call("stat", key,
                    () -> s3.headObject(request -> request.bucket(properties.bucketFor(key)).key(key)));
            return Optional.of(new StoredObject(key, head.contentLength(), head.contentType(), head.eTag(),
                    head.lastModified()));
        } catch (ApiException ex) {
            if (ex.getErrorCode() == MediaErrorCode.MEDIA_OBJECT_NOT_FOUND) {
                return Optional.empty();
            }
            throw ex;
        }
    }

    @Override
    public InputStream open(String key) {
        InputStream stream = call("open", key,
                () -> s3.getObject(request -> request.bucket(properties.bucketFor(key)).key(key)));
        return new SdkExceptionTranslatingStream(stream);
    }

    @Override
    public void copy(String sourceKey, String targetKey, String contentType, @Nullable String cacheControl) {
        call("copy", sourceKey, () -> s3.copyObject(request -> request
                .sourceBucket(properties.bucketFor(sourceKey)).sourceKey(sourceKey)
                .destinationBucket(properties.bucketFor(targetKey)).destinationKey(targetKey)
                .metadataDirective(MetadataDirective.REPLACE)
                .contentType(contentType)
                .cacheControl(cacheControl)));
    }

    @Override
    public void delete(String key) {
        call("delete", key, () -> s3.deleteObject(request -> request.bucket(properties.bucketFor(key)).key(key)));
    }

    @Override
    public PresignedRequest presignPut(String key, String contentType, Duration validity) {
        PresignedPutObjectRequest presigned = presigner.presignPutObject(request -> request
                .signatureDuration(validity)
                .putObjectRequest(put -> put.bucket(properties.bucketFor(key)).key(key).contentType(contentType)));
        return toPresignedRequest(presigned);
    }

    @Override
    public PresignedRequest presignGet(String key, Duration validity) {
        PresignedGetObjectRequest presigned = presigner.presignGetObject(request -> request
                .signatureDuration(validity)
                .getObjectRequest(get -> get.bucket(properties.bucketFor(key)).key(key)));
        return toPresignedRequest(presigned);
    }

    private static PresignedRequest toPresignedRequest(
            software.amazon.awssdk.awscore.presigner.PresignedRequest presigned) {
        Map<String, String> headers = new LinkedHashMap<>();
        presigned.signedHeaders().forEach((name, values) -> {
            // The HTTP client sets Host itself; the caller must not send it manually.
            if (!"host".equalsIgnoreCase(name)) {
                headers.put(name, String.join(",", values));
            }
        });
        try {
            return new PresignedRequest(presigned.url().toURI(), presigned.httpRequest().method().name(),
                    headers, presigned.expiration());
        } catch (URISyntaxException ex) {
            throw new IllegalStateException("Presigned URL is not a valid URI", ex);
        }
    }

    /**
     * Runs an SDK call and translates failures: missing object, temporary outage, or a configuration problem
     * (e.g. wrong credentials), which is left as an unexpected error.
     */
    private <T> T call(String operation, String key, Supplier<T> action) {
        try {
            return action.get();
        } catch (NoSuchKeyException ex) {
            throw notFound(operation, key, ex);
        } catch (S3Exception ex) {
            if (ex.statusCode() == 404) {
                throw notFound(operation, key, ex);
            }
            if (ex.statusCode() >= 500 || ex.statusCode() == 429) {
                throw unavailable(operation, ex);
            }
            throw ex;
        } catch (SdkClientException ex) {
            throw unavailable(operation, ex);
        }
    }

    /** The SDK reports network failures while streaming as unchecked exceptions; callers expect IOException. */
    private static final class SdkExceptionTranslatingStream extends FilterInputStream {

        SdkExceptionTranslatingStream(InputStream in) {
            super(in);
        }

        @Override
        public int read() throws IOException {
            try {
                return super.read();
            } catch (SdkException ex) {
                throw new IOException("Reading from object storage failed", ex);
            }
        }

        @Override
        public int read(byte[] buffer, int offset, int length) throws IOException {
            try {
                return super.read(buffer, offset, length);
            } catch (SdkException ex) {
                throw new IOException("Reading from object storage failed", ex);
            }
        }

        @Override
        public void close() throws IOException {
            try {
                super.close();
            } catch (SdkException ex) {
                throw new IOException("Closing the object storage stream failed", ex);
            }
        }
    }

    /** The key is kept in the cause chain for logs only; it is not exposed to clients. */
    private static ApiException notFound(String operation, String key, Exception cause) {
        return new ApiException(MediaErrorCode.MEDIA_OBJECT_NOT_FOUND, "The media object does not exist.",
                new IllegalStateException(operation + " failed for key " + key, cause));
    }

    private static ApiException unavailable(String operation, Exception cause) {
        return new ApiException(MediaErrorCode.STORAGE_UNAVAILABLE, "Object storage is temporarily unavailable.",
                new IllegalStateException(operation + " failed", cause));
    }
}
