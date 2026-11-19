package com.wikiaov.community.community.internal.membership.persistence;

import com.wikiaov.community.community.internal.domain.PageContent.Role;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PageInvitationRepository extends JpaRepository<PageInvitation, UUID> {

    Optional<PageInvitation> findByTokenHash(String tokenHash);

    List<PageInvitation> findByPageIdAndAcceptedAtIsNull(UUID pageId);

    List<PageInvitation> findByPageIdAndRoleAndAcceptedAtIsNull(UUID pageId, Role role);
}
