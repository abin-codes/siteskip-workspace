package com.siteskip.api.repository;

import com.siteskip.api.model.DomainLink;
import org.springframework.data.jpa.repository.JpaRepository;
//import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;


public interface DomainLinkRepository extends JpaRepository<DomainLink, Long> {
    List<DomainLink> findTop75ByDomainOrderByLastSeenDesc(String domain);
    Optional<DomainLink> findByUrl(String url);
}