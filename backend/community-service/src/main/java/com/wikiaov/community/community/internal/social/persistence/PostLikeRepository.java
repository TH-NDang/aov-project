package com.wikiaov.community.community.internal.social.persistence;

import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface PostLikeRepository extends JpaRepository<PostLike, UUID> {

    /**
     * Adds the like unless the account already liked the post, so concurrent repeats need no page lock. Native for
     * ON CONFLICT.
     */
    @Modifying(flushAutomatically = true)
    @Query(value = """
            INSERT INTO community.post_like (id, post_id, actor, created_at)
            VALUES (:id, :postId, :actor, now())
            ON CONFLICT (post_id, actor) DO NOTHING
            """, nativeQuery = true)
    int like(UUID id, UUID postId, String actor);

    @Modifying(flushAutomatically = true)
    @Query("delete from PostLike l where l.postId = :postId and l.actor = :actor")
    int unlike(UUID postId, String actor);

    long countByPostId(UUID postId);

    boolean existsByPostIdAndActor(UUID postId, String actor);

    @Query("select l.postId as postId, count(l) as likes from PostLike l where l.postId in :posts group by l.postId")
    List<LikeCount> countByPosts(Collection<UUID> posts);

    @Query("select l.postId from PostLike l where l.actor = :actor and l.postId in :posts")
    Set<UUID> likedBy(String actor, Collection<UUID> posts);

    interface LikeCount {
        UUID getPostId();

        long getLikes();
    }
}
