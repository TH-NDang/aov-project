CREATE TABLE community.post_like (
 id uuid PRIMARY KEY, post_id uuid NOT NULL REFERENCES community.post(id), actor varchar(1000) NOT NULL,
 created_at timestamptz NOT NULL, UNIQUE(post_id,actor)
);
