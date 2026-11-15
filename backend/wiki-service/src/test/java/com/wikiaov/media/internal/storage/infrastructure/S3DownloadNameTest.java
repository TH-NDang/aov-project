package com.wikiaov.media.internal.storage.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class S3DownloadNameTest {

    @Test
    void downloadNamesKeepVietnameseLettersWithAnAsciiFallback() {
        assertThat(S3ObjectStorage.attachment("Hấu Nghệ.png"))
                .isEqualTo("attachment; filename=\"H_u_Ngh_.png\"; filename*=UTF-8''H%E1%BA%A5u%20Ngh%E1%BB%87.png");
        assertThat(S3ObjectStorage.attachment("shop-manifest.json"))
                .isEqualTo("attachment; filename=\"shop-manifest.json\"; filename*=UTF-8''shop-manifest.json");
        // A quote in a name can never close the quoted fallback early.
        assertThat(S3ObjectStorage.attachment("a\"b.txt")).startsWith("attachment; filename=\"a_b.txt\";");
    }
}
