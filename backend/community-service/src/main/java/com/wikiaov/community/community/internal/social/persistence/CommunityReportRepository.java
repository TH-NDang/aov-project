package com.wikiaov.community.community.internal.social.persistence;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommunityReportRepository extends JpaRepository<CommunityReport, UUID> {

    Page<CommunityReport> findByResolvedFalseOrderByCreatedAtAsc(Pageable pageable);
}
