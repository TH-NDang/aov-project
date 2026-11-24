-- Admin lists the history of one plan, newest first (spec 04, plan history).
CREATE INDEX plan_revision_history ON tournament.plan_revision (tournament_id, created_at DESC);
