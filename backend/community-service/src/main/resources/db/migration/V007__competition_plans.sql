CREATE TABLE tournament.competition_plan (
 id uuid PRIMARY KEY REFERENCES tournament.tournament(id), version bigint NOT NULL DEFAULT 0,
 content jsonb NOT NULL, published_snapshot jsonb, published_at timestamptz,
 updated_at timestamptz NOT NULL, edited_by varchar(1000) NOT NULL
);
CREATE TABLE tournament.plan_revision (
 id uuid PRIMARY KEY, tournament_id uuid NOT NULL REFERENCES tournament.tournament(id),
 content jsonb NOT NULL, action varchar(30) NOT NULL, actor varchar(1000) NOT NULL, created_at timestamptz NOT NULL
);
