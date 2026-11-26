package com.wikiaov.community.community.internal.channels.infrastructure;

import com.wikiaov.community.community.internal.channels.application.port.YouTubeSource.Feed;
import com.wikiaov.community.community.internal.channels.application.port.YouTubeSource.Upload;
import java.io.ByteArrayInputStream;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Optional;
import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;
import org.jspecify.annotations.Nullable;

/**
 * Reads a channel feed ({@code /feeds/videos.xml}), an Atom document with YouTube's own and Media RSS elements. A DTD
 * or an external entity is never read.
 */
final class YouTubeFeedReader {
    private static final String ATOM = "http://www.w3.org/2005/Atom";
    private static final String YT = "http://www.youtube.com/xml/schemas/2015";
    private static final String MEDIA = "http://search.yahoo.com/mrss/";
    private static final XMLInputFactory FACTORY = factory();

    private YouTubeFeedReader() {
    }

    private static XMLInputFactory factory() {
        var factory = XMLInputFactory.newFactory();
        factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        factory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
        factory.setProperty(XMLInputFactory.IS_NAMESPACE_AWARE, true);
        factory.setProperty(XMLInputFactory.IS_COALESCING, true);
        return factory;
    }

    static Feed read(byte[] document) throws XMLStreamException {
        XMLStreamReader reader;
        synchronized (FACTORY) {
            reader = FACTORY.createXMLStreamReader(new ByteArrayInputStream(document));
        }
        try {
            return read(reader);
        } finally {
            reader.close();
        }
    }

    private static Feed read(XMLStreamReader reader) throws XMLStreamException {
        String title = "";
        var uploads = new ArrayList<Upload>();
        Entry entry = null;
        int depth = 0;
        while (reader.hasNext()) {
            int event = reader.next();
            if (event == XMLStreamConstants.END_ELEMENT) {
                depth--;
                if (entry != null && depth == 1 && "entry".equals(reader.getLocalName())) {
                    entry.upload().ifPresent(uploads::add);
                    entry = null;
                }
                continue;
            }
            if (event != XMLStreamConstants.START_ELEMENT) {
                continue;
            }
            depth++;

            var space = reader.getNamespaceURI();
            var name = reader.getLocalName();
            if (entry == null) {
                if (depth == 2 && ATOM.equals(space) && name.equals("entry")) {
                    entry = new Entry();
                } else if (depth == 2 && ATOM.equals(space) && name.equals("title")) {
                    title = reader.getElementText().strip();
                    depth--;
                }
                continue;
            }
            if (YT.equals(space) && name.equals("videoId")) {
                entry.id = reader.getElementText().strip();
                depth--;
            } else if (ATOM.equals(space) && name.equals("title") && depth == 3) {
                entry.title = reader.getElementText().strip();
                depth--;
            } else if (ATOM.equals(space) && name.equals("published")) {
                entry.published = reader.getElementText().strip();
                depth--;
            } else if (ATOM.equals(space) && name.equals("link")
                    && "alternate".equals(reader.getAttributeValue(null, "rel"))) {
                entry.link = reader.getAttributeValue(null, "href");
            } else if (MEDIA.equals(space) && name.equals("statistics")) {
                entry.views = reader.getAttributeValue(null, "views");
            }
        }
        return new Feed(title, uploads);
    }

    private static final class Entry {
        @Nullable
        String id;
        @Nullable
        String title;
        @Nullable
        String published;
        @Nullable
        String link;
        @Nullable
        String views;

        Optional<Upload> upload() {
            if (id == null || !id.matches("[\\w-]{11}") || published == null) {
                return Optional.empty();
            }
            Instant at;
            try {
                at = OffsetDateTime.parse(published).toInstant();
            } catch (DateTimeParseException failure) {
                return Optional.empty();
            }
            boolean shortForm = link != null && link.contains("/shorts/");
            return Optional.of(new Upload(id, title == null ? "" : title, at, count(views), shortForm));
        }
    }

    static @Nullable Long count(@Nullable String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            long parsed = Long.parseLong(value.strip());
            return parsed < 0 ? null : parsed;
        } catch (NumberFormatException failure) {
            return null;
        }
    }
}
