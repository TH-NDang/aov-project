package com.wikiaov.community.community.internal.social.persistence;

import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface PageNotificationRepository extends JpaRepository<PageNotification, UUID> {

    Page<PageNotification> findByActorOrderByCreatedAtDesc(String actor, Pageable pageable);

    long countByActorAndReadAtIsNull(String actor);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update PageNotification n set n.readAt = :readAt where n.actor = :actor and n.readAt is null")
    int readAll(String actor, java.time.Instant readAt);
}
