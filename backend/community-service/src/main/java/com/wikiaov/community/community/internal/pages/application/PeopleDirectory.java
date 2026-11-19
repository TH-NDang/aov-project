package com.wikiaov.community.community.internal.pages.application;

import com.wikiaov.community.community.internal.pages.persistence.PageRepository;
import com.wikiaov.community.tournament.CompetitionPeople;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class PeopleDirectory implements CompetitionPeople {
    private final PageRepository pages;

    public PeopleDirectory(PageRepository pages) {
        this.pages = pages;
    }

    @Override
    public Map<UUID, Person> read(Collection<UUID> pageIds, boolean published) {
        var people = new LinkedHashMap<UUID, Person>();
        if (pageIds.isEmpty()) {
            return people;
        }
        for (var row : pages.findAllById(pageIds)) {
            if (!row.getKind().individual()) {
                continue;
            }
            var shown = row.getPublishedContent();
            if (published && shown != null) {
                shown = shown.present(row.getPresentation());
                people.put(row.getId(), new Person(row.getId(), row.getCode(), shown.name(), shown.avatarUrl(), true));
            } else if (published) {
                people.put(row.getId(), new Person(row.getId(), null, row.getContent().name(), null, false));
            } else {
                var draft = row.getContent();
                people.put(row.getId(), new Person(row.getId(), row.getCode(), draft.name(), draft.avatarUrl(),
                        shown != null));
            }
        }
        return people;
    }
}
