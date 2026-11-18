package com.wikiaov.community.community.internal.pages.application;

import com.wikiaov.community.community.internal.application.PageChecks;
import com.wikiaov.community.community.internal.domain.PageContent;
import com.wikiaov.community.community.internal.pages.persistence.PageRecord;
import com.wikiaov.community.community.internal.pages.persistence.PageRepository;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/** Resolves roster identity once on save while keeping published team snapshots stable. */
@Component
public class PageRosterProfiles {
    private final PageRepository pages;

    public PageRosterProfiles(PageRepository pages) {
        this.pages = pages;
    }

    public PageContent resolve(PageContent.Kind kind, PageContent content) {
        if (kind != PageContent.Kind.TEAM) {
            return content;
        }
        var ids = content.roster().stream().map(PageContent.Member::pageId).filter(Objects::nonNull).distinct()
                .toList();
        if (ids.isEmpty()) {
            return content;
        }
        var people = pages.findAllById(ids).stream().collect(Collectors.toMap(PageRecord::getId, row -> row));
        for (var id : ids) {
            var person = people.get(id);
            if (person == null || !Set.of("PLAYER", "PERSON").contains(person.getKind())) {
                throw PageChecks.invalid("Team roster members must link an existing individual profile.");
            }
        }

        var roster = content.roster().stream().map(member -> member.pageId() == null
                ? member
                : new PageContent.Member(member.pageId(), people.get(member.pageId()).getContent().name(),
                        member.role(),
                        member.status(), member.startsOn(), member.endsOn(), member.sourceUrl(), member.lane(),
                        member.standing()))
                .toList();
        return new PageContent(content.name(), content.shortName(), content.country(), content.biography(),
                content.avatarUrl(), content.coverUrl(), content.links(), content.sources(), content.history(),
                content.achievements(), roster, content.personRoles(), content.channelOrganizationId());
    }
}
