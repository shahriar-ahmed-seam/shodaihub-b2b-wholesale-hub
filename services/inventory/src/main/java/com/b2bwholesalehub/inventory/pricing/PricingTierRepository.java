package com.b2bwholesalehub.inventory.pricing;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PricingTierRepository extends JpaRepository<PricingTierEntity, UUID> {

  List<PricingTierEntity> findByProductIdOrderByMinQtyAsc(UUID productId);
}
