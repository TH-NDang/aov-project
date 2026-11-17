package com.wikiaov.platform.internal.infrastructure;

import java.beans.PropertyEditorSupport;
import org.springframework.web.bind.WebDataBinder;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.InitBinder;

/**
 * Reads text from the query string and the path in Unicode NFC, like request bodies (see
 * {@link TextNormalizationConfiguration}). Stored text is NFC, so a search such as {@code q} or {@code prefix} typed
 * in decomposed form would otherwise find nothing. Codes, ids and the other ASCII values pass unchanged.
 */
@ControllerAdvice
class NfcRequestParameters {

    @InitBinder
    void normalizeText(WebDataBinder binder) {
        binder.registerCustomEditor(String.class, new NfcEditor());
    }

    static final class NfcEditor extends PropertyEditorSupport {

        @Override
        public void setAsText(String text) {
            setValue(TextNormalizationConfiguration.nfc(text));
        }
    }
}
