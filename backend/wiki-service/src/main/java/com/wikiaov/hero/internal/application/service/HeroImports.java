package com.wikiaov.hero.internal.application.service;

import com.wikiaov.hero.internal.application.HeroCommands;
import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.HeroImportRequest;
import com.wikiaov.hero.internal.application.HeroImportRequest.Mode;
import com.wikiaov.hero.internal.application.HeroImportRequest.Policy;
import com.wikiaov.hero.internal.application.response.HeroImportPlan;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroImages;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.persistence.HeroIdentityRepository;
import com.wikiaov.hero.internal.persistence.IdentifierAliases;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ApiException;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Service
@PreAuthorize("hasAuthority('hero:write')")
public class HeroImports {
    private final HeroIdentityRepository heroes;
    private final HeroAuthoring authoring;
    private final HeroValidation validation;
    private final GameplayContexts contexts;
    private final JsonMapper json;
    private final IdentifierAliases aliases;

    public record Field(
            String key,
            String label,
            String type
    ) {
    }

    public static final List<Field> FIELDS = List.of(
            new Field("name", "Tên tướng", "text"), new Field("title", "Danh hiệu", "text"),
            new Field("summary", "Giới thiệu", "text"), new Field("lore", "Cốt truyện", "text"),
            new Field("roles", "Vai trò (mảng JSON)", "json"),
            new Field("overviewRatings", "Đánh giá tổng quan (JSON)", "json"),
            new Field("combatStats", "Chỉ số chiến đấu (JSON)", "json"),
            new Field("skills", "Kỹ năng (mảng JSON)", "json"),
            new Field("skins", "Trang phục (mảng JSON)", "json"),
            new Field("images", "Các lựa chọn ảnh tướng (JSON)", "json"),
            new Field("head", "Ảnh đại diện", "image"),
            new Field("portrait", "Ảnh chân dung", "image"),
            new Field("splash", "Ảnh nền", "image"));

    public static final Map<String, List<Field>> RELATION_FIELDS = Map.of(
            "skills", List.of(new Field("skillKey", "Mã kỹ năng", "text"),
                    new Field("kind", "Loại kỹ năng", "text"), new Field("formKey", "Mã dạng tướng", "text"),
                    new Field("displayOrder", "Thứ tự", "number"), new Field("name", "Tên kỹ năng", "text"),
                    new Field("description", "Mô tả kỹ năng", "text"), new Field("effects", "Hiệu ứng", "json"),
                    new Field("iconAssetId", "Ảnh icon kỹ năng", "image")),
            "skins", List.of(new Field("skinKey", "Mã trang phục", "text"),
                    new Field("displayOrder", "Thứ tự", "number"), new Field("rarityCode", "Mã bậc", "text"),
                    new Field("name", "Tên trang phục", "text"), new Field("description", "Mô tả", "text"),
                    new Field("acquisitionNote", "Cách sở hữu", "text"),
                    new Field("artAssetId", "Ảnh nền trang phục", "image"),
                    new Field("headAssetId", "Ảnh head trang phục", "image"),
                    new Field("portraitAssetId", "Ảnh portrait trang phục", "image"),
                    new Field("images", "Các lựa chọn ảnh (JSON)", "json")));

    public HeroImports(HeroIdentityRepository heroes, HeroAuthoring authoring, HeroValidation validation,
            GameplayContexts contexts, JsonMapper json, IdentifierAliases aliases) {
        this.heroes = heroes;
        this.authoring = authoring;
        this.validation = validation;
        this.contexts = contexts;
        this.json = json;
        this.aliases = aliases;
    }

    @Transactional(readOnly = true)
    public HeroImportPlan preview(HeroImportRequest input) {
        try {
            return plan(input);
        } catch (IllegalArgumentException | ClassCastException ex) {
            throw HeroValidation.invalid("An import value has an invalid type or format.");
        }
    }

