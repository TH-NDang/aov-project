package com.wikiaov.community.community.internal.membership.persistence;

import com.wikiaov.community.community.internal.domain.PageContent.Role;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PageMemberRepository extends JpaRepository<PageMember, UUID> {

    Optional<PageMember> findByPageIdAndActor(UUID pageId, String actor);

    List<PageMember> findByPageId(UUID pageId);

    List<PageMember> findByActor(String actor);

    boolean existsByPageIdAndRole(UUID pageId, Role role);

    @Query("select m.pageId from PageMember m where m.role = :role and m.pageId in :pages")
    Set<UUID> withRoleAmong(Role role, Collection<UUID> pages);
}
