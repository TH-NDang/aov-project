package com.wikiaov.platform;

import com.fasterxml.jackson.annotation.JacksonAnnotationsInside;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import tools.jackson.databind.annotation.JsonDeserialize;
import tools.jackson.databind.deser.jdk.StringDeserializer;

/**
 * Keeps a request string exactly as the client sent it. Request text is normally read in Unicode NFC; a secret such
 * as a password or a one-time code must reach its checker unchanged, or a password set elsewhere in decomposed form
 * would stop matching.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.FIELD, ElementType.METHOD, ElementType.PARAMETER, ElementType.ANNOTATION_TYPE})
@JacksonAnnotationsInside
@JsonDeserialize(using = StringDeserializer.class)
public @interface VerbatimText {
}
