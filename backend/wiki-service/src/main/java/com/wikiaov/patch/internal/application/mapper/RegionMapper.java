package com.wikiaov.patch.internal.application.mapper;

import com.wikiaov.patch.internal.application.response.RegionView;
import com.wikiaov.patch.internal.persistence.entity.Region;
import com.wikiaov.platform.MappingConfiguration;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(config = MappingConfiguration.class)
public interface RegionMapper {
    @Mapping(target = "timeZone", source = "timezone")
    RegionView toView(Region region);
}
