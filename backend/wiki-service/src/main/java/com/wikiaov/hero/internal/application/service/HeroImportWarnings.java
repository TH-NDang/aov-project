package com.wikiaov.hero.internal.application.service;

import com.wikiaov.hero.internal.application.HeroImportRequest.Mode;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.domain.HeroContent.Skill;
import java.util.*;
import tools.jackson.databind.json.JsonMapper;

/** Reports publication gaps separately from the historical meaning of an import. */
final class HeroImportWarnings {
    private final JsonMapper json;

    HeroImportWarnings(JsonMapper json) {
        this.json = json;
    }

    List<String> forImport(Mode mode, Map<String, Object> normalized, HeroRevisionView revision, boolean missing) {
        List<String> warnings = new ArrayList<>();
        if (((List<?>) normalized.get("roles")).isEmpty())
            warnings.add("Cần bổ sung trước khi xuất bản: vai trò tướng.");
        addSkillReviewWarnings(normalized, warnings);
        addSnapshotWarnings(mode, revision, missing, warnings);
        return warnings;
    }

    private void addSkillReviewWarnings(Map<String, Object> normalized, List<String> warnings) {
        for (var skill : json.convertValue(normalized.get("skills"), Skill[].class)) {
            for (var text : skill.translations()) {
                if (text.description() == null || text.description().isBlank())
                    warnings.add("Cần bổ sung trước khi xuất bản: mô tả kỹ năng " + skill.skillKey()
                            + " (" + text.locale() + ").");
            }
            if (skill.effects().stream().filter(effect -> effect.effectType().equals("SOURCE_SNAPSHOT"))
                    .anyMatch(effect -> !HeroImportContent.empty(effect.metadata().get("reviewFlags"))
                            || !HeroImportContent.empty(effect.metadata().get("review_flags"))))
                warnings.add("Cần kiểm tra nguồn kỹ năng " + skill.skillKey()
                        + ": dữ liệu thu thập còn cảnh báo; không tự suy đoán nội dung bị thiếu.");
        }
    }

    private void addSnapshotWarnings(Mode mode, HeroRevisionView revision, boolean missing, List<String> warnings) {
        if (missing)
            warnings.add(mode == Mode.CORRECTION
                    ? "Chưa có mốc dữ liệu tại patch này để sửa. Hãy nhập dữ liệu ban đầu."
                    : "Chưa có mốc trước patch này để so sánh. Hãy nhập dữ liệu ban đầu; không suy ngược từ tương lai.");
        if (mode == Mode.BASELINE)
            warnings.add(
                    "Đây là trạng thái đã biết tại patch đã chọn, không phải xác nhận tướng mới ra mắt hay vừa được cập nhật.");
        if (mode == Mode.PATCH_UPDATE && revision != null)
            warnings.add(
                    "Khác biệt giữa các mốc chưa chứng minh game thay đổi ở patch này. Kiểm tra nguồn trước khi ghi changelog; hệ thống không tự tạo changelog.");
    }
}
