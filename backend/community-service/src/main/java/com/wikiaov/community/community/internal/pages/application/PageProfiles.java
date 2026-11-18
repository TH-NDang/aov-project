package com.wikiaov.community.community.internal.pages.application;

import com.wikiaov.community.community.internal.application.PageChecks;
import com.wikiaov.community.community.internal.application.PageViews.Live;
import com.wikiaov.community.community.internal.application.PageViews.PageCard;
import com.wikiaov.community.community.internal.application.PageViews.Profile;
import com.wikiaov.community.community.internal.application.PageViews.TeamAffiliation;
import com.wikiaov.community.community.internal.domain.PageContent;
import com.wikiaov.community.community.internal.domain.PageContent.Kind;
import com.wikiaov.community.community.internal.domain.PageContent.Role;
import com.wikiaov.community.community.internal.domain.PageRules;
import com.wikiaov.community.community.internal.membership.persistence.PageMemberRepository;
import com.wikiaov.community.community.internal.pages.persistence.PageAuditRepository;
import com.wikiaov.community.community.internal.pages.persistence.PageRecord;
import com.wikiaov.community.community.internal.pages.persistence.PageRepository;
import com.wikiaov.community.community.internal.social.persistence.PageFollowRepository;
import com.wikiaov.community.community.internal.social.persistence.PageLiveRepository;
import com.wikiaov.community.platform.CommunityActor;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.tournament.CompetitionAssets;
import com.wikiaov.community.tournament.CompetitionIdentities;
import com.wikiaov.community.tournament.CompetitionReferences;
import com.wikiaov.community.tournament.CompetitionReferences.Subject;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
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
    private static final List<String> INDIVIDUALS = Kind.names(Kind.INDIVIDUALS);
    private static final List<String> IDENTITIES = Kind.names(Kind.IDENTITIES);
    /** The kinds whose competition activity the tournament module publishes. */
    private static final Set<Kind> ACTIVE_KINDS = Set.of(Kind.TEAM, Kind.PLAYER, Kind.ORGANIZATION, Kind.CIRCUIT);
    private final PageRepository pages;
    private final PageAccess access;
    private final PageMemberRepository members;
    private final PageFollowRepository follows;
    private final CompetitionIdentities identities;
    private final CompetitionAssets assets;
    private final PageAuditRepository audits;
    private final List<CompetitionReferences> references;
    private final PageRosterProfiles rosters;
    private final PageLiveRepository lives;

    public PageProfiles(PageRepository pages, PageAccess access, PageMemberRepository members,
            PageFollowRepository follows, CompetitionIdentities identities,
            CompetitionAssets assets, PageAuditRepository audits,
            List<CompetitionReferences> references, PageRosterProfiles rosters, PageLiveRepository lives) {
        this.pages = pages;
        this.access = access;
        this.members = members;
        this.follows = follows;
        this.identities = identities;
        this.assets = assets;
        this.audits = audits;
        this.references = references;
        this.rosters = rosters;
        this.lives = lives;
    }

    @Transactional(readOnly = true)
    public PageSlice<Profile> list(String kind, String query, String personRole, int page, int size, boolean admin) {
        if (admin && !CommunityActor.require().capabilities().contains("tournament:read")) {
            throw PageAccess.forbidden();
        }
        var filter = kind(kind);
        if (query == null || query.length() > 200) {
            throw PageChecks.invalid("Search is too long.");
        }
        String roles = PageChecks.personRoleFilter(personRole);
        return PageSlice.from(pages.search(name(filter), INDIVIDUALS, query, roles, !admin, paging(page, size))
                .map(row -> view(row, admin)));
    }

    @Transactional(readOnly = true)
    public PageSlice<Profile> adminDirectory(String kind, String query, String personRole, String country,
            List<UUID> entityIds, String sort, UUID relatedPageId, int page, int size) {
        if (!CommunityActor.require().capabilities().contains("tournament:read")) {
            throw PageAccess.forbidden();
        }
        var filter = kind(kind);
        if (query == null || query.length() > 200) {
            throw PageChecks.invalid("Search is too long.");
        }
        if (!Set.of("RECENT", "NAME", "ACTIVITY", "ACTIVE").contains(sort)) {
            throw PageChecks.invalid("Invalid page order.");
        }
        if (entityIds.size() > 100) {
            throw PageChecks.invalid("Too many identities.");
        }

        if (sort.equals("ACTIVE")) {
            return byActivity(filter, query, personRole, country, relatedPageId, page, size);
        }

        var identities = entityIds.stream().map(UUID::toString).collect(Collectors.joining(","));
        var rows = pages.adminDirectory(name(filter), INDIVIDUALS, query, PageChecks.personRoleFilter(personRole),
                country, identities, sort, paging(page, size));
        return PageSlice.from(rows.map(row -> view(row, true)));
    }

    private PageSlice<Profile> byActivity(Kind kind, String query, String personRole, String country,
            UUID relatedPageId, int page, int size) {
        var roles = PageChecks.personRoleFilter(personRole);
        var kinds = kind != null ? Set.of(kind) : roles.isEmpty() ? ACTIVE_KINDS : Set.of(Kind.PLAYER);
        var ranked = pages.byActivity(name(kind), String.join(",", Kind.names(kinds)), IDENTITIES, INDIVIDUALS,
                query, roles, country, relatedPageId == null ? "" : relatedPageId.toString(), paging(page, size));
        var rows = pages.findAllById(ranked.map(PageRepository.ActiveRow::getId).toList()).stream()
                .collect(Collectors.toMap(PageRecord::getId, Function.identity()));

        return PageSlice.from(ranked.map(row -> view(rows.get(row.getId()), true).ranked(row.getLastActiveOn(),
                row.getRelated() ? Boolean.TRUE : null)));
    }

    @Transactional(readOnly = true)
    public Profile read(UUID id, boolean admin) {
        if (admin && !CommunityActor.require().capabilities().contains("tournament:read")) {
            throw PageAccess.forbidden();
        }
        return view(admin ? access.read(id) : access.published(id), admin);
    }

    @Transactional(readOnly = true)
    public List<TeamAffiliation> teams(UUID id, boolean admin) {
        if (admin && !CommunityActor.require().capabilities().contains("tournament:read")) {
            throw PageAccess.forbidden();
        }
        var person = admin ? access.read(id) : access.published(id);
        if (!person.getKind().individual()) {
            throw PageChecks.invalid("Team affiliations belong to individual profiles.");
        }

        return pages.teamsForMember(Kind.TEAM.name(), id.toString(), !admin).stream().flatMap(team -> {
            var content = admin ? team.getContent() : team.getPublishedContent().present(team.getPresentation());
            return content.roster().stream().filter(member -> id.equals(member.pageId()))
                    .map(member -> new TeamAffiliation(team.getId(), team.getCode(), content.name(),
                            content.avatarUrl(), member));
        }).toList();
    }

    @Transactional(readOnly = true)
    public PageSlice<Profile> followed(int page, int size) {
        var actor = CommunityActor.require();
        return PageSlice.from(
                pages.followedBy(actor.key(), Kind.CIRCUIT.name(), paging(page, size)).map(row -> view(row, false)));
    }

    @Transactional(readOnly = true)
    public PageSlice<Profile> suggestions(int page, int size) {
        var actor = CommunityActor.require();
        return PageSlice.from(
                pages.suggestedFor(actor.key(), Kind.CIRCUIT.name(), paging(page, size)).map(row -> view(row, false)));
    }

    /** Cards for the published pages among {@code ids}; withdrawn or unknown pages are left out. */
    @Transactional(readOnly = true)
    public Map<UUID, PageCard> cards(Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        var rows = pages.findAllById(ids).stream().filter(row -> row.getPublishedContent() != null).toList();
        if (rows.isEmpty()) {
            return Map.of();
        }
        var represented = members.withRoleAmong(Role.OWNER, rows.stream().map(PageRecord::getId).toList());

        var cards = new HashMap<UUID, PageCard>();
        for (var row : rows) {
            var content = row.getPublishedContent().present(row.getPresentation());
            cards.put(row.getId(), new PageCard(row.getId(), row.getCode(), row.getKind(), content.name(),
                    content.avatarUrl(), represented.contains(row.getId())));
        }
        return cards;
    }

    @Transactional(readOnly = true)
    public Profile byCode(String code) {
        var row = pages.findByCode(code).orElseThrow(PageAccess::missing);
        return read(row.getId(), false);
    }

    @PreAuthorize("hasAuthority('tournament:write') and hasAuthority('tournament:read')")
    public Profile create(PageContent.Kind kind, String code, UUID entityId, PageContent content) {
        var actor = CommunityActor.require();
        PageChecks.content(content);
        assets.acquire(content.avatarUrl(), content.coverUrl());
        if (kind == null || code == null || !code.matches("[a-z0-9][a-z0-9-]{1,99}")) {
            throw PageChecks.invalid("Choose a kind and a lowercase slug of 2 to 100 characters.");
        }
        PageChecks.personRoles(kind, content);
        validateChannelOrganization(kind, content, false);
        content = rosters.resolve(kind, content);
        if (kind.identity()) {
            var identity = entityId == null
                    ? identities.create(identityKind(kind), code, content.name(), content.country(),
                            content.avatarUrl(), actor.key())
                    : identities.read(identityKind(kind), entityId);
            entityId = identity.id();
        } else if (entityId != null) {
            throw PageChecks.invalid("This page kind does not link a competition identity.");
        }

        var row = new PageRecord();
        row.setKind(kind);
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
        PageChecks.content(content);
        assets.acquire(content.avatarUrl(), content.coverUrl());
        var row = access.lock(id);
        PageAccess.version(row.getVersion(), version);
        PageChecks.personRoles(row.getKind(), content);
        validateChannelOrganization(row.getKind(), content, false);
        content = rosters.resolve(row.getKind(), content);
        row.setContent(content);
        row.setUpdatedAt(Instant.now());
        pages.flush();
        access.audit(id, CommunityActor.require(), "PAGE_DRAFT_UPDATED");
        return view(row, true);
    }

    @PreAuthorize("hasAuthority('tournament:publish') and hasAuthority('tournament:read')")
    public Profile publish(UUID id, Long version) {
        assets.acquire();
        var row = access.lock(id);
        PageAccess.version(row.getVersion(), version);
        if (row.getContent().sources().isEmpty()) {
            throw PageChecks.invalid("Add at least one source before publication.");
        }
        validateChannelOrganization(row.getKind(), row.getContent(), true);

        if (row.getEntityId() != null) {
            var content = row.getContent();
            identities.publish(identityKind(row.getKind()), row.getEntityId(), content.name(), content.shortName(),
                    content.country(), content.avatarUrl(), CommunityActor.require().key());
        }
        row.setPublishedContent(row.getContent());
        row.setPublishedAt(Instant.now());
        row.setUpdatedAt(Instant.now());
        pages.flush();
        access.audit(id, CommunityActor.require(), "PAGE_PUBLISHED");
        return view(row, true);
    }

    /** Takes the page out of public view; its draft, history and representatives stay. */
    @PreAuthorize("hasAuthority('tournament:publish') and hasAuthority('tournament:read')")
    public Profile withdraw(UUID id, Long version) {
        assets.acquire();
        var row = access.lock(id);
        PageAccess.version(row.getVersion(), version);

        row.setPublishedContent(null);
        row.setPublishedAt(null);
        row.setUpdatedAt(Instant.now());
        pages.flush();
        access.audit(id, CommunityActor.require(), "PAGE_WITHDRAWN");
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

        if (row.getPublishedContent() != null || audits.existsByPageIdAndAction(id, "PAGE_PUBLISHED")) {
            throw PageAccess.conflict("A page that was published keeps its history. Withdraw it instead.");
        }
        if (pages.countActivity(id) > 0) {
            throw PageAccess.conflict("The page has representatives, requests or community activity.");
        }
        if (pages.countRosterReferences(Kind.TEAM.name(), id.toString()) > 0) {
            throw PageAccess.conflict("A team roster uses this profile.");
        }
        if (pages.countChannelReferences(Kind.CIRCUIT.name(), id.toString()) > 0) {
            throw PageAccess.conflict("A circuit references this organization's channels.");
        }
        if (references.stream().mapToLong(reference -> reference.identityReferences(Subject.PAGE, id)).sum() > 0) {
            throw PageAccess.conflict("A competition uses this page.");
        }

        audits.deleteByPage(id);
        pages.delete(row);
        pages.flush();
        LOG.info("Deleted draft page {} ({}) by {}", id, row.getCode(), actor.key());
    }

    public Profile presentation(UUID id, Long version, PageContent.Presentation content) {
        var actor = CommunityActor.require();
        PageChecks.presentation(content);
        assets.acquire(content.avatarUrl(), content.coverUrl());
        var row = access.lock(id);
        access.require(id, actor, Role.OWNER, Role.EDITOR);
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
        var role = access.role(id, actor);
        if (row.getPublishedContent() == null && role.isEmpty() && !actor.editor()) {
            throw PageAccess.missing();
        }
        return Map.of("role", role.map(Role::name).orElse(""), "following",
                follows.findByPageIdAndActor(id, actor.key()).isPresent(),
                "version", row.getVersion(), "name", actor.name());
    }

    @Transactional(readOnly = true)
    public List<Profile> managed() {
        return members.findByActor(CommunityActor.require().key()).stream()
                .map(member -> access.read(member.getPageId())).filter(PageAccess::community)
                .map(row -> view(row, false)).toList();
    }

    @Transactional(readOnly = true)
    public Profile managed(UUID id) {
        access.require(id, CommunityActor.require(), Role.OWNER, Role.EDITOR, Role.MODERATOR);
        return view(access.read(id), false);
    }

    @Transactional(readOnly = true)
    public Profile byEntity(String kind, UUID id) {
        var named = Kind.named(kind);
        if (named == null) {
            throw PageAccess.missing();
        }
        return read(pages.findByKindAndEntityId(named, id).orElseThrow(PageAccess::missing).getId(), false);
    }

    private void validateChannelOrganization(PageContent.Kind kind, PageContent content, boolean publish) {
        if (content.channelOrganizationId() == null) {
            return;
        }
        if (kind != PageContent.Kind.CIRCUIT) {
            throw PageChecks.invalid("Only circuits can reference an organization's channels.");
        }

        var organization = pages.lock(content.channelOrganizationId())
                .orElseThrow(() -> PageChecks.invalid("The channel organization does not exist."));
        if (organization.getKind() != Kind.ORGANIZATION) {
            throw PageChecks.invalid("Channel references must point to an organization.");
        }
        if (publish && organization.getPublishedContent() == null) {
            throw PageAccess.conflict("Publish the channel organization before publishing the circuit.");
        }
    }

    /** The kind a filter names; null keeps every kind. */
    private static @Nullable Kind kind(@Nullable String filter) {
        if (filter == null) {
            return null;
        }
        var kind = Kind.named(filter);
        if (kind == null) {
            throw PageChecks.invalid("Invalid page kind.");
        }
        return kind;
    }

    private static @Nullable String name(@Nullable Kind kind) {
        return kind == null ? null : kind.name();
    }

    /** Only a team or player page stands for a competition identity. */
    private static CompetitionIdentities.Kind identityKind(Kind kind) {
        return kind == Kind.TEAM ? CompetitionIdentities.Kind.TEAM : CompetitionIdentities.Kind.PLAYER;
    }

    private Profile view(PageRecord row, boolean admin) {
        var content = admin ? row.getContent() : row.getPublishedContent();
        boolean community = PageAccess.community(row);
        if (!admin && content != null && community) {
            content = content.present(row.getPresentation());
        }
        return new Profile(row.getId(), admin ? row.getVersion() : null, row.getCode(), row.getKind(),
                row.getEntityId(),
                content, row.getPublishedContent() != null,
                community && members.existsByPageIdAndRole(row.getId(), Role.OWNER),
                community ? follows.countByPageId(row.getId()) : 0, row.getUpdatedAt(), community ? live(row) : null);
    }

    private Live live(PageRecord row) {
        var since = Instant.now().minus(PageRules.LIVE_WINDOW);
        return lives.findById(row.getId()).filter(live -> live.getStartedAt().isAfter(since))
                .map(live -> new Live(live.getUrl(), live.getTitle(), live.getStartedAt())).orElse(null);
    }

    /** The bounds are declared on the {@code PageApi} parameters; this only builds the request. */
    public static PageRequest paging(int page, int size) {
        return PageRequest.of(page, size);
    }
}
