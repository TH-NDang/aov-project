-- Editors may rewrite a recorded hero change set while the data is not official yet (ADR-016, 2026-11-27). The history
-- tables still refuse updates and deletes, except inside a transaction that first opened a rewrite with
-- set_config('hero.change_history_rewrite', 'on', true); only the rewrite use case does that.
CREATE OR REPLACE FUNCTION hero.guard_change_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF current_setting('hero.change_history_rewrite', true) = 'on' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Hero patch history is append only';
END $$;
