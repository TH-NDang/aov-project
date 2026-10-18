package com.wikiaov.hero;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface HeroChangeQueries {
    List<Map<String, Object>> forVariant(UUID variantId, String locale);
}
