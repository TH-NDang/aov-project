package com.wikiaov.access;

/**
 * Append-only audit trail of administrative actions.
 *
 * <p>Must be called inside the transaction that changes the audited state, so that the change and its audit
 * record are committed or rolled back together.
 */
public interface AuditLog {

    void record(AuditEntry entry);
}
