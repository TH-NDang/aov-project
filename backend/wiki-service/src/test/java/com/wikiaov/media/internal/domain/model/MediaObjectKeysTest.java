package com.wikiaov.media.internal.domain.model;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.media.internal.domain.image.ImageFormat;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class MediaObjectKeysTest {

    @Test
    void assetKeysAreImmutablePerVersion() {
        UUID asset = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID version = UUID.fromString("00000000-0000-0000-0000-000000000002");

        assertThat(MediaObjectKeys.asset(asset, version, ImageFormat.WEBP))
                .isEqualTo("assets/00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000002.webp");
    }

    @ParameterizedTest
    @ValueSource(strings = {"imports/heroes/nakroth/portrait.webp", "imports/a.png", "imports/v1_2-final/x.jpg"})
    void acceptsSafeImportKeys(String key) {
        assertThat(MediaObjectKeys.isAllowedImportKey(key)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"assets/a/b.png", "incoming/x", "imports/", "imports/../assets/a.png", "imports/./a.png",
            "imports/a//b.png", "imports/a b.png", "imports/\u1EA3nh.png", "/imports/a.png", "imports\\a.png"})
    void refusesOtherKeys(String key) {
        assertThat(MediaObjectKeys.isAllowedImportKey(key)).isFalse();
    }
}
