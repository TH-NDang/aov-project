package com.wikiaov.community.community.internal.membership.persistence;

import com.wikiaov.community.community.internal.domain.PageContent.Role;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface PageInvitationRepository extends JpaRepository<PageInvitation, UUID> {

    Optional<PageInvitation> findByTokenHash(String tokenHash);

    List<PageInvitation> findByPageIdAndAcceptedAtIsNull(UUID pageId);

    List<PageInvitation> findByPageIdAndRoleAndAcceptedAtIsNull(UUID pageId, Role role);
}
