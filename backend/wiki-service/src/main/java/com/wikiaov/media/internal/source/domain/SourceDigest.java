package com.wikiaov.media.internal.source.domain;

import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.regex.Pattern;

/**
 * Reads a whole stream once and reports its SHA-256, its length and its first bytes. Memory use does not depend on the
 * size of the file.
 *
 * @param sha256    lower-case hex digest
 * @param sizeBytes number of bytes read
 * @param head      the first {@link SourceContentTypes#SIGNATURE_LENGTH} bytes, or fewer for a shorter file
 */
public record SourceDigest(
        String sha256,
        long sizeBytes,
        byte[] head
) {

    private static final Pattern SHA256 = Pattern.compile("[0-9a-f]{64}");
    private static final int BUFFER = 64 * 1024;

    public static boolean isSha256(String value) {
        return SHA256.matcher(value).matches();
    }

    public static SourceDigest read(InputStream content) throws IOException {
        MessageDigest digest = sha256Digest();
        byte[] buffer = new byte[BUFFER];
        byte[] head = new byte[SourceContentTypes.SIGNATURE_LENGTH];
        int headLength = 0;
        long size = 0;

        for (int read = content.read(buffer); read >= 0; read = content.read(buffer)) {
            if (headLength < head.length) {
                int copied = Math.min(read, head.length - headLength);
                System.arraycopy(buffer, 0, head, headLength, copied);
                headLength += copied;
            }
            digest.update(buffer, 0, read);
            size += read;
        }

        return new SourceDigest(HexFormat.of().formatHex(digest.digest()), size, Arrays.copyOf(head, headLength));
    }

    private static MessageDigest sha256Digest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("Every Java runtime provides SHA-256", ex);
        }
    }
}
