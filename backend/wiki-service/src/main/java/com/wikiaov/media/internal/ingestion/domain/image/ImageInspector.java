package com.wikiaov.media.internal.ingestion.domain.image;

import java.io.ByteArrayInputStream;
import java.io.DataInputStream;
import java.io.EOFException;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.SequenceInputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.HexFormat;

/**
 * Reads format, dimensions, size and SHA-256 from image bytes in one streaming pass.
 *
 * <p>Only the file signature and header are parsed; pixels are never decoded. That keeps memory flat and
 * makes decompression bombs harmless: the pixel limit is checked from the header before anything else could
 * expand. Truncated PNG and WebP files are detected from their trailer and RIFF size.
 */
public final class ImageInspector {

    private static final byte[] PNG_SIGNATURE = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};
    /** Zero-length IEND chunk: length, type, CRC. Every complete PNG ends with these 12 bytes. */
    private static final byte[] PNG_END = {0, 0, 0, 0, 'I', 'E', 'N', 'D', (byte) 0xAE, 0x42, 0x60, (byte) 0x82};
    private static final int HEAD_LENGTH = 12;

    private ImageInspector() {
    }

    /**
     * Inspects all bytes of {@code content}. Does not close the stream.
     *
     * @throws InvalidMediaException if the bytes are not an accepted image or break {@code limits}
     * @throws IOException           if reading the stream fails
     */
    public static ImageInspection inspect(InputStream content, ImageLimits limits) throws IOException {
        MeteredInputStream metered = new MeteredInputStream(content, limits.maxBytes());
        byte[] head = metered.readNBytes(HEAD_LENGTH);
        if (head.length == 0) {
            throw invalid(InvalidMediaReason.EMPTY, "The object is empty.");
        }
        if (head.length < HEAD_LENGTH) {
            throw couldBeImageStart(head)
                    ? corrupt("The object is too short to be an image.")
                    : invalid(InvalidMediaReason.UNSUPPORTED_FORMAT, "Only PNG, JPEG and WebP images are accepted.");
        }
        // Parsers re-read the head, then continue with the rest of the stream.
        DataInputStream data = new DataInputStream(new SequenceInputStream(new ByteArrayInputStream(head), metered));
        ImageFormat format = detect(head);
        int[] size;
        try {
            size = switch (format) {
                case PNG -> readPngSize(data);
                case JPEG -> readJpegSize(data);
                case WEBP -> readWebpSize(data);
            };
        } catch (EOFException ex) {
            throw corrupt("The image header is truncated.");
        }
        checkDimensions(size[0], size[1], limits);
        metered.drain();
        checkCompleteness(format, head, metered);
        return new ImageInspection(format, size[0], size[1], metered.count(), metered.sha256Hex());
    }

    private static ImageFormat detect(byte[] head) {
        if (Arrays.equals(head, 0, PNG_SIGNATURE.length, PNG_SIGNATURE, 0, PNG_SIGNATURE.length)) {
            return ImageFormat.PNG;
        }
        if ((head[0] & 0xFF) == 0xFF && (head[1] & 0xFF) == 0xD8 && (head[2] & 0xFF) == 0xFF) {
            return ImageFormat.JPEG;
        }
        if (ascii(head, 0).equals("RIFF") && ascii(head, 8).equals("WEBP")) {
            return ImageFormat.WEBP;
        }
        throw invalid(InvalidMediaReason.UNSUPPORTED_FORMAT, "Only PNG, JPEG and WebP images are accepted.");
    }

    /** Whether a too-short file starts like an accepted format (truncated) rather than something else. */
    private static boolean couldBeImageStart(byte[] head) {
        return startsLike(head, PNG_SIGNATURE)
                || startsLike(head, new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF})
                || startsLike(head, "RIFF".getBytes(StandardCharsets.US_ASCII));
    }

    private static boolean startsLike(byte[] head, byte[] signature) {
        int length = Math.min(head.length, signature.length);
        return Arrays.equals(head, 0, length, signature, 0, length);
    }

    /** Signature, then the IHDR chunk: length 13, type, width, height (big-endian). */
    private static int[] readPngSize(DataInputStream data) throws IOException {
        data.skipNBytes(PNG_SIGNATURE.length);
        int length = data.readInt();
        String type = ascii(data.readNBytes(4), 0);
        if (length != 13 || !type.equals("IHDR")) {
            throw corrupt("The PNG header is invalid.");
        }
        return new int[] {data.readInt(), data.readInt()};
    }

    /** Walks the marker segments until a start-of-frame segment, which holds height and width. */
    private static int[] readJpegSize(DataInputStream data) throws IOException {
        data.skipNBytes(2); // SOI
        while (true) {
            if (data.readUnsignedByte() != 0xFF) {
                throw corrupt("The JPEG structure is invalid.");
            }
            int marker = data.readUnsignedByte();
            while (marker == 0xFF) { // fill bytes
                marker = data.readUnsignedByte();
            }
            if (marker == 0x01 || (marker >= 0xD0 && marker <= 0xD8)) {
                continue; // standalone markers without a length
            }
            if (marker == 0xD9 || marker == 0xDA) {
                throw corrupt("The JPEG has no frame header.");
            }
            int length = data.readUnsignedShort();
            if (length < 2) {
                throw corrupt("The JPEG structure is invalid.");
            }
            if (isStartOfFrame(marker)) {
                if (length < 8) {
                    throw corrupt("The JPEG frame header is invalid.");
                }
                data.readUnsignedByte(); // sample precision
                int height = data.readUnsignedShort();
                int width = data.readUnsignedShort();
                return new int[] {width, height};
            }
            data.skipNBytes(length - 2);
        }
    }

    /** SOF0..SOF15 except DHT (C4), JPG (C8) and DAC (CC). */
    private static boolean isStartOfFrame(int marker) {
        return marker >= 0xC0 && marker <= 0xCF && marker != 0xC4 && marker != 0xC8 && marker != 0xCC;
    }

    /** RIFF header, then the first chunk: lossy VP8, lossless VP8L or extended VP8X. */
    private static int[] readWebpSize(DataInputStream data) throws IOException {
        data.skipNBytes(HEAD_LENGTH);
        String chunk = ascii(data.readNBytes(4), 0);
        data.skipNBytes(4); // chunk size
        switch (chunk) {
            case "VP8 " -> {
                byte[] frame = data.readNBytes(10);
                if (frame.length < 10 || (frame[3] & 0xFF) != 0x9D || (frame[4] & 0xFF) != 0x01
                        || (frame[5] & 0xFF) != 0x2A) {
                    throw corrupt("The WebP (VP8) header is invalid.");
                }
                return new int[] {littleEndian(frame, 6, 2) & 0x3FFF, littleEndian(frame, 8, 2) & 0x3FFF};
            }
            case "VP8L" -> {
                byte[] header = data.readNBytes(5);
                if (header.length < 5 || (header[0] & 0xFF) != 0x2F) {
                    throw corrupt("The WebP (VP8L) header is invalid.");
                }
                int bits = littleEndian(header, 1, 4);
                return new int[] {(bits & 0x3FFF) + 1, ((bits >>> 14) & 0x3FFF) + 1};
            }
            case "VP8X" -> {
                byte[] header = data.readNBytes(10);
                if (header.length < 10) {
                    throw corrupt("The WebP (VP8X) header is invalid.");
                }
                return new int[] {littleEndian(header, 4, 3) + 1, littleEndian(header, 7, 3) + 1};
            }
            default -> throw corrupt("The WebP container holds no image.");
        }
    }

    private static void checkDimensions(int width, int height, ImageLimits limits) {
        if (width <= 0 || height <= 0) {
            throw corrupt("The image has no pixels.");
        }
        if (width > limits.maxDimension() || height > limits.maxDimension()) {
            throw invalid(InvalidMediaReason.DIMENSION_TOO_LARGE,
                    "Width and height must be at most " + limits.maxDimension() + " pixels.");
        }
        if ((long) width * height > limits.maxPixels()) {
            throw invalid(InvalidMediaReason.TOO_MANY_PIXELS,
                    "The image must have at most " + limits.maxPixels() + " pixels.");
        }
    }

    /** Catches uploads that were cut off. JPEG has no reliable trailer (many valid files carry trailing data). */
    private static void checkCompleteness(ImageFormat format, byte[] head, MeteredInputStream metered) {
        switch (format) {
            case PNG -> {
                if (!Arrays.equals(metered.tail(), PNG_END)) {
                    throw corrupt("The PNG is truncated.");
                }
            }
            case WEBP -> {
                long riffSize = littleEndian(head, 4, 4) & 0xFFFFFFFFL;
                if (riffSize + 8 != metered.count()) {
                    throw corrupt("The WebP is truncated or has trailing data.");
                }
            }
            case JPEG -> {
                // Nothing reliable to check.
            }
        }
    }

    private static String ascii(byte[] bytes, int offset) {
        return bytes.length < offset + 4 ? "" : new String(bytes, offset, 4, StandardCharsets.US_ASCII);
    }

    private static int littleEndian(byte[] bytes, int offset, int length) {
        int value = 0;
        for (int i = length - 1; i >= 0; i--) {
            value = (value << 8) | (bytes[offset + i] & 0xFF);
        }
        return value;
    }

    private static InvalidMediaException corrupt(String message) {
        return invalid(InvalidMediaReason.CORRUPT_IMAGE, message);
    }

    private static InvalidMediaException invalid(InvalidMediaReason reason, String message) {
        return new InvalidMediaException(reason, message);
    }

    /** Counts, hashes and limits every byte that passes through, including skipped ones. */
    private static final class MeteredInputStream extends FilterInputStream {

        private final long limit;
        private final MessageDigest digest;
        private final byte[] tail = new byte[PNG_END.length];
        private long count;

        MeteredInputStream(InputStream in, long limit) {
            super(in);
            this.limit = limit;
            try {
                this.digest = MessageDigest.getInstance("SHA-256");
            } catch (NoSuchAlgorithmException ex) {
                throw new IllegalStateException("SHA-256 is not available", ex);
            }
        }

        @Override
        public int read() throws IOException {
            int value = super.read();
            if (value >= 0) {
                record(new byte[] {(byte) value}, 0, 1);
            }
            return value;
        }

        @Override
        public int read(byte[] buffer, int offset, int length) throws IOException {
            int read = super.read(buffer, offset, length);
            if (read > 0) {
                record(buffer, offset, read);
            }
            return read;
        }

        /** Reads instead of seeking, so skipped bytes are hashed and counted too. */
        @Override
        public long skip(long n) throws IOException {
            byte[] buffer = new byte[(int) Math.min(n, 8192)];
            long skipped = 0;
            while (skipped < n) {
                int read = read(buffer, 0, (int) Math.min(buffer.length, n - skipped));
                if (read < 0) {
                    break;
                }
                skipped += read;
            }
            return skipped;
        }

        void drain() throws IOException {
            byte[] buffer = new byte[8192];
            while (read(buffer, 0, buffer.length) >= 0) {
                // read() records every byte
            }
        }

        long count() {
            return count;
        }

        String sha256Hex() {
            return HexFormat.of().formatHex(digest.digest());
        }

        /** The last bytes read, shorter only if fewer bytes were read in total. */
        byte[] tail() {
            int length = (int) Math.min(count, tail.length);
            return Arrays.copyOfRange(tail, tail.length - length, tail.length);
        }

        private void record(byte[] buffer, int offset, int length) {
            count += length;
            if (count > limit) {
                throw invalid(InvalidMediaReason.TOO_LARGE, "The file must be at most " + limit + " bytes.");
            }
            digest.update(buffer, offset, length);
            if (length >= tail.length) {
                System.arraycopy(buffer, offset + length - tail.length, tail, 0, tail.length);
            } else {
                System.arraycopy(tail, length, tail, 0, tail.length - length);
                System.arraycopy(buffer, offset, tail, tail.length - length, length);
            }
        }
    }
}