    private HeroImportPlan plan(HeroImportRequest input) {
        contexts.requireRuleset(input.rulesetId());
        var target = contexts.authoringContext(input.contextId());
        if (!target.rulesetId().equals(input.rulesetId()))
            throw new ApiException(HeroErrorCode.HERO_IMPORT_CONTEXT_CONFLICT,
                    "The selected release belongs to a different ruleset.");
        HeroValidation.locale(input.locale());
        var keys = FIELDS.stream().map(Field::key).toList();
        if (!keys.containsAll(input.values().keySet()) || !keys.containsAll(input.policies().keySet()))
            throw HeroValidation.invalid("Unknown import field.");
        var hero = heroes.findByCode(input.code());
        HeroRevisionView revision = hero.map(h -> select(h.getId(), input, target)).orElse(null);
        var content = revision == null
                ? Map.<HeroSection, Object>of()
                : authoring.preview(revision.heroId(), revision.id());
        Profile profile = (Profile) content.get(HeroSection.PROFILE);
        var translation = profile == null
                ? null
                : profile.translations().stream()
                        .filter(t -> t.locale().equals(input.locale())).findFirst().orElse(null);
        Map<String, Object> before = new LinkedHashMap<>();
        before.put("name", translation == null ? null : translation.name());
        before.put("title", translation == null ? null : translation.title());
        before.put("summary", translation == null ? null : translation.summary());
        before.put("lore", translation == null ? null : translation.lore());
        before.put("roles", profile == null ? Set.of() : profile.roles());
        var ratings = (Ratings) content.get(HeroSection.OVERVIEW_RATINGS);
        before.put("overviewRatings", ratings == null || ratings.scaleCode() == null ? null : ratings);
        var stats = (Stats) content.get(HeroSection.COMBAT_STATS);
        before.put("combatStats", stats == null || stats.values().isEmpty() ? null : stats);
        var skills = (Skills) content.get(HeroSection.SKILLS);
        var skins = (Skins) content.get(HeroSection.SKINS);
        before.put("skills", skills == null ? List.of() : skills.skills());
        before.put("skins", skins == null ? List.of() : skins.skins());
        var bindings = (Bindings) content.get(HeroSection.MEDIA_BINDINGS);
        before.put("images", bindings == null ? Map.of() : bindings.images());
        for (var role : MediaRole.values()) {
            var asset = bindings == null ? null : bindings.bindings().get(role);
            before.put(role.name().toLowerCase(Locale.ROOT), asset == null ? null : asset.toString());
        }
        Map<String, Object> after = new LinkedHashMap<>(before);
        input.values().forEach((key, value) -> {
            var policy = input.policies().getOrDefault(key, Policy.FILL_EMPTY);
            if (policy != Policy.SKIP && !empty(value) && (policy == Policy.OVERWRITE || empty(before.get(key))))
                after.put(key, value);
        });
        // Normalize collections before comparison so a repeated import remains a no-op.
        after.put("roles", json.convertValue(after.get("roles"), Role[].class));
        after.put("skills", json.convertValue(after.get("skills"), Skill[].class));
        var importedSkins = new Skins(Arrays.asList(json.convertValue(after.get("skins"), Skin[].class)), List.of());
        validation.validate(HeroSection.SKINS, importedSkins);
        after.put("skins",
                aliases.skins(hero.map(h -> h.getId()).orElse(null), importedSkins).skins().toArray(Skin[]::new));
        var existingSkins = (Skins) content.get(HeroSection.SKINS);
        if (existingSkins != null) {
            var incomingSkins = new Skins(Arrays.asList((Skin[]) after.get("skins")), List.of());
            validation.validate(HeroSection.SKINS, incomingSkins);
            var retainedSkins = (Skins) HeroImages.retain(existingSkins, incomingSkins);
            after.put("skins", retainedSkins.skins().toArray(Skin[]::new));
        }
        if (bindings != null) {
            Map<MediaRole, UUID> mains = new EnumMap<>(MediaRole.class);
            for (var role : MediaRole.values()) {
                var asset = after.get(role.name().toLowerCase(Locale.ROOT));
                if (asset != null)
                    mains.put(role, UUID.fromString(asset.toString()));
            }
            var incoming = new Bindings(mains, List.of(), imageOptions(after.get("images")));
            validation.validate(HeroSection.MEDIA_BINDINGS, incoming);
            var retained = (Bindings) HeroImages.retain(bindings, incoming);
            after.put("images", retained.images());
        }
        if (!empty(after.get("overviewRatings")))
            after.put("overviewRatings", json.convertValue(after.get("overviewRatings"), Ratings.class));
        if (!empty(after.get("combatStats"))) {
            var importedStats = json.convertValue(after.get("combatStats"), Stats.class);
            validation.validate(HeroSection.COMBAT_STATS, importedStats);
            after.put("combatStats", new Stats(importedStats.values().stream()
                    .sorted(Comparator.comparing(Stat::statKey)).toList(), importedStats.sources()));
        }
        var normalized = json.convertValue(after, Map.class);
        var original = json.convertValue(before, Map.class);
        boolean missing = revision == null && input.mode() != Mode.BASELINE;
        if (!missing)
            validate(input.locale(), normalized, profile);
        boolean changed = !original.equals(normalized);
        List<String> warnings = new ArrayList<>();
        if (((List<?>) normalized.get("roles")).isEmpty())
            warnings.add("Cần bổ sung trước khi xuất bản: vai trò tướng.");
        for (var skill : json.convertValue(normalized.get("skills"), Skill[].class)) {
            for (var text : skill.translations()) {
                if (text.description() == null || text.description().isBlank())
                    warnings.add("Cần bổ sung trước khi xuất bản: mô tả kỹ năng " + skill.skillKey()
                            + " (" + text.locale() + ").");
            }
            if (skill.effects().stream().filter(effect -> effect.effectType().equals("SOURCE_SNAPSHOT"))
                    .anyMatch(effect -> !empty(effect.metadata().get("reviewFlags"))
                            || !empty(effect.metadata().get("review_flags"))))
                warnings.add("Cần kiểm tra nguồn kỹ năng " + skill.skillKey()
                        + ": dữ liệu thu thập còn cảnh báo; không tự suy đoán nội dung bị thiếu.");
        }
        if (missing)
            warnings.add(input.mode() == Mode.CORRECTION
                    ? "Chưa có mốc dữ liệu tại patch này để sửa. Hãy nhập dữ liệu ban đầu."
                    : "Chưa có mốc trước patch này để so sánh. Hãy nhập dữ liệu ban đầu; không suy ngược từ tương lai.");
        if (input.mode() == Mode.BASELINE)
            warnings.add(
                    "Đây là trạng thái đã biết tại patch đã chọn, không phải xác nhận tướng mới ra mắt hay vừa được cập nhật.");
        if (input.mode() == Mode.PATCH_UPDATE && revision != null)
            warnings.add(
                    "Khác biệt giữa các mốc chưa chứng minh game thay đổi ở patch này. Kiểm tra nguồn trước khi ghi changelog; hệ thống không tự tạo changelog.");
        return new HeroImportPlan(input.code(), hero.map(h -> h.getId()).orElse(null),
                revision == null ? null : revision.id(), revision == null ? null : revision.version(),
                original, normalized, changed,
                missing
                        ? "INSUFFICIENT_DATA"
                        : hero.isEmpty()
                                ? "NEW_TO_CATALOG"
                                : input.mode() == Mode.BASELINE && revision == null
                                        ? "BASELINE"
                                        : changed ? "CHANGED" : "UNCHANGED",
                !missing, revision == null ? null : revision.effectiveFromPatchVariantId(), warnings);
    }

