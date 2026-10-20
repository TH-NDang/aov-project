package com.wikiaov.terminology;
import com.wikiaov.patch.GameplayContext;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Each catalog supplies only records published in the requested gameplay context. */
public interface PublicReferenceProvider {
    List<Candidate> references(String region, String locale);
    List<Candidate> references(Scope scope, String locale);

    /** One resolved context is shared by all modules in a public catalog snapshot. */
    record Scope(
            GameplayContext gameplay,
            Map<UUID, Long> patchOrdinals,
            Instant at
    ) {
        public Scope {
            patchOrdinals = Map.copyOf(patchOrdinals);
        }
    }
    record Candidate(
            UUID id,
            String kind,
            String name,
            String description,
            String locale,
            String icon
    ) {
    }
}
