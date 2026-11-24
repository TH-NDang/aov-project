package com.wikiaov.community.tournament;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** Stable editorial pages describing a competition across seasons. */
public interface CompetitionCircuits {
    Circuit read(UUID pageId, boolean published);

    /**
     * What the published circuit pages among {@code pageIds} say about themselves now. A competition keeps the circuit
     * it was published with; its short name and introduction are read anew, so editing the page does not ask for every
     * season to be published again.
     */
    Map<UUID, About> about(Collection<UUID> pageIds);

    /** {@code introduction} is the first paragraph of the page's biography. */
    record About(
            @Nullable String shortName,
            @Nullable String introduction
    ) {
    }

    record Circuit(
            UUID id,
            String code,
            String name,
            String logoUrl,
            boolean published,
            @Nullable String shortName,
            @Nullable String introduction
    ) {
        public Circuit(UUID id, String code, String name, String logoUrl, boolean published) {
            this(id, code, name, logoUrl, published, null, null);
        }

        public Circuit described(About about) {
            return new Circuit(id, code, name, logoUrl, published, about.shortName(), about.introduction());
        }
    }
}
