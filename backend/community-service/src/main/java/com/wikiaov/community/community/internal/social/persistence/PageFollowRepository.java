package com.wikiaov.community.community.internal.social.persistence;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PageFollowRepository extends JpaRepository<PageFollow, UUID> {

    Optional<PageFollow> findByPageIdAndActor(UUID pageId, String actor);

    Page<PageFollow> findByPageId(UUID pageId, Pageable pageable);

    long countByPageId(UUID pageId);
}
