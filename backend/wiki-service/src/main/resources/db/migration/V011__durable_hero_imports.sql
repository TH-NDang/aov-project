CREATE TABLE hero.import_job (
    id uuid PRIMARY KEY,
    owner_issuer text NOT NULL,
    owner_subject text NOT NULL,
    owner_type varchar(16) NOT NULL,
    request_json text NOT NULL,
    results_json text NOT NULL DEFAULT '[]',
    completed integer NOT NULL DEFAULT 0,
    total integer NOT NULL CHECK (total BETWEEN 1 AND 200),
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    CHECK (completed BETWEEN 0 AND total)
);
CREATE INDEX import_job_owner ON hero.import_job(owner_issuer, owner_subject, created_at DESC);
CREATE INDEX import_job_pending ON hero.import_job(created_at) WHERE completed < total;
