package com.wikiaov.media.internal.storage.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

class StoragePropertiesTest {

    @Test
    void bindsFromConfigurationWithItsDefaults() {
        new ApplicationContextRunner().withUserConfiguration(Bound.class)
                .withPropertyValues("wiki.storage.bucket=media", "wiki.storage.sign-upload-size=true")
                .run(context -> {
                    var properties = context.getBean(StorageProperties.class);
                    assertThat(properties.bucket()).isEqualTo("media");
                    assertThat(properties.region()).isEqualTo("us-east-1");
                    assertThat(properties.pathStyleAccess()).isTrue();
                    assertThat(properties.signUploadSize()).isTrue();
                });
        new ApplicationContextRunner().withUserConfiguration(Bound.class)
                .run(context -> assertThat(context.getBean(StorageProperties.class).signUploadSize()).isFalse());
    }

    @Test
    void onlyValidatedAssetPrefixUsesTheAssetsBucket() {
        var properties = properties("public-assets");

        assertThat(properties.bucketFor("assets/a/v.png")).isEqualTo("public-assets");
        assertThat(properties.bucketFor("incoming/upload")).isEqualTo("private-media");
        assertThat(properties.bucketFor("imports/job/image.png")).isEqualTo("private-media");
        assertThat(properties.bucketFor("assets-other/image.png")).isEqualTo("private-media");
    }

    @Test
    void absentAssetsBucketPreservesSingleBucketConfiguration() {
        assertThat(properties(null).bucketFor("assets/a/v.png")).isEqualTo("private-media");
        assertThat(properties(" ").bucketFor("assets/a/v.png")).isEqualTo("private-media");
    }

    @Test
    void sourceFilesUseTheirOwnPrivateBucketWhenConfigured() {
        var properties = new StorageProperties(null, "auto", "private-media", "public-assets", "private-sources", true,
                null, null, false, null, false);

        assertThat(properties.bucketFor("sources/" + "a".repeat(64))).isEqualTo("private-sources");
        assertThat(properties.bucketFor("incoming/upload")).isEqualTo("private-media");
        assertThat(properties.bucketFor("sources-other/file")).isEqualTo("private-media");
        assertThat(properties(null).bucketFor("sources/" + "a".repeat(64))).isEqualTo("private-media");
    }

    private static StorageProperties properties(String assetsBucket) {
        return new StorageProperties(null, "auto", "private-media", assetsBucket, null, true, null, null, false,
                null, false);
    }

    @EnableConfigurationProperties(StorageProperties.class)
    static class Bound {
    }
}
