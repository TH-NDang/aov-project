package com.wikiaov.community.community.internal.membership.application;

import com.wikiaov.community.community.internal.application.PageViews.*;
import com.wikiaov.community.community.internal.domain.*;
import com.wikiaov.community.community.internal.membership.persistence.*;
import com.wikiaov.community.community.internal.pages.application.*;
import com.wikiaov.community.community.internal.social.application.PageNotifications;
import com.wikiaov.community.platform.CommunityActor;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PageMemberships {
    private final PageAccess access;
    private final PageMemberRepository members;
    private final PageClaimRepository claims;
    private final PageInvitationRepository invitations;
    private final PageNotifications notifications;

    public PageMemberships(PageAccess access, PageMemberRepository members, PageClaimRepository claims,
            PageInvitationRepository invitations, PageNotifications notifications) {
        this.access = access;
        this.members = members;
        this.claims = claims;
        this.invitations = invitations;
        this.notifications = notifications;
    }

    public Claim request(UUID pageId, String evidence) {
        var actor = CommunityActor.require();
        PageRules.text(evidence, 4000, true);
        access.lock(pageId);
        access.social(pageId);
        if (!access.role(pageId, actor).isEmpty())
            throw PageRules.invalid("This account already manages the page.");
        var row = new PageClaim();
        row.setPageId(pageId);
        row.setActor(actor.key());
        row.setName(actor.name());
        row.setEvidence(evidence);
        row.setStatus("PENDING");
        row.setCreatedAt(Instant.now());
        claims.saveAndFlush(row);
        access.audit(pageId, actor, "PAGE_CLAIM_REQUESTED");
        return view(row);
    }

    @Transactional(readOnly = true)
    public List<Claim> mine() {
        return claims.findByActorOrderByCreatedAtDesc(CommunityActor.require().key()).stream().map(this::view).toList();
    }

    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('tournament:publish') and hasAuthority('tournament:read')")
    public Slice<Claim> pending(int page, int size) {
        return Slice.of(
                claims.findByStatusOrderByCreatedAtDesc("PENDING", PageProfiles.paging(page, size)).map(this::view));
    }

    @PreAuthorize("hasAuthority('tournament:publish') and hasAuthority('tournament:read')")
    public Claim decide(UUID id, Long version, boolean approve, String resolution) {
        var actor = CommunityActor.require();
        PageRules.text(resolution, 2000, true);
        var initial = claims.findById(id).orElseThrow(PageAccess::missing);
        access.lock(initial.getPageId());
        var row = claims.findById(id).orElseThrow(PageAccess::missing);
        PageAccess.version(row.getVersion(), version);
        if (!row.getStatus().equals("PENDING"))
            throw PageRules.invalid("The claim was already reviewed.");
        if (row.getActor().equals(actor.key()))
            throw PageRules.invalid("A different administrator must review this claim.");
        if (approve) {
            PageAccess.requireCommunity(access.read(row.getPageId()));
            if (members.existsByPageIdAndRole(row.getPageId(), "OWNER"))
                throw PageRules.invalid("The page already has an owner. Resolve the ownership dispute first.");
            add(row.getPageId(), row.getActor(), row.getName(), "OWNER");
        }
        row.setStatus(approve ? "APPROVED" : "REJECTED");
        row.setResolution(resolution);
        row.setReviewedBy(actor.key());
        claims.flush();
        access.audit(row.getPageId(), actor, approve ? "PAGE_CLAIM_APPROVED" : "PAGE_CLAIM_REJECTED");
        notifications.send(row.getActor(), row.getPageId(),
                approve ? "Yêu cầu quản lý trang đã được chấp thuận." : "Yêu cầu quản lý trang cần được xem lại.");
        return view(row);
    }

    @Transactional(readOnly = true)
    public List<Member> members(UUID pageId) {
        var actor = CommunityActor.require();
        if (!actor.publisher())
            access.require(pageId, actor, "OWNER", "EDITOR", "MODERATOR");
        return members.findByPageId(pageId).stream()
                .map(row -> new Member(row.getId(), row.getName(), row.getRole(), row.getActor().equals(actor.key())))
                .toList();
    }

    public Map<String, Object> invite(UUID pageId, PageContent.Role role) {
        var actor = CommunityActor.require();
        access.lock(pageId);
        access.require(pageId, actor, "OWNER");
        if (role == null || role == PageContent.Role.OWNER)
            throw PageRules.invalid("Invite an editor or moderator; use ownership transfer for owners.");

        var issued = issue(pageId, role.name());
        access.audit(pageId, actor, "PAGE_MEMBER_INVITED");
        return issued;
    }

    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('tournament:publish') and hasAuthority('tournament:read')")
    public Handover handover(UUID pageId) {
        access.read(pageId);
        var now = Instant.now();
        return invitations.findByPageIdAndRoleAndAcceptedAtIsNull(pageId, "OWNER").stream()
                .filter(row -> row.getExpiresAt().isAfter(now))
                .max(Comparator.comparing(PageInvitation::getExpiresAt))
                .map(row -> new Handover(true, row.getExpiresAt()))
                .orElse(new Handover(false, null));
    }

    /**
     * Issues the one-time code that hands an ownerless page to its real organization, team or player after an
     * administrator verified them outside the system. A new code replaces any earlier one.
     */
    @PreAuthorize("hasAuthority('tournament:publish') and hasAuthority('tournament:read')")
    public Map<String, Object> issueHandover(UUID pageId) {
        var actor = CommunityActor.require();
        var page = access.lock(pageId);
        PageAccess.requireCommunity(page);
        if (page.getPublishedContent() == null)
            throw PageAccess.conflict("Publish the page before handing it over.");
        if (members.existsByPageIdAndRole(pageId, "OWNER"))
            throw PageAccess.conflict("The page already has an owner. Revoke it before handing the page over.");

        expireHandovers(pageId);
        var issued = issue(pageId, "OWNER");
        access.audit(pageId, actor, "PAGE_HANDOVER_ISSUED");
        return Map.of("token", issued.get("token"), "expiresAt", issued.get("expiresAt"));
    }

    @PreAuthorize("hasAuthority('tournament:publish') and hasAuthority('tournament:read')")
    public void cancelHandover(UUID pageId) {
        var actor = CommunityActor.require();
        access.lock(pageId);

        if (expireHandovers(pageId) > 0)
            access.audit(pageId, actor, "PAGE_HANDOVER_CANCELLED");
    }

    public UUID accept(String token) {
        var actor = CommunityActor.require();
        PageRules.text(token, 200, true);
        var initial = invitations.findByTokenHash(hash(token)).orElseThrow(PageAccess::missing);
        PageAccess.requireCommunity(access.lock(initial.getPageId()));
        var row = invitations.findByTokenHash(hash(token)).orElseThrow(PageAccess::missing);
        var handover = row.getRole().equals("OWNER");
        var owned = members.existsByPageIdAndRole(row.getPageId(), "OWNER");
        if (row.getAcceptedAt() != null || !row.getExpiresAt().isAfter(Instant.now()))
            throw PageRules.invalid("Invitation expired or was already used.");
        if (handover && owned)
            throw PageRules.invalid("The page already has an owner.");
        if (!handover && !owned)
            throw PageRules.invalid("The page no longer has a verified owner.");
        if (members.findByPageIdAndActor(row.getPageId(), actor.key()).isPresent())
            throw PageRules.invalid("This account already manages the page.");

        add(row.getPageId(), actor.key(), actor.name(), row.getRole());
        row.setAcceptedAt(Instant.now());
        access.audit(row.getPageId(), actor, handover ? "PAGE_HANDOVER_ACCEPTED" : "PAGE_INVITATION_ACCEPTED");
        if (handover)
            notifications.send(actor.key(), row.getPageId(), "Bạn đã nhận quyền quản trị chính của trang.");
        return row.getPageId();
    }

    public void revoke(UUID pageId, UUID memberId) {
        var actor = CommunityActor.require();
        access.lock(pageId);
        if (!actor.publisher())
            access.require(pageId, actor, "OWNER");
        var member = members.findById(memberId).orElseThrow(PageAccess::missing);
        if (!member.getPageId().equals(pageId))
            throw PageAccess.missing();
        if (member.getRole().equals("OWNER") && !actor.publisher())
            throw PageRules.invalid("Transfer ownership before leaving the page.");
        members.delete(member);
        if (member.getRole().equals("OWNER")) {
            members.findByPageId(pageId).forEach(members::delete);
            invitations.findByPageIdAndAcceptedAtIsNull(pageId)
                    .forEach(invitation -> invitation.setExpiresAt(Instant.now()));
        }
        access.audit(pageId, actor, "PAGE_MEMBERSHIP_REVOKED");
        notifications.send(member.getActor(), pageId, "Quyền quản lý trang của bạn đã được thu hồi.");
    }

    public void transfer(UUID pageId, UUID memberId) {
        var actor = CommunityActor.require();
        access.lock(pageId);
        access.require(pageId, actor, "OWNER");
        var target = members.findById(memberId).orElseThrow(PageAccess::missing);
        if (!target.getPageId().equals(pageId) || target.getActor().equals(actor.key()))
            throw PageRules.invalid("Choose another member of this page.");
        var owner = members.findByPageIdAndActor(pageId, actor.key()).orElseThrow(PageAccess::missing);
        owner.setRole("EDITOR");
        members.flush();
        target.setRole("OWNER");
        invitations.findByPageIdAndAcceptedAtIsNull(pageId)
                .forEach(invitation -> invitation.setExpiresAt(Instant.now()));
        access.audit(pageId, actor, "PAGE_OWNERSHIP_TRANSFERRED");
        notifications.send(target.getActor(), pageId, "Bạn đã nhận quyền quản trị chính của trang.");
    }

    private Map<String, Object> issue(UUID pageId, String role) {
        String token = UUID.randomUUID().toString() + UUID.randomUUID();
        var row = new PageInvitation();
        row.setPageId(pageId);
        row.setRole(role);
        row.setTokenHash(hash(token));
        row.setExpiresAt(Instant.now().plus(7, ChronoUnit.DAYS));
        invitations.save(row);
        return Map.of("id", row.getId(), "token", token, "expiresAt", row.getExpiresAt());
    }

    private int expireHandovers(UUID pageId) {
        var now = Instant.now();
        var live = invitations.findByPageIdAndRoleAndAcceptedAtIsNull(pageId, "OWNER").stream()
                .filter(row -> row.getExpiresAt().isAfter(now))
                .toList();
        live.forEach(row -> row.setExpiresAt(now));
        return live.size();
    }

    private void add(UUID pageId, String actor, String name, String role) {
        var row = new PageMember();
        row.setPageId(pageId);
        row.setActor(actor);
        row.setName(name);
        row.setRole(role);
        members.saveAndFlush(row);
    }

    private Claim view(PageClaim row) {
        return new Claim(row.getId(), row.getVersion(), row.getPageId(),
                access.read(row.getPageId()).getContent().name(),
                row.getName(), row.getEvidence(), row.getStatus(), row.getResolution(), row.getCreatedAt());
    }

    private static String hash(String value) {
        try {
            return HexFormat.of()
                    .formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException error) {
            throw new IllegalStateException(error);
        }
    }
}
