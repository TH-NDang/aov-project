package com.wikiaov.patch.internal.application.service;

import com.wikiaov.patch.internal.application.RegionErrorCode;
import com.wikiaov.patch.internal.application.mapper.RegionMapper;
import com.wikiaov.patch.internal.application.response.RegionView;
import com.wikiaov.patch.internal.persistence.RegionRepository;
import com.wikiaov.platform.ApiException;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class Regions {
    private final RegionRepository repository;
    private final RegionMapper mapper;

    public Regions(RegionRepository repository, RegionMapper mapper) {
        this.repository = repository;
        this.mapper = mapper;
    }

    public List<RegionView> list() {
        return repository.findAllByOrderBySortOrderAscCodeAsc().stream().map(mapper::toView).toList();
    }

    public RegionView select(String code) {
        var region = repository.findByCode(code)
                .filter(value -> value.isAvailable())
                .orElseThrow(() -> new ApiException(RegionErrorCode.UNSUPPORTED_REGION,
                        "The requested region is unavailable."));
        return mapper.toView(region);
    }
}
