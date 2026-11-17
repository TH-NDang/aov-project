package com.wikiaov.platform.internal.infrastructure;

import java.text.Normalizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.core.JsonParser;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.JacksonModule;
import tools.jackson.databind.deser.jdk.StringDeserializer;
import tools.jackson.databind.deser.std.StdScalarDeserializer;
import tools.jackson.databind.module.SimpleModule;
import tools.jackson.databind.type.LogicalType;

/**
 * Keeps every stored text in Unicode NFC. Text pasted from some sources arrives decomposed (a base letter followed by
 * combining accents): it renders identically, but search, equality and sorting treat it as different text. Spring Boot
 * registers this module on the application {@code JsonMapper}, so request bodies and the import payloads it reads are
 * normalized, including strings inside lists and untyped maps. Object keys are left as they are.
 */
@Configuration(proxyBeanMethods = false)
class TextNormalizationConfiguration {

    @Bean
    JacksonModule nfcTextModule() {
        return new SimpleModule("nfc-text").addDeserializer(String.class, new NfcStringDeserializer());
    }

    static String nfc(String text) {
        if (text == null || Normalizer.isNormalized(text, Normalizer.Form.NFC)) {
            return text;
        }
        return Normalizer.normalize(text, Normalizer.Form.NFC);
    }

    /** Reads a string exactly like Jackson's own deserializer, then normalizes it. */
    static final class NfcStringDeserializer extends StdScalarDeserializer<String> {

        NfcStringDeserializer() {
            super(String.class);
        }

        @Override
        public String deserialize(JsonParser parser, DeserializationContext context) {
            return nfc(StringDeserializer.instance.deserialize(parser, context));
        }

        @Override
        public LogicalType logicalType() {
            return LogicalType.Textual;
        }

        @Override
        public boolean isCachable() {
            return true;
        }

        @Override
        public Object getEmptyValue(DeserializationContext context) {
            return "";
        }
    }
}
