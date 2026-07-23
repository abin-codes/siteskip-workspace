package com.siteskip.api.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "domain_links", indexes = {
    @Index(name = "idx_domain", columnList = "domain")
})
@Getter @Setter @NoArgsConstructor
public class DomainLink {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String domain;

    @Column(nullable = false, length = 500)
    private String title;

    @Column(nullable = false, length = 1000, unique = true)
    private String url;

    private LocalDateTime lastSeen;

    public DomainLink(String domain, String title, String url) {
        this.domain = domain;
        this.title = title;
        this.url = url;
        this.lastSeen = LocalDateTime.now();
    }
}