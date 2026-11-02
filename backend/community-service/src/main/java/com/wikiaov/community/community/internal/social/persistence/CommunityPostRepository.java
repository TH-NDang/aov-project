package com.wikiaov.community.community.internal.social.persistence;

import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface CommunityPostRepository extends JpaRepository<CommunityPost, UUID> {
    @Query("select p from CommunityPost p where p.pageId = :pageId and (p.status = 'PUBLISHED' or (p.actor = :actor and p.status = 'DRAFT')) order by p.createdAt desc")
    org.springframework.data.domain.Page<CommunityPost> visibleTo(UUID pageId, String actor,
            org.springframework.data.domain.Pageable page);

    Page<CommunityPost> findByPageIdAndStatusOrderByCreatedAtDesc(UUID pageId, String status, Pageable pageable);

    @Query("select p from CommunityPost p where p.pageId = :pageId and (p.asPage = true or p.status <> 'DRAFT') order by p.createdAt desc")
    Page<CommunityPost> findByPageIdOrderByCreatedAtDesc(UUID pageId, Pageable pageable);
}
