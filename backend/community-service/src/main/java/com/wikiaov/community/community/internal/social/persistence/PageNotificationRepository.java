package com.wikiaov.community.community.internal.social.persistence;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface PageNotificationRepository extends JpaRepository<PageNotification, UUID> {

    Page<PageNotification> findByActorOrderByCreatedAtDesc(String actor, Pageable pageable);

    long countByActorAndReadAtIsNull(String actor);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update PageNotification n set n.readAt = :readAt where n.actor = :actor and n.readAt is null")
    int readAll(String actor, Instant readAt);
}
