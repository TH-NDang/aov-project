package com.wikiaov.user.internal.account.application.port;

import java.time.Duration;
import java.util.Locale;

/** Transactional email about account security. Implementations must be called outside database transactions. */
public interface AccountMail {
    /** Whether a sender is configured; when false, nothing can be sent. */
    boolean available();

    /**
     * Sends the code that confirms a password change.
     *
     * @throws com.wikiaov.platform.ApiException {@code USER_MAIL_UNAVAILABLE} when the message cannot be sent
     */
    void sendPasswordCode(String to, String code, Duration lifetime, Language language);

    /** Tells the owner that the password changed. Failures are reported to the caller, which may ignore them. */
    void sendPasswordChanged(String to, Language language);

    enum Language {
        VI,
        EN;

        public static Language of(String value) {
            return value != null && value.toLowerCase(Locale.ROOT).startsWith("en") ? EN : VI;
        }
    }
}
