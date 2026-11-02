package com.wikiaov.community.community.internal.pages.application;

import com.wikiaov.community.community.internal.application.PageViews.*;
import com.wikiaov.community.community.internal.domain.*;
import com.wikiaov.community.community.internal.membership.persistence.PageMemberRepository;
import com.wikiaov.community.community.internal.pages.persistence.*;
import com.wikiaov.community.community.internal.social.persistence.PageFollowRepository;
import com.wikiaov.community.platform.CommunityActor;
import com.wikiaov.community.tournament.CompetitionIdentities;
import com.wikiaov.community.tournament.CompetitionReferences;
import java.time.Instant;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PageProfiles {
    private static final Logger LOG = LoggerFactory.getLogger(PageProfiles.class);
    private final PageRepository pages;
    private final PageAccess access;
    private final PageMemberRepository members;
    private final PageFollowRepository follows;
    private final CompetitionIdentities identities;
    private final com.wikiaov.community.tournament.CompetitionAssets assets;
    private final PageAuditRepository audits;
    private final List<CompetitionReferences> references;

    public PageProfiles(PageRepository pages, PageAccess access, PageMemberRepository members,
            PageFollowRepository follows, CompetitionIdentities identities,
            com.wikiaov.community.tournament.CompetitionAssets assets, PageAuditRepository audits,
            List<CompetitionReferences> references) {
        this.pages = pages;
        this.access = access;
        this.members = members;
        this.follows = follows;
        this.identities = identities;
        this.assets = assets;
        this.audits = audits;
        this.references = references;
    }

    @Transactional(readOnly = true)
    public Slice<Profile> list(String kind, String query, int page, int size, boolean admin) {
        if (admin && !CommunityActor.require().capabilities().contains("tournament:read"))
            throw PageAccess.forbidden();
        if (kind != null && !Set.of("TEAM", "PLAYER", "ORGANIZATION").contains(kind))
            throw PageRules.invalid("Invalid page kind.");
        if (query == null || query.length() > 200)
            throw PageRules.invalid("Search is too long.");
        return Slice.of(pages.search(kind, query, !admin, paging(page, size)).map(row -> view(row, admin)));
    }

    @Transactional(readOnly = true)
    public Profile read(UUID id, boolean admin) {
        if (admin && !CommunityActor.require().capabilities().contains("tournament:read"))
            throw PageAccess.forbidden();
        return view(admin ? access.read(id) : access.published(id), admin);
    }

    @Transactional(readOnly = true)
    public Profile byCode(String code) {
        var row = pages.findByCode(code).orElseThrow(PageAccess::missing);
        return read(row.getId(), false);
    }

    @PreAuthorize("hasAuthority('tournament:write') and hasAuthority('tournament:read')")
    public Profile create(PageContent.Kind kind, String code, UUID entityId, PageContent content) {
        var actor = CommunityActor.require();
        PageRules.content(content);
        assets.acquire(content.avatarUrl(), content.coverUrl());
        if (kind == null || code == null || !code.matches("[a-z0-9][a-z0-9-]{1,99}"))
            throw PageRules.invalid("Choose a kind and a lowercase slug of 2 to 100 characters.");
        if (kind != PageContent.Kind.ORGANIZATION) {
            var identity = entityId == null
                    ? identities.create(kind.name(), code, content.name(), content.country(), content.avatarUrl(),
                            actor.key())
                    : identities.read(kind.name(), entityId);
            entityId = identity.id();
        } else if (entityId != null)
            throw PageRules.invalid("Organization pages do not link a competition identity.");

        var row = new PageRecord();
        row.setKind(kind.name());
        row.setCode(code);
        row.setEntityId(entityId);
        row.setContent(content);
        row.setUpdatedAt(Instant.now());
        pages.saveAndFlush(row);
        access.audit(row.getId(), actor, "PAGE_CREATED");
        return view(row, true);
    }

    @PreAuthorize("hasAuthority('tournament:write') and hasAuthority('tournament:read')")
    public Profile save(UUID id, Long version, PageContent content) {
        PageRules.content(content);
        assets.acquire(content.avatarUrl(), content.coverUrl());
        var row = access.lock(id);
        PageAccess.version(row.getVersion(), version);
        row.setContent(content);
        row.setUpdatedAt(Instant.now());
        pages.flush();
        access.audit(id, CommunityActor.require(), "PAGE_DRAFT_UPDATED");
        return view(row, true);
    }

    @PreAuthorize("hasAuthority('tournament:publish') and hasAuthority('tournament:read')")
    public Profile publish(UUID id, Long version, boolean publish) {
        assets.acquire();
        var row = access.lock(id);
        PageAccess.version(row.getVersion(), version);
        if (publish && row.getContent().sources().isEmpty())
            throw PageRules.invalid("Add at least one source before publication.");
        if (publish && row.getEntityId() != null) {
            var content = row.getContent();
            identities.publish(row.getKind(), row.getEntityId(), content.name(), content.shortName(), content.country(),
                    content.avatarUrl(), CommunityActor.require().key());
        }
        row.setPublishedContent(publish ? row.getContent() : null);
        row.setPublishedAt(publish ? Instant.now() : null);
        row.setUpdatedAt(Instant.now());
        pages.flush();
        access.audit(id, CommunityActor.require(), publish ? "PAGE_PUBLISHED" : "PAGE_WITHDRAWN");
        return view(row, true);
    }

    /**
     * Deletes a draft that was never public and has no representatives, requests or community activity; anything else
     * keeps its history and is withdrawn instead. A competition that names the page also keeps it.
     */
    @PreAuthorize("hasAuthority('tournament:write') and hasAuthority('tournament:read')")
    public void delete(UUID id, Long version) {
        var actor = CommunityActor.require();
        var row = access.lock(id);
        PageAccess.version(row.getVersion(), version);

        if (row.getPublishedContent() != null || audits.existsByPageIdAndAction(id, "PAGE_PUBLISHED"))
            throw PageAccess.conflict("A page that was published keeps its history. Withdraw it instead.");
        if (pages.countActivity(id) > 0)
            throw PageAccess.conflict("The page has representatives, requests or community activity.");
        if (references.stream().mapToLong(reference -> reference.identityReferences(row.getKind(), id)).sum() > 0)
            throw PageAccess.conflict("A competition uses this page.");

        audits.deleteByPage(id);
        pages.delete(row);
        pages.flush();
        LOG.info("Deleted draft page {} ({}) by {}", id, row.getCode(), actor.key());
    }

    public Profile presentation(UUID id, Long version, PageContent.Presentation content) {
        var actor = CommunityActor.require();
        PageRules.presentation(content);
        assets.acquire(content.avatarUrl(), content.coverUrl());
        var row = access.lock(id);
        access.require(id, actor, "OWNER", "EDITOR");
        PageAccess.version(row.getVersion(), version);
        row.setPresentation(content);
        row.setUpdatedAt(Instant.now());
        pages.flush();
        access.audit(id, actor, "PAGE_PRESENTATION_UPDATED");
        return view(row, false);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> me(UUID id) {
        var actor = CommunityActor.require();
        var row = access.read(id);
        String role = access.role(id, actor);
        if (row.getPublishedContent() == null && role.isEmpty() && !actor.editor())
            throw PageAccess.missing();
        return Map.of("role", role, "following", follows.findByPageIdAndActor(id, actor.key()).isPresent(),
                "version", row.getVersion(), "name", actor.name());
    }

    @Transactional(readOnly = true)
    public List<Profile> managed() {
        return members.findByActor(CommunityActor.require().key()).stream()
                .map(member -> view(access.read(member.getPageId()), false)).toList();
    }

    @Transactional(readOnly = true)
    public Profile managed(UUID id) {
        access.require(id, CommunityActor.require(), "OWNER", "EDITOR", "MODERATOR");
        return view(access.read(id), false);
    }

    @Transactional(readOnly = true)
    public Profile byEntity(String kind, UUID id) {
        return read(pages.findByKindAndEntityId(kind, id).orElseThrow(PageAccess::missing).getId(), false);
    }

    private Profile view(PageRecord row, boolean admin) {
        var content = admin ? row.getContent() : row.getPublishedContent();
        if (!admin && content != null)
            content = content.present(row.getPresentation());
        return new Profile(row.getId(), admin ? row.getVersion() : null, row.getCode(), row.getKind(),
                row.getEntityId(),
                content, row.getPublishedContent() != null, members.existsByPageIdAndRole(row.getId(), "OWNER"),
                follows.countByPageId(row.getId()), row.getUpdatedAt());
    }

    public static PageRequest paging(int page, int size) {
        if (page < 0 || size < 1 || size > 100)
            throw PageRules.invalid("Invalid pagination.");
        return PageRequest.of(page, size);
    }
}
