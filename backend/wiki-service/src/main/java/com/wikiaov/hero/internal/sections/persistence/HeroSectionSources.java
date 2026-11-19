package com.wikiaov.hero.internal.sections.persistence;

import com.wikiaov.hero.internal.domain.HeroContent.Source;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.sections.persistence.entity.SourceReferenceRow;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class HeroSectionSources {
    private final SourceReferenceRepository repository;

    public List<Source> find(HeroSection section, UUID id) {
        return repository.findByOwnerTypeAndOwnerRevisionIdOrderByPosition(section, id).stream()
                .map(HeroSectionSources::source).toList();
    }

    /** Sources of many snapshots in one query; a snapshot without sources has no entry. */
    public Map<UUID, List<Source>> find(HeroSection section, Collection<UUID> ids) {
        return repository.findByOwnerTypeAndOwnerRevisionIdInOrderByPosition(section, ids).stream()
                .collect(Collectors.groupingBy(SourceReferenceRow::getOwnerRevisionId,
                        Collectors.mapping(HeroSectionSources::source, Collectors.toList())));
    }

    private static Source source(SourceReferenceRow row) {
        return new Source(row.getLabel(), row.getSourceUrl(), row.getObservedAt(),
                row.getVerificationState(), row.getNote());
    }

    public void save(HeroSection section, UUID id, List<Source> sources) {
        for (int n = 0; n < sources.size(); n++) {
            var source = sources.get(n);
            repository.save(new SourceReferenceRow(UUID.randomUUID(), section, id, n, source.label(),
                    source.sourceUrl(), source.observedAt(), source.verificationState(), source.note()));
        }
    }
}
