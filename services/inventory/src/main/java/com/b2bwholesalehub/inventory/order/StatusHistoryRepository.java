package com.b2bwholesalehub.inventory.order;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StatusHistoryRepository extends JpaRepository<StatusHistory, UUID> {

  List<StatusHistory> findBySubOrderId(UUID subOrderId);
}
