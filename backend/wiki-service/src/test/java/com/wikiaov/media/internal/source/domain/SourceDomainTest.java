package com.wikiaov.media.internal.source.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import org.junit.jupiter.api.Test;

class SourceDomainTest {

    @Test
    void pathsKeepFoldersAndVietnameseNamesButNeverEscapeTheTargetFolder() {
        assertThat(SourcePaths.normalize("raw/shop/2026-09-16/tuong/airi.jpg"))
                .contains("raw/shop/2026-09-16/tuong/airi.jpg");
        // Decomposed input is stored in NFC, so the same name never appears twice.
        assertThat(SourcePaths.normalize("anh-goc/Ha\u0302\u0301u Nghe\u0323\u0302.png"))
                .contains("anh-goc/Hấu Nghệ.png");

        for (String unsafe : new String[] {"", "/abs/file.png", "a//b.png", "a/./b.png", "a/../b.png", "..",
                "a\\b.png", "c:/x.png", "a/b?.png", "dir/ /x.png", "dir./x.png", "x.png ", "a\u0000b", "a/\u200Eb.png",
                "a/".repeat(300)}) {
            assertThat(SourcePaths.normalize(unsafe)).as(unsafe).isEmpty();
        }
        assertThat(SourcePaths.normalize(null)).isEmpty();
        assertThat(SourcePaths.normalizeFolder("raw/shop/")).contains("raw/shop");
        assertThat(SourcePaths.fileName("raw/shop/airi.jpg")).isEqualTo("airi.jpg");
        assertThat(SourcePaths.fileName("manifest.json")).isEqualTo("manifest.json");
    }

    @Test
    void onlyDocumentAndImageTypesThatBrowsersDoNotRunAreAllowed() {
        assertThat(SourceContentTypes.normalize("Image/PNG")).contains("image/png");
        assertThat(SourceContentTypes.normalize("text/markdown; charset=utf-8")).contains("text/markdown");
        assertThat(SourceContentTypes.normalize("text/html")).isEmpty();
        assertThat(SourceContentTypes.normalize("image/svg+xml")).isEmpty();
        assertThat(SourceContentTypes.normalize("application/javascript")).isEmpty();
        assertThat(SourceContentTypes.normalize(null)).isEmpty();

        assertThat(SourceContentTypes.storedHeader("application/json")).isEqualTo("application/json; charset=utf-8");
        assertThat(SourceContentTypes.storedHeader("text/plain")).isEqualTo("text/plain; charset=utf-8");
        assertThat(SourceContentTypes.storedHeader("image/png")).isEqualTo("image/png");
    }

    @Test
    void imagesAndArchivesMustCarryTheSignatureOfTheirDeclaredType() {
        byte[] png = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n', 0, 0, 0, 13};
        byte[] jpeg = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0};
        byte[] gif = "GIF89a....".getBytes(StandardCharsets.US_ASCII);
        byte[] webp = "RIFF\0\0\0\0WEBPVP8 ".getBytes(StandardCharsets.US_ASCII);
        byte[] zip = {'P', 'K', 3, 4, 20, 0};

        assertThat(SourceContentTypes.matchesSignature("image/png", png)).isTrue();
        assertThat(SourceContentTypes.matchesSignature("image/jpeg", jpeg)).isTrue();
        assertThat(SourceContentTypes.matchesSignature("image/gif", gif)).isTrue();
        assertThat(SourceContentTypes.matchesSignature("image/webp", webp)).isTrue();
        assertThat(SourceContentTypes.matchesSignature("application/zip", zip)).isTrue();

        assertThat(SourceContentTypes.matchesSignature("image/png", jpeg)).isFalse();
        assertThat(SourceContentTypes.matchesSignature("image/jpeg", png)).isFalse();
        assertThat(SourceContentTypes.matchesSignature("application/zip", png)).isFalse();
        assertThat(SourceContentTypes.matchesSignature("image/png", new byte[0])).isFalse();
        assertThat(SourceContentTypes.matchesSignature("application/json", png)).isTrue();
    }

    @Test
    void digestReportsHashSizeAndHeadOfTheWholeStream() throws Exception {
        byte[] bytes = "hello source files".getBytes(StandardCharsets.UTF_8);

        SourceDigest digest = SourceDigest.read(new ByteArrayInputStream(bytes));

        assertThat(digest.sha256()).isEqualTo(sha256(bytes));
        assertThat(digest.sizeBytes()).isEqualTo(bytes.length);
        assertThat(digest.head()).hasSize(SourceContentTypes.SIGNATURE_LENGTH);
        assertThat(SourceDigest.read(new ByteArrayInputStream(new byte[3])).head()).hasSize(3);
        assertThat(SourceDigest.isSha256(digest.sha256())).isTrue();
        assertThat(SourceDigest.isSha256(digest.sha256().toUpperCase())).isFalse();
    }

    private static String sha256(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }
}
