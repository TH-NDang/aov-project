package com.wikiaov.user.internal.account.application.response;

/** Outcome of a confirmed password change. The password itself has changed whenever this is returned. */
public record PasswordChangeResult(
        OtherSessions otherSessions,
        int signedOut
) {
    public enum OtherSessions {
        /** The caller asked to keep other sessions. */
        KEPT,
        SIGNED_OUT,
        /** The password changed but the identity provider did not end every other session. */
        FAILED
    }
}
