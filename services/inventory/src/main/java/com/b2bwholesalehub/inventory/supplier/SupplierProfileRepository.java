package com.b2bwholesalehub.inventory.supplier;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupplierProfileRepository extends JpaRepository<SupplierProfile, UUID> {

  Optional<SupplierProfile> findByUserId(UUID userId);
}
