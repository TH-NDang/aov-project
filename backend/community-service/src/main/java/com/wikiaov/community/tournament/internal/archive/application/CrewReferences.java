package com.wikiaov.community.tournament.internal.archive.application;

import com.wikiaov.community.tournament.CompetitionReferences;
import com.wikiaov.community.tournament.internal.archive.persistence.RegistryUsages;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** The profile pages that tournaments and series name for their broadcast and staff stay while they are named. */
@Component
public class CrewReferences implements CompetitionReferences {
    private final RegistryUsages usages;

    public CrewReferences(RegistryUsages usages) {
        this.usages = usages;
    }

    @Override
    public long identityReferences(Subject subject, UUID id) {
        return subject == Subject.PAGE ? usages.crewReferences(id) : 0;
    }

    @Override
    public long mediaReferences(UUID id) {
        return 0;
    }

    @Override
    public List<String> allMediaReferences() {
        return List.of();
    }
}
