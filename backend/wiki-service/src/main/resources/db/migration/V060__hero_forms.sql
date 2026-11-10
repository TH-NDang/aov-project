-- ADR-024: a catalog hero can hold ordered forms. Each form is an existing hero aggregate with its own identity,
-- revisions and references; this table only records which hero holds it, under which key and in which order.
CREATE TABLE hero.hero_form (
    hero_id UUID PRIMARY KEY REFERENCES hero.hero(id),
    parent_hero_id UUID NOT NULL REFERENCES hero.hero(id),
    form_key VARCHAR(32) NOT NULL CHECK (form_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    display_order INTEGER NOT NULL CHECK (display_order BETWEEN 1 AND 99),
    created_at TIMESTAMPTZ NOT NULL,
    created_by_issuer TEXT NOT NULL,
    created_by_subject TEXT NOT NULL,
    CHECK (hero_id <> parent_hero_id),
    UNIQUE (parent_hero_id, form_key),
    UNIQUE (parent_hero_id, display_order)
);

CREATE INDEX ix_hero_form_parent ON hero.hero_form(parent_hero_id, display_order);

-- Forms are one level deep, and a form's code is always the holding hero's code followed by the form key, so
-- the Wiki path /hero/<hero>/<form> and the form's own code can always be derived from each other.
CREATE FUNCTION hero.guard_hero_form() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    parent_code TEXT;
    form_code TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM hero.hero_form WHERE hero_id = NEW.parent_hero_id) THEN
        RAISE EXCEPTION 'A hero form cannot hold forms' USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM hero.hero_form WHERE parent_hero_id = NEW.hero_id) THEN
        RAISE EXCEPTION 'A hero that holds forms cannot be a form' USING ERRCODE = 'check_violation';
    END IF;

    SELECT code INTO parent_code FROM hero.hero WHERE id = NEW.parent_hero_id;
    SELECT code INTO form_code FROM hero.hero WHERE id = NEW.hero_id;
    IF form_code IS DISTINCT FROM parent_code || '-' || NEW.form_key THEN
        RAISE EXCEPTION 'A form code must be the hero code followed by the form key'
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END $$;

CREATE TRIGGER trg_hero_form_guard BEFORE INSERT OR UPDATE ON hero.hero_form
    FOR EACH ROW EXECUTE FUNCTION hero.guard_hero_form();