    @Transactional(readOnly = true)
    public List<com.wikiaov.patch.AuthoringContext> contexts(UUID regionId, UUID seasonId) {
        return contexts.authoring(regionId, seasonId);
    }

    private HeroRevisionView select(UUID heroId, HeroImportRequest input, com.wikiaov.patch.AuthoringContext target) {
        var revisions = authoring.revisions(heroId).stream()
                .filter(r -> r.rulesetId().equals(target.rulesetId()) && !r.state().equals("DISCARDED")).toList();
        var draft = revisions.stream().filter(r -> r.state().equals("DRAFT")).findFirst();
        if (draft.isPresent()) {
            var r = draft.get();
            if (!Objects.equals(r.effectiveFromPatchVariantId(), target.patchVariantId())
                    || r.cause() != cause(input.mode()))
                throw new ApiException(HeroErrorCode.HERO_IMPORT_DRAFT_CONFLICT,
                        "Another draft exists. Finish or discard it before changing patch or import mode.");
            return r;
        }
        var exact = revisions.stream()
                .filter(r -> Objects.equals(r.effectiveFromPatchVariantId(), target.patchVariantId()))
                .max(Comparator.comparingLong(HeroRevisionView::publicationSequence));
        if (input.mode() == Mode.CORRECTION)
            return exact.orElse(null);
        if (exact.isPresent())
            throw new ApiException(HeroErrorCode.HERO_IMPORT_SNAPSHOT_EXISTS,
                    "This patch already has a snapshot. Choose correction mode.");
        if (input.mode() == Mode.BASELINE)
            return null;
        return revisions.stream().filter(r -> r.effectiveFromPatchVariantId() != null)
                .filter(r -> contexts.variant(r.effectiveFromPatchVariantId()).rulesetOrdinal() < target
                        .rulesetOrdinal())
                .max(Comparator
                        .<HeroRevisionView>comparingLong(
                                r -> contexts.variant(r.effectiveFromPatchVariantId()).rulesetOrdinal())
                        .thenComparingLong(HeroRevisionView::publicationSequence))
                .orElse(null);
    }

