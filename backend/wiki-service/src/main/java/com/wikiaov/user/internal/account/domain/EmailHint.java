package com.wikiaov.user.internal.account.domain;

/** Masks an email address for display, keeping enough to recognise which inbox received a code. */
public final class EmailHint {
    private static final String DOTS = "•••";

    private EmailHint() {
    }

    public static String mask(String email) {
        int at = email.lastIndexOf('@');
        if (at <= 0 || at == email.length() - 1)
            return DOTS;
        String local = email.substring(0, at);
        String domain = email.substring(at + 1);
        String visible = local.length() <= 2
                ? local.substring(0, 1) + DOTS
                : local.charAt(0) + DOTS + local.charAt(local.length() - 1);
        return visible + "@" + domain;
    }
}
