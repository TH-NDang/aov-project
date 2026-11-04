CREATE TABLE patch.variant_note (
    id UUID PRIMARY KEY,
    variant_id UUID NOT NULL REFERENCES patch.patch_variant(id),
    locale VARCHAR(35) NOT NULL,
    body TEXT NOT NULL,
    version BIGINT NOT NULL,
    UNIQUE (variant_id, locale)
);
