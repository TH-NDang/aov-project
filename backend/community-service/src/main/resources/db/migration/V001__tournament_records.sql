CREATE SCHEMA tournament;
CREATE TABLE tournament.team (id uuid PRIMARY KEY,version bigint NOT NULL,code varchar(100) NOT NULL UNIQUE,name varchar(200),content jsonb NOT NULL,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,edited_by varchar(1000) NOT NULL);
CREATE TABLE tournament.player (id uuid PRIMARY KEY,version bigint NOT NULL,code varchar(100) NOT NULL UNIQUE,name varchar(200),content jsonb NOT NULL,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,edited_by varchar(1000) NOT NULL);
CREATE TABLE tournament.tournament (id uuid PRIMARY KEY,version bigint NOT NULL,code varchar(100) NOT NULL UNIQUE,name varchar(200),content jsonb NOT NULL,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,edited_by varchar(1000) NOT NULL);
CREATE TABLE tournament.series (id uuid PRIMARY KEY,version bigint NOT NULL,code varchar(100) NOT NULL UNIQUE,name varchar(200),content jsonb NOT NULL,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,edited_by varchar(1000) NOT NULL);
CREATE TABLE tournament.game (id uuid PRIMARY KEY,version bigint NOT NULL,series_id uuid REFERENCES tournament.series(id),game_number integer,content jsonb NOT NULL,published_snapshot jsonb,published_at timestamptz,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,edited_by varchar(1000) NOT NULL,UNIQUE(series_id,game_number),CHECK(game_number IS NULL OR game_number BETWEEN 1 AND 99));
CREATE INDEX game_published_at_idx ON tournament.game(published_at DESC) WHERE published_at IS NOT NULL;
CREATE INDEX game_series ON tournament.game(series_id,game_number);
CREATE TABLE tournament.game_publication (id uuid PRIMARY KEY,game_id uuid NOT NULL REFERENCES tournament.game(id),published_at timestamptz NOT NULL,actor varchar(1000) NOT NULL,action varchar(30) NOT NULL,snapshot jsonb NOT NULL);
CREATE INDEX game_publication_history ON tournament.game_publication(game_id,published_at DESC);

