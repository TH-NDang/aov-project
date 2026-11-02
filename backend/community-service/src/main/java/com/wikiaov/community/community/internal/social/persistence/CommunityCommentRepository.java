package com.wikiaov.community.community.internal.social.persistence;

import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface CommunityCommentRepository extends JpaRepository<CommunityComment, UUID> {

    Page<CommunityComment> findByPostIdAndHiddenFalseOrderByCreatedAtAsc(UUID postId, Pageable pageable);

    long countByPostIdAndHiddenFalse(UUID postId);

    @Query("select c.postId as postId, count(c) as comments from CommunityComment c where c.postId in :posts and c.hidden = false group by c.postId")
    List<CommentCount> countByPosts(Collection<UUID> posts);

    interface CommentCount {
        UUID getPostId();

        long getComments();
    }
}
