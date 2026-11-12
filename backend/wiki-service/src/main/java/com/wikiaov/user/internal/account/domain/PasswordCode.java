package com.wikiaov.user.internal.account.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Six-digit code mailed to confirm a password change.
 *
 * <p>Only {@code SHA-256(challengeId ":" code)} is stored. The short lifetime and attempt limit, not the hash,
 * protect the small code space; binding the hash to the challenge id stops one stored hash matching another row.
 */
public final class PasswordCode {
    public static final int LENGTH = 6;
    private static final Pattern FORMAT = Pattern.compile("[0-9]{" + LENGTH + "}");

    private PasswordCode() {
    }

    public static String generate(SecureRandom random) {
        return String.format("%0" + LENGTH + "d", random.nextInt(1_000_000));
    }

    public static boolean wellFormed(String code) {
        return code != null && FORMAT.matcher(code).matches();
    }

    public static byte[] hash(UUID challengeId, String code) {
        try {
            return MessageDigest.getInstance("SHA-256")
                    .digest((challengeId + ":" + code).getBytes(StandardCharsets.US_ASCII));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required by the Java platform", exception);
        }
    }

    /** Constant-time comparison against the stored hash. */
    public static boolean matches(UUID challengeId, String code, byte[] storedHash) {
        return wellFormed(code) && MessageDigest.isEqual(hash(challengeId, code), storedHash);
    }
}