    private static Cause cause(Mode mode) {
        return switch (mode) {
            case BASELINE -> Cause.DATA_BASELINE;
            case PATCH_UPDATE -> Cause.GAME_PATCH;
            case CORRECTION -> Cause.IMPORT_CORRECTION;
        };
    }

    @Transactional
    public HeroImportPlan apply(HeroImportRequest input) {
        heroes.findByCode(input.code()).ifPresent(h -> heroes.lockById(h.getId()));
        var plan = preview(input);
        if (!plan.canApply())
            throw new ApiException(HeroErrorCode.HERO_IMPORT_MISSING_BASELINE,
                    "No known snapshot is available for this import mode.");
        if (!Objects.equals(plan.revisionId(), input.expectedRevisionId())
                || !Objects.equals(plan.version(), input.expectedVersion()))
            throw new ApiException(HeroErrorCode.HERO_REVISION_VERSION_CONFLICT,
                    "The import preview is stale. Preview the row again.");
        if (!plan.changed())
            return plan;
        HeroRevisionView draft;
        if (plan.heroId() == null) {
            draft = authoring.create(new HeroCommands.Create(input.code(), input.locale(),
                    (String) plan.after().get("name"), input.rulesetId(), input.contextId()));
        } else if (plan.revisionId() == null) {
            draft = authoring.baseline(plan.heroId(), input.contextId(), input.locale(),
                    (String) plan.after().get("name"));
        } else {
            draft = authoring.read(plan.heroId(), plan.revisionId());
            if (!draft.state().equals("DRAFT"))
                draft = authoring.fork(plan.heroId(), new HeroCommands.Fork(input.rulesetId(), draft.id(),
                        cause(input.mode()), contexts.authoringContext(input.contextId()).patchVariantId(),
                        "Imported hero fields"));
        }
        var content = authoring.preview(draft.heroId(), draft.id());
        Profile profile = (Profile) content.get(HeroSection.PROFILE);
        var next = profile(input.locale(), plan.after(), profile);
        if (!Objects.equals(profile, next))
            draft = authoring.update(draft.heroId(), draft.id(), HeroSection.PROFILE, draft.version(), next,
                    "Imported hero fields");
        for (var field : Map.of("overviewRatings", HeroSection.OVERVIEW_RATINGS,
                "combatStats", HeroSection.COMBAT_STATS).entrySet()) {
            Object value = plan.after().get(field.getKey());
            if (value != null && !Objects.equals(plan.before().get(field.getKey()), value)) {
                Object statisticContent = field.getValue() == HeroSection.OVERVIEW_RATINGS
                        ? json.convertValue(value, Ratings.class)
                        : json.convertValue(value, Stats.class);
                draft = authoring.update(draft.heroId(), draft.id(), field.getValue(), draft.version(),
                        statisticContent, "Imported hero statistics");
            }
        }
        if (!Objects.equals(plan.before().get("skills"), plan.after().get("skills"))) {
            var old = (Skills) content.get(HeroSection.SKILLS);
            draft = authoring.update(draft.heroId(), draft.id(), HeroSection.SKILLS, draft.version(),
                    new Skills(Arrays.asList(json.convertValue(plan.after().get("skills"), Skill[].class)),
                            old == null ? List.of() : old.sources()),
                    "Imported skills");
        }
        if (!Objects.equals(plan.before().get("skins"), plan.after().get("skins"))) {
            var old = (Skins) content.get(HeroSection.SKINS);
            draft = authoring.update(draft.heroId(), draft.id(), HeroSection.SKINS, draft.version(),
                    new Skins(Arrays.asList(json.convertValue(plan.after().get("skins"), Skin[].class)),
                            old == null ? List.of() : old.sources()),
                    "Imported skins");
        }
        var oldBindings = (Bindings) content.get(HeroSection.MEDIA_BINDINGS);
        Map<MediaRole, UUID> links = new EnumMap<>(MediaRole.class);
        if (oldBindings != null)
            links.putAll(oldBindings.bindings());
        boolean mediaChanged = !Objects.equals(plan.before().get("images"), plan.after().get("images"));
        for (var role : MediaRole.values()) {
            String key = role.name().toLowerCase(Locale.ROOT);
            if (!Objects.equals(plan.before().get(key), plan.after().get(key))) {
                links.put(role, UUID.fromString((String) plan.after().get(key)));
                mediaChanged = true;
            }
        }
        if (mediaChanged) {
            draft = authoring.read(draft.heroId(), draft.id());
            authoring.update(draft.heroId(), draft.id(), HeroSection.MEDIA_BINDINGS, draft.version(),
                    new Bindings(links, oldBindings == null ? List.of() : oldBindings.sources(),
                            imageOptions(plan.after().get("images"))),
                    "Imported hero images");
        }
        return preview(input);
    }

