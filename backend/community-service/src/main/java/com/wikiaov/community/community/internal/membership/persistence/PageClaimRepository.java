package com.wikiaov.community.community.internal.membership.persistence;

import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface PageClaimRepository extends JpaRepository<PageClaim, UUID> {

    Page<PageClaim> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);

    List<PageClaim> findByActorOrderByCreatedAtDesc(String actor);
}
