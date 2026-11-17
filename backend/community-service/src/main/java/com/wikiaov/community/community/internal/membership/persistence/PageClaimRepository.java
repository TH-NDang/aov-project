package com.wikiaov.community.community.internal.membership.persistence;

import com.wikiaov.community.community.internal.domain.ClaimStatus;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface PageClaimRepository extends JpaRepository<PageClaim, UUID> {

    Page<PageClaim> findByStatusOrderByCreatedAtDesc(ClaimStatus status, Pageable pageable);

    List<PageClaim> findByActorOrderByCreatedAtDesc(String actor);
}
