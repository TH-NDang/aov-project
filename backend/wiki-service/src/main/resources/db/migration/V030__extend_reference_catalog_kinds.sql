ALTER TABLE terminology.entry DROP CONSTRAINT entry_kind_check;
ALTER TABLE terminology.entry ADD CONSTRAINT entry_kind_check
    CHECK (kind IN ('term','hero','item','enchantment','arcana','spell'));