    private void validate(String locale, Map<String, Object> values, Profile existing) {
        validation.validate(HeroSection.PROFILE, profile(locale, values, existing));
        if (values.get("overviewRatings") != null)
            validation.validate(HeroSection.OVERVIEW_RATINGS,
                    json.convertValue(values.get("overviewRatings"), Ratings.class));
        if (values.get("combatStats") != null)
            validation.validate(HeroSection.COMBAT_STATS, json.convertValue(values.get("combatStats"), Stats.class));
        Map<MediaRole, UUID> bindings = new EnumMap<>(MediaRole.class);
        for (var role : MediaRole.values()) {
            Object id = values.get(role.name().toLowerCase(Locale.ROOT));
            if (id != null)
                bindings.put(role, UUID.fromString((String) id));
        }
        validation.validate(HeroSection.MEDIA_BINDINGS,
                new Bindings(bindings, List.of(), imageOptions(values.get("images"))));
        var skills = Arrays.asList(json.convertValue(values.get("skills"), Skill[].class));
        if (!skills.isEmpty())
            validation.validate(HeroSection.SKILLS, new Skills(skills, List.of()));
        validation.validate(HeroSection.SKINS,
                new Skins(Arrays.asList(json.convertValue(values.get("skins"), Skin[].class)), List.of()));
    }

    private Map<MediaRole, List<ImageOption>> imageOptions(Object value) {
        var converted = json.convertValue(
                Map.of("bindings", Map.of(), "sources", List.of(), "images", value == null ? Map.of() : value),
                Bindings.class);
        return converted.images();
    }

    private Profile profile(String locale, Map<String, Object> values, Profile old) {
        var translations = new ArrayList<ProfileTranslation>();
        if (old != null)
            old.translations().stream().filter(t -> !t.locale().equals(locale)).forEach(translations::add);
        translations.add(new ProfileTranslation(locale, (String) values.get("name"), (String) values.get("title"),
                (String) values.get("summary"), (String) values.get("lore")));
        return new Profile(translations,
                new LinkedHashSet<>(Arrays.asList(json.convertValue(values.get("roles"), Role[].class))),
                old == null ? List.of() : old.sources());
    }

    private static boolean empty(Object value) {
        return value == null || value instanceof String s && s.isBlank()
                || value instanceof Collection<?> c && c.isEmpty() || value instanceof Map<?, ?> m && m.isEmpty();
    }
}
