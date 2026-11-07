package com.wikiaov.media.internal.storage.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.util.List;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CORSRule;
import software.amazon.awssdk.services.s3.model.PutBucketCorsRequest;

class BucketInitializerTest {

    @Test
    void uploadCorsAllowsExactlyTheConfiguredFrontendOrigins() {
        var s3 = mock(S3Client.class);
        var properties = new StorageProperties(null, "us-east-1", "wiki-media", null, true, null, null, true, null);
        var origins = List.of("http://localhost:5175", "http://localhost:5174");

        new BucketInitializer(s3, properties, origins).run(null);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Consumer<PutBucketCorsRequest.Builder>> request = ArgumentCaptor.forClass(Consumer.class);
        verify(s3).putBucketCors(request.capture());
        var builder = PutBucketCorsRequest.builder();
        request.getValue().accept(builder);
        CORSRule rule = builder.build().corsConfiguration().corsRules().getFirst();
        assertThat(rule.allowedOrigins()).containsExactly("http://localhost:5175", "http://localhost:5174");
        assertThat(rule.allowedMethods()).containsExactly("PUT", "GET", "HEAD");
    }
}
