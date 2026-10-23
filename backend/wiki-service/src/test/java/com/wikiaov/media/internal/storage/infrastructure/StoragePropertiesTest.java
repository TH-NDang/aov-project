package com.wikiaov.media.internal.storage.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class StoragePropertiesTest {

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

    private static StorageProperties properties(String assetsBucket) {
        return new StorageProperties(null, "auto", "private-media", assetsBucket, true, null, null, false);
    }
}
