package com.wikiaov.media.internal.ingestion.domain.image;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.wikiaov.media.TestImages;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HexFormat;
import org.junit.jupiter.api.Test;

class ImageInspectorTest {

    private static final ImageLimits LIMITS = new ImageLimits(25L * 1024 * 1024, 40_000_000, 16384);

    @Test
    void readsPngHeaderSizeAndHash() throws Exception {
        byte[] png = TestImages.png(30, 20);

        ImageInspection inspection = inspect(png, LIMITS);

        assertThat(inspection.format()).isEqualTo(ImageFormat.PNG);
        assertThat(inspection.width()).isEqualTo(30);
        assertThat(inspection.height()).isEqualTo(20);
        assertThat(inspection.sizeBytes()).isEqualTo(png.length);
        assertThat(inspection.sha256()).isEqualTo(sha256(png));
    }

    @Test
    void readsJpegFrameHeader() throws Exception {
        ImageInspection inspection = inspect(TestImages.jpeg(64, 48), LIMITS);

        assertThat(inspection.format()).isEqualTo(ImageFormat.JPEG);
        assertThat(inspection.width()).isEqualTo(64);
        assertThat(inspection.height()).isEqualTo(48);
    }

    @Test
    void skipsLargeJpegSegmentsBeforeTheFrameHeaderWhileStillHashingThem() throws Exception {
        byte[] jpeg = TestImages.jpeg(16, 8);
        ByteArrayOutputStream withExif = new ByteArrayOutputStream();
        withExif.write(jpeg, 0, 2); // SOI
        withExif.write(new byte[] {(byte) 0xFF, (byte) 0xE1, (byte) 0xEA, 0x60}); // APP1, length 60000
        withExif.write(new byte[60_000 - 2]);
        withExif.write(jpeg, 2, jpeg.length - 2);
        byte[] bytes = withExif.toByteArray();

        ImageInspection inspection = inspect(bytes, LIMITS);

        assertThat(inspection.width()).isEqualTo(16);
        assertThat(inspection.height()).isEqualTo(8);
        assertThat(inspection.sizeBytes()).isEqualTo(bytes.length);
        assertThat(inspection.sha256()).isEqualTo(sha256(bytes));
    }

    @Test
    void readsAllThreeWebpHeaderKinds() throws Exception {
        assertThat(inspect(TestImages.webpLossless(1200, 800), LIMITS))
                .satisfies(image -> assertThat(image.format()).isEqualTo(ImageFormat.WEBP))
                .satisfies(image -> assertThat(new int[] {image.width(), image.height()}).containsExactly(1200, 800));
        assertThat(inspect(TestImages.webpLossy(640, 360), LIMITS))
                .satisfies(image -> assertThat(new int[] {image.width(), image.height()}).containsExactly(640, 360));
        assertThat(inspect(TestImages.webpExtended(4096, 6400), LIMITS))
                .satisfies(image -> assertThat(new int[] {image.width(), image.height()}).containsExactly(4096, 6400));
    }

    @Test
    void refusesEmptyShortAndUnsupportedFiles() {
        assertReason(new byte[0], InvalidMediaReason.EMPTY);
        assertReason(new byte[] {(byte) 0x89, 'P', 'N'}, InvalidMediaReason.CORRUPT_IMAGE);
        assertReason("hello".getBytes(StandardCharsets.US_ASCII), InvalidMediaReason.UNSUPPORTED_FORMAT);
        assertReason("GIF89a-not-accepted".getBytes(StandardCharsets.US_ASCII), InvalidMediaReason.UNSUPPORTED_FORMAT);
        assertReason("<svg xmlns=\"http://www.w3.org/2000/svg\"/>".getBytes(StandardCharsets.US_ASCII),
                InvalidMediaReason.UNSUPPORTED_FORMAT);
    }

    @Test
    void detectsTruncatedFiles() {
        byte[] png = TestImages.png(30, 20);
        assertReason(Arrays.copyOf(png, png.length - 20), InvalidMediaReason.CORRUPT_IMAGE);
        assertReason(Arrays.copyOf(png, 20), InvalidMediaReason.CORRUPT_IMAGE);

        byte[] webp = TestImages.webpLossless(10, 10);
        assertReason(Arrays.copyOf(webp, webp.length - 1), InvalidMediaReason.CORRUPT_IMAGE);
        assertReason(Arrays.copyOf(webp, webp.length + 1), InvalidMediaReason.CORRUPT_IMAGE);
    }

    @Test
    void enforcesSizeAndDimensionLimits() {
        byte[] png = TestImages.png(20, 10);
        assertReason(png, new ImageLimits(png.length - 1, 40_000_000, 16384), InvalidMediaReason.TOO_LARGE);
        assertReason(png, new ImageLimits(png.length, 40_000_000, 16), InvalidMediaReason.DIMENSION_TOO_LARGE);
        assertReason(png, new ImageLimits(png.length, 199, 16384), InvalidMediaReason.TOO_MANY_PIXELS);
    }

    @Test
    void rejectsHugeDimensionsFromTheHeaderAlone() {
        // A tiny file claiming 100000 x 100000 pixels: refused without decoding anything.
        byte[] header = ByteBuffer.allocate(33)
                .put(new byte[] {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'})
                .putInt(13).put("IHDR".getBytes(StandardCharsets.US_ASCII))
                .putInt(100_000).putInt(100_000)
                .array();
        assertReason(header, InvalidMediaReason.DIMENSION_TOO_LARGE);
    }

    @Test
    void rejectsZeroSizedImages() {
        assertReason(TestImages.webpLossy(0, 10), InvalidMediaReason.CORRUPT_IMAGE);
    }

    private static ImageInspection inspect(byte[] bytes, ImageLimits limits) throws IOException {
        return ImageInspector.inspect(new ByteArrayInputStream(bytes), limits);
    }

    private static void assertReason(byte[] bytes, InvalidMediaReason reason) {
        assertReason(bytes, LIMITS, reason);
    }

    private static void assertReason(byte[] bytes, ImageLimits limits, InvalidMediaReason reason) {
        assertThatThrownBy(() -> inspect(bytes, limits))
                .isInstanceOfSatisfying(InvalidMediaException.class, ex -> assertThat(ex.reason()).isEqualTo(reason));
    }

    private static String sha256(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }
}
