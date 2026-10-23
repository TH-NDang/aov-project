package com.wikiaov.media.internal.storage.infrastructure;

import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
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
    private final Set<String> buckets;
    private final String adminOrigin;

    BucketInitializer(S3Client s3, StorageProperties properties,
            @Value("${wiki.auth.admin-origin:http://localhost:5175}") String adminOrigin) {
        this.s3 = s3;
        this.buckets = Set.copyOf(List.of(properties.bucket(), properties.effectiveAssetsBucket()));
        this.adminOrigin = adminOrigin;
    }

    @Override
    public void run(ApplicationArguments args) {
        buckets.forEach(this::initialize);
    }

    private void initialize(String bucket) {
        try {
            s3.headBucket(request -> request.bucket(bucket));
        } catch (NoSuchBucketException ex) {
            createBucket(bucket);
        } catch (S3Exception ex) {
            if (ex.statusCode() == 404) {
                createBucket(bucket);
            } else {
                log.warn("Could not check object storage bucket '{}': {}", bucket, ex.getMessage());
            }
        } catch (SdkException ex) {
            // Do not block startup: storage may still be starting. Calls will fail with STORAGE_UNAVAILABLE.
            log.warn("Could not check object storage bucket '{}': {}", bucket, ex.getMessage());
        }
        try {
            s3.putBucketCors(request -> request.bucket(bucket).corsConfiguration(cors -> cors.corsRules(rule -> rule
                    .allowedOrigins(adminOrigin).allowedMethods("PUT", "GET", "HEAD")
                    .allowedHeaders("*").exposeHeaders("ETag").maxAgeSeconds(600))));
        } catch (SdkException ex) {
            log.warn("Could not configure local upload CORS for bucket '{}'.", bucket);
        }
    }

    private void createBucket(String bucket) {
        s3.createBucket(request -> request.bucket(bucket));
        log.info("Created object storage bucket '{}'", bucket);
    }
}
