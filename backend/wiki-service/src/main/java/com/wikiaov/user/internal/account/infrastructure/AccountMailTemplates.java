package com.wikiaov.user.internal.account.infrastructure;

import com.wikiaov.user.internal.account.application.port.AccountMail.Language;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Subject and body of each account email in each language, read once from
 * {@code mail/account/<name>.<language tag>.txt}. A template starts with a {@code Subject: } line and a blank line; the
 * rest is the plain-text body. {@code {name}} placeholders are filled when a mail is written.
 */
final class AccountMailTemplates {
    static final String PASSWORD_CODE = "password-code";
    static final String PASSWORD_CHANGED = "password-changed";

    private static final String SUBJECT = "Subject: ";
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{([A-Za-z]+)}");

    private final Map<String, Mail> templates = new HashMap<>();

    /** Reads every template up front, so a missing or malformed one stops the service at start-up. */
    AccountMailTemplates() {
        for (String name : List.of(PASSWORD_CODE, PASSWORD_CHANGED)) {
            for (Language language : Language.values()) {
                templates.put(path(name, language), read(path(name, language)));
            }
        }
    }

    Mail render(String name, Language language, Map<String, String> values) {
        Mail template = templates.get(path(name, language));
        if (template == null) {
            throw new IllegalArgumentException("Unknown account mail template: " + name);
        }

        return new Mail(fill(template.subject(), values), fill(template.body(), values));
    }

    private static String path(String name, Language language) {
        String tag = switch (language) {
            case VI -> "vi-VN";
            case EN -> "en-US";
        };
        return "mail/account/" + name + "." + tag + ".txt";
    }

    private static Mail read(String path) {
        String text;
        try (InputStream input = AccountMailTemplates.class.getClassLoader().getResourceAsStream(path)) {
            if (input == null) {
                throw new IllegalStateException("Missing account mail template: " + path);
            }
            text = new String(input.readAllBytes(), StandardCharsets.UTF_8).replace("\r\n", "\n");
        } catch (IOException exception) {
            throw new UncheckedIOException("Account mail template could not be read: " + path, exception);
        }

        int blank = text.indexOf("\n\n");
        if (!text.startsWith(SUBJECT) || blank < 0) {
            throw new IllegalStateException("An account mail template starts with a subject line: " + path);
        }
        return new Mail(text.substring(SUBJECT.length(), blank).strip(), text.substring(blank + 2).stripTrailing());
    }

    private static String fill(String text, Map<String, String> values) {
        return PLACEHOLDER.matcher(text).replaceAll(match -> {
            String value = values.get(match.group(1));
            if (value == null) {
                throw new IllegalArgumentException("No value for mail placeholder: " + match.group(1));
            }
            return Matcher.quoteReplacement(value);
        });
    }

    record Mail(
            String subject,
            String body
    ) {
    }
}
