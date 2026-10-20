CREATE TABLE patch.patch_data_review (
 patch_variant_id UUID PRIMARY KEY REFERENCES patch.patch_variant(id),
 state VARCHAR(24) NOT NULL CHECK(state IN ('IN_PROGRESS','COMPLETE')),
 version BIGINT NOT NULL CHECK(version>0),
 completed_at TIMESTAMPTZ,
 updated_at TIMESTAMPTZ NOT NULL,
 updated_by_issuer TEXT NOT NULL, updated_by_subject TEXT NOT NULL,
 CHECK((state='COMPLETE')=(completed_at IS NOT NULL))
);
