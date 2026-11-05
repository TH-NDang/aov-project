ALTER TABLE community.post
 ADD COLUMN kind varchar(20) NOT NULL DEFAULT 'TEXT',
 ADD COLUMN title varchar(200),
 ADD COLUMN video_url varchar(2000),
 ADD COLUMN image_urls jsonb NOT NULL DEFAULT '[]',
 ADD COLUMN pinned_at timestamptz;
CREATE UNIQUE INDEX post_single_pin ON community.post(page_id) WHERE pinned_at IS NOT NULL;
CREATE TABLE community.page_live (
 page_id uuid PRIMARY KEY REFERENCES community.page(id), url varchar(2000) NOT NULL, title varchar(200) NOT NULL,
 started_at timestamptz NOT NULL
);
