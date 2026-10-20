package com.wikiaov.spell;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface SpellChangeQueries {
    List<Map<String, Object>> forVariant(UUID variantId, String locale);
}
