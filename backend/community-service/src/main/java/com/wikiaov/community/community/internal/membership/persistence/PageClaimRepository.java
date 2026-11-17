package com.wikiaov.community.community.internal.membership.persistence;

import com.wikiaov.community.community.internal.domain.ClaimStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PageClaimRepository extends JpaRepository<PageClaim, UUID> {

    Page<PageClaim> findByStatusOrderByCreatedAtDesc(ClaimStatus status, Pageable pageable);

    List<PageClaim> findByActorOrderByCreatedAtDesc(String actor);
}
