package com.wikiaov.community.community.internal.social.application;

import com.wikiaov.community.community.internal.social.persistence.CommunityPostRepository;
import com.wikiaov.community.tournament.CompetitionReferences;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Images attached to posts, hidden posts and drafts included, keep their managed asset from being retired. */
@Component
public class PostReferences implements CompetitionReferences {
    private final CommunityPostRepository posts;

    public PostReferences(CommunityPostRepository posts) {
        this.posts = posts;
    }

    @Override
    public long identityReferences(String kind, UUID id) {
        return 0;
    }

    @Override
    public long mediaReferences(UUID id) {
        return posts.countMedia(id.toString());
    }
}
