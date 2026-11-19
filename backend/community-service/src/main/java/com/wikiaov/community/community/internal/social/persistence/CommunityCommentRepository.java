package com.wikiaov.community.community.internal.social.persistence;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

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
