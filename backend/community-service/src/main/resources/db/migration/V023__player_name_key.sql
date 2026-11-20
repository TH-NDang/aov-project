-- A name as the duplicate check compares it (spec 04, players with the same name): folded like reference_search, with
-- every character that is not a letter or a digit dropped, so "Anh Duy", "AnhDuy" and "anh-duy" are one name.
CREATE FUNCTION tournament.name_key(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $function$
    SELECT regexp_replace(tournament.normalize_reference_search(value), '[^[:alnum:]]', '', 'g');
$function$;
