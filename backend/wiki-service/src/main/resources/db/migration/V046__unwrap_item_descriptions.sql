WITH drafts AS (
    SELECT id FROM item.item_revision WHERE state = 'DRAFT' FOR UPDATE
)
UPDATE item.item_translation AS translation
SET description = substring(btrim(description, E' \t\n\r') FROM 2 FOR length(btrim(description, E' \t\n\r')) - 2)
FROM drafts
WHERE translation.revision_id = drafts.id AND btrim(description, E' \t\n\r') LIKE '"%"';
