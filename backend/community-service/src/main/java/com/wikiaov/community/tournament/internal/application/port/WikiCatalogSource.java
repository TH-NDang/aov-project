package com.wikiaov.community.tournament.internal.application.port;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.Reference;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * The published catalog of wiki-service: markets, seasons with their patches and the reference lists games pick
 * from. Calls leave the service, so they must never run inside a database transaction. A failed call throws
 * {@link Unavailable}.
 */
public interface WikiCatalogSource {
    List<Market> markets();

    CatalogContext context(String region, String locale);

    /** One page of a reference list: {@code heroes}, {@code items}, {@code arcana}, {@code enchantments}, ... */
    ReferencePage references(String kind, ReferenceScope scope, int page);

    record Market(
            String code,
            boolean available
    ) {
    }

    record CatalogContext(
            @Nullable UUID currentRulesetId,
            List<Season> seasons
    ) {
        public CatalogContext {
            seasons = List.copyOf(seasons);
        }
    }

    record Season(
            @Nullable UUID id,
            @Nullable String name,
            List<Patch> patches
    ) {
        public Season {
            patches = List.copyOf(patches);
        }
    }

    record Patch(
            @Nullable UUID id,
            @Nullable String code,
            @Nullable String title,
            @Nullable UUID rulesetId,
            long ordinal
    ) {
    }

    /** Which entries a reference list holds; season and patch narrow it to what existed then. */
    record ReferenceScope(
            String region,
            String locale,
            @Nullable UUID seasonId,
            @Nullable UUID patchVariantId,
            boolean includeUnscoped
    ) {
    }

    record ReferencePage(
            List<Reference> items,
            long totalElements
    ) {
        public ReferencePage {
            items = List.copyOf(items);
        }
    }

    /** wiki-service could not be reached or answered with an error. */
    class Unavailable extends RuntimeException {
        public Unavailable(Throwable cause) {
            super("The wiki catalog is unavailable.", cause);
        }
    }
}
