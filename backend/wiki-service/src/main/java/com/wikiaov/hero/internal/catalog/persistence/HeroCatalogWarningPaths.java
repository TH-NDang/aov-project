package com.wikiaov.hero.internal.catalog.persistence;

/** JSON paths apply the source-warning exclusions before catalog pagination and counting. */
final class HeroCatalogWarningPaths {
    private static final String CONTENT_WARNING = """
            ? (@.type() == "object"
              && !(exists(@.reviewResolution) && @.reviewResolution == "RESOLVED")
              && !(exists(@.type) && (@.type == "unlabeled_icons"
                || @.type == "screenshot_color_sampling" || @.type == "representative_screenshot_colors"
                || @.type == "visual_bar_measurement" || @.type == "raw_labels_and_values"
                || @.type == "duplicate_source_file"))
              && !(exists(@.type) && @.type == "not_visible_in_source" && exists(@.field)
                && (@.field == "hero.attributes.hero_level" || @.field == "heroLevel")))
            """;
    static final String[] PENDING = {
            "$ ? (@.reviewFlags.type() == \"array\").reviewFlags[*] " + CONTENT_WARNING,
            "$ ? ((!(exists(@.reviewFlags)) || @.reviewFlags == null) && @.review_flags.type() == \"array\").review_flags[*] "
                    + CONTENT_WARNING,
            "$ ? (@.heroReviewFlags.type() == \"array\").heroReviewFlags[*] " + CONTENT_WARNING
    };

    private HeroCatalogWarningPaths() {
    }
}
