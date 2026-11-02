CREATE SCHEMA community;
CREATE TABLE community.page (
 id uuid PRIMARY KEY, version bigint NOT NULL DEFAULT 0, code varchar(100) NOT NULL UNIQUE,
 kind varchar(30) NOT NULL, entity_id uuid, content jsonb NOT NULL, published_content jsonb,
 presentation jsonb, published_at timestamptz, updated_at timestamptz NOT NULL,
 UNIQUE(kind, entity_id)
);
CREATE TABLE community.page_member (
 id uuid PRIMARY KEY, page_id uuid NOT NULL REFERENCES community.page(id), actor varchar(1000) NOT NULL,
 name varchar(200) NOT NULL, role varchar(30) NOT NULL, UNIQUE(page_id,actor)
);
CREATE UNIQUE INDEX page_single_owner ON community.page_member(page_id) WHERE role = 'OWNER';
CREATE TABLE community.page_claim (
 id uuid PRIMARY KEY, version bigint NOT NULL DEFAULT 0, page_id uuid NOT NULL REFERENCES community.page(id),
 actor varchar(1000) NOT NULL, name varchar(200) NOT NULL, evidence varchar(4000) NOT NULL,
 status varchar(30) NOT NULL, resolution varchar(2000), reviewed_by varchar(1000), created_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX page_pending_claim ON community.page_claim(page_id,actor) WHERE status = 'PENDING';
CREATE TABLE community.page_invitation (
 id uuid PRIMARY KEY, version bigint NOT NULL DEFAULT 0, page_id uuid NOT NULL REFERENCES community.page(id), token_hash varchar(64) NOT NULL UNIQUE,
 role varchar(30) NOT NULL, expires_at timestamptz NOT NULL, accepted_at timestamptz
);
CREATE TABLE community.post (
 id uuid PRIMARY KEY, version bigint NOT NULL DEFAULT 0, page_id uuid NOT NULL REFERENCES community.page(id),
 actor varchar(1000) NOT NULL, author_name varchar(200) NOT NULL, as_page boolean NOT NULL,
 body text NOT NULL, status varchar(30) NOT NULL, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
);
CREATE INDEX page_post_recent ON community.post(page_id,created_at DESC);
CREATE TABLE community.comment (
 id uuid PRIMARY KEY, post_id uuid NOT NULL REFERENCES community.post(id), actor varchar(1000) NOT NULL,
 author_name varchar(200) NOT NULL, as_page boolean NOT NULL, body varchar(4000) NOT NULL,
 hidden boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL
);
CREATE TABLE community.follow (
 id uuid PRIMARY KEY, page_id uuid NOT NULL REFERENCES community.page(id), actor varchar(1000) NOT NULL,
 UNIQUE(page_id,actor)
);
CREATE TABLE community.report (
 id uuid PRIMARY KEY, page_id uuid NOT NULL REFERENCES community.page(id), post_id uuid REFERENCES community.post(id),
 comment_id uuid REFERENCES community.comment(id), actor varchar(1000) NOT NULL, reason varchar(2000) NOT NULL,
 resolved boolean NOT NULL DEFAULT false, resolution varchar(2000), created_at timestamptz NOT NULL
);
CREATE TABLE community.notification (
 id uuid PRIMARY KEY, actor varchar(1000) NOT NULL, page_id uuid REFERENCES community.page(id),
 message varchar(500) NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL
);
CREATE INDEX notification_inbox ON community.notification(actor,created_at DESC);
CREATE TABLE community.page_audit (
 id uuid PRIMARY KEY, page_id uuid NOT NULL REFERENCES community.page(id), actor varchar(1000) NOT NULL,
 action varchar(100) NOT NULL, occurred_at timestamptz NOT NULL
);
