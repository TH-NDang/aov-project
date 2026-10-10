-- Audit trail of administrative actions (owned by the access module).
-- Append-only: rows can be inserted but never updated or deleted.

CREATE TABLE access.audit_event (
    id             UUID         PRIMARY KEY,
    actor_issuer   TEXT         NOT NULL,
    actor_subject  TEXT         NOT NULL,
    actor_type     VARCHAR(16)  NOT NULL CHECK (actor_type IN ('HUMAN', 'SERVICE')),
    action         VARCHAR(64)  NOT NULL,
    aggregate_type VARCHAR(64)  NOT NULL,
    aggregate_id   UUID         NOT NULL,
    revision_id    UUID         NULL,
    before_version BIGINT       NULL,
    after_version  BIGINT       NULL,
    reason         TEXT         NULL,
    request_id     UUID         NULL,
    occurred_at    TIMESTAMPTZ  NOT NULL,
    metadata       JSONB        NULL
);

CREATE INDEX ix_audit_event_aggregate
    ON access.audit_event (aggregate_type, aggregate_id, occurred_at DESC);

CREATE INDEX ix_audit_event_actor
    ON access.audit_event (actor_issuer, actor_subject, occurred_at DESC);

CREATE FUNCTION access.reject_audit_event_change() RETURNS trigger
    LANGUAGE plpgsql AS
$$
BEGIN
    RAISE EXCEPTION 'access.audit_event is append-only';
END;
$$;

CREATE TRIGGER trg_audit_event_append_only
    BEFORE UPDATE OR DELETE ON access.audit_event
    FOR EACH ROW EXECUTE FUNCTION access.reject_audit_event_change();
