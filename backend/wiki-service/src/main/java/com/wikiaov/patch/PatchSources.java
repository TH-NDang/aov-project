package com.wikiaov.patch;

import java.util.List;
import java.util.UUID;

/** The links to the official notes of a patch variant, in the order editors gave them. */
public interface PatchSources {
    List<PatchSource> of(UUID variantId);
}
