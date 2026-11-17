package com.wikiaov.community.community.internal.pages.persistence;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface PageAuditRepository extends JpaRepository<PageAudit, UUID> {

    Page<PageAudit> findByPageIdOrderByOccurredAtDesc(UUID pageId, Pageable pageable);

    boolean existsByPageIdAndAction(UUID pageId, String action);

    @Modifying(flushAutomatically = true)
    @Query("delete from PageAudit audit where audit.pageId = :pageId")
    int deleteByPage(UUID pageId);
}
