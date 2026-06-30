package com.b2bwholesalehub.inventory.fulfillment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.b2bwholesalehub.inventory.common.ApiException;
import com.b2bwholesalehub.inventory.common.ErrorCode;
import com.b2bwholesalehub.inventory.order.OrderStatus;
import java.util.Map;
import java.util.Set;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;

/**
 * Feature: b2b-wholesale-hub, Property 22: Fulfillment transitions follow the state machine — for
 * any sub-order and any requested transition (from → to), the transition is accepted if and only if
 * it is an edge in the allowed graph CONFIRMED→PACKED→SHIPPED→DELIVERED (plus
 * PENDING/CONFIRMED→CANCELLED); any other transition is rejected with an invalid-transition error
 * leaving the status unchanged.
 *
 * <p>**Validates: Requirements 12.1, 12.2, 12.3, 12.4**
 */
class FulfillmentStateMachinePropertyTest {

  // Independent oracle of the allowed edges.
  private static final Map<OrderStatus, Set<OrderStatus>> ALLOWED =
      Map.of(
          OrderStatus.PENDING, Set.of(OrderStatus.CANCELLED),
          OrderStatus.CONFIRMED, Set.of(OrderStatus.PACKED, OrderStatus.CANCELLED),
          OrderStatus.PACKED, Set.of(OrderStatus.SHIPPED),
          OrderStatus.SHIPPED, Set.of(OrderStatus.DELIVERED),
          OrderStatus.DELIVERED, Set.of(),
          OrderStatus.CANCELLED, Set.of());

  @Property(tries = 200)
  void acceptedIffEdgeInAllowedGraph(@ForAll OrderStatus from, @ForAll OrderStatus to) {
    boolean expected = ALLOWED.getOrDefault(from, Set.of()).contains(to);
    boolean actual = FulfillmentStateMachine.isAllowed(from, to);
    assertThat(actual).isEqualTo(expected);

    if (expected) {
      assertThatCode(() -> FulfillmentStateMachine.validate(from, to)).doesNotThrowAnyException();
    } else {
      assertThatThrownBy(() -> FulfillmentStateMachine.validate(from, to))
          .isInstanceOf(ApiException.class)
          .satisfies(
              ex -> assertThat(((ApiException) ex).code()).isEqualTo(ErrorCode.INVALID_TRANSITION));
    }
  }
}
