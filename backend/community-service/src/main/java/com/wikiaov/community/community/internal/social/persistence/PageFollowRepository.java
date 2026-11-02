package com.wikiaov.community.community.internal.social.persistence;

import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface PageFollowRepository extends JpaRepository<PageFollow, UUID> {

    Optional<PageFollow> findByPageIdAndActor(UUID pageId, String actor);

    Page<PageFollow> findByPageId(UUID pageId, Pageable pageable);

    long countByPageId(UUID pageId);
}
