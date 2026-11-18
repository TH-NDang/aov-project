package com.wikiaov.hero;

import java.util.List;
import java.util.UUID;

public interface HeroChangeQueries {
    List<HeroChangeEntry> forVariant(UUID variantId, String locale);
}
