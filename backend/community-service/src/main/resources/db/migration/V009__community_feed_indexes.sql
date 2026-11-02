CREATE INDEX post_published_recent ON community.post(created_at DESC, id) WHERE status = 'PUBLISHED';
CREATE INDEX comment_visible_by_post ON community.comment(post_id, created_at) WHERE NOT hidden;
CREATE INDEX follow_by_actor ON community.follow(actor, page_id);
