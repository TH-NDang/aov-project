package com.wikiaov.community.community.internal.pages.persistence;

import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface PageAuditRepository extends JpaRepository<PageAudit, UUID> {

    Page<PageAudit> findByPageIdOrderByOccurredAtDesc(UUID pageId, Pageable pageable);

    boolean existsByPageIdAndAction(UUID pageId, String action);

    @Modifying(flushAutomatically = true)
    @Query("delete from PageAudit audit where audit.pageId = :pageId")
    int deleteByPage(UUID pageId);
}
