package com.wikiaov.media.internal.infrastructure;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;
import software.amazon.awssdk.services.s3.model.S3Exception;

/**
 * Creates the media bucket at startup when {@code wiki.storage.create-bucket-if-missing=true}.
 * Local development only: production buckets are provisioned outside the application.
 */
@Component
@ConditionalOnBooleanProperty("wiki.storage.create-bucket-if-missing")
class BucketInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(BucketInitializer.class);

    private final S3Client s3;
    private final String bucket;

    BucketInitializer(S3Client s3, StorageProperties properties) {
        this.s3 = s3;
        this.bucket = properties.bucket();
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            s3.headBucket(request -> request.bucket(bucket));
        } catch (NoSuchBucketException ex) {
            createBucket();
        } catch (S3Exception ex) {
            if (ex.statusCode() == 404) {
                createBucket();
            } else {
                log.warn("Could not check object storage bucket '{}': {}", bucket, ex.getMessage());
            }
        } catch (SdkException ex) {
            // Do not block startup: storage may still be starting. Calls will fail with STORAGE_UNAVAILABLE.
            log.warn("Could not check object storage bucket '{}': {}", bucket, ex.getMessage());
        }
    }

    private void createBucket() {
        s3.createBucket(request -> request.bucket(bucket));
        log.info("Created object storage bucket '{}'", bucket);
    }
}
