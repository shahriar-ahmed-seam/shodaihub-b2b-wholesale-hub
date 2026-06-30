package com.b2bwholesalehub.inventory.cart;

import com.b2bwholesalehub.inventory.common.ApiException;
import com.b2bwholesalehub.inventory.common.ErrorCode;
import com.b2bwholesalehub.inventory.common.FieldIssue;
import com.b2bwholesalehub.inventory.common.ForbiddenException;
import com.b2bwholesalehub.inventory.common.Money;
import com.b2bwholesalehub.inventory.common.NotFoundException;
import com.b2bwholesalehub.inventory.pricing.PriceResolver;
import com.b2bwholesalehub.inventory.pricing.PricingTierEntity;
import com.b2bwholesalehub.inventory.pricing.PricingTierRepository;
import com.b2bwholesalehub.inventory.pricing.TierRange;
import com.b2bwholesalehub.inventory.product.Product;
import com.b2bwholesalehub.inventory.product.ProductRepository;
import com.b2bwholesalehub.inventory.reservation.ReservationService;
import com.b2bwholesalehub.inventory.reservation.ReserveResult;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Shopping-cart operations for retailers: MOQ-enforced add with reservation, quantity change with
 * price re-resolution and reservation update, multi-vendor grouped view, and removal with
 * reservation release. (Req 9.1–9.6, 7.1, 7.6; Deep-Dive 3)
 */
@Service
public class CartService {

  private final CartRepository cartRepository;
  private final CartItemRepository cartItemRepository;
  private final ProductRepository productRepository;
  private final PricingTierRepository tierRepository;
  private final ReservationService reservationService;

  public CartService(
      CartRepository cartRepository,
      CartItemRepository cartItemRepository,
      ProductRepository productRepository,
      PricingTierRepository tierRepository,
      ReservationService reservationService) {
    this.cartRepository = cartRepository;
    this.cartItemRepository = cartItemRepository;
    this.productRepository = productRepository;
    this.tierRepository = tierRepository;
    this.reservationService = reservationService;
  }

  /**
   * Adds a product to the cart. Succeeds with a resolved per-unit price/subtotal and a fresh stock
   * reservation iff the requested quantity is at least the product MOQ and the sellable stock can
   * cover it. (Req 9.1, 9.2, 7.1)
   */
  @Transactional
  public CartItem addItem(UUID retailerId, UUID productId, int quantity) {
    Product product = requireProduct(productId);
    requireMoq(quantity, product.getMoq());

    CartLineMath.Resolved resolved =
        CartLineMath.resolve(product.getBasePrice(), tiersOf(productId), quantity);

    ReserveResult reservation = reservationService.reserve(productId, retailerId, quantity);
    if (!reservation.granted()) {
      throw insufficientStock(reservation.sellable());
    }

    CartEntity cart = getOrCreateCart(retailerId);
    CartItem item =
        new CartItem(
            UUID.randomUUID(),
            cart.getId(),
            productId,
            product.getSupplierId(),
            quantity,
            resolved.unitPrice(),
            resolved.subtotal(),
            reservation.reservationId());
    cartItemRepository.save(item);
    touch(cart);
    return item;
  }

  /**
   * Changes a line item's quantity: re-resolves the per-unit price against the applicable tier,
   * recomputes the subtotal, and updates the backing reservation to the new quantity. (Req 9.3)
   */
  @Transactional
  public CartItem changeQuantity(UUID retailerId, UUID itemId, int newQuantity) {
    CartItem item = requireOwnedItem(retailerId, itemId);
    Product product = requireProduct(item.getProductId());
    requireMoq(newQuantity, product.getMoq());

    // Update the reservation to the new quantity by releasing the old hold and acquiring a new one.
    // If the new quantity cannot be reserved, restore the original hold and reject so the cart and
    // its reservation stay consistent. (Req 9.3, 7.1, 7.2)
    String oldReservationId = item.getReservationId();
    int oldQuantity = item.getQuantity();
    if (oldReservationId != null) {
      reservationService.release(oldReservationId);
    }
    ReserveResult reservation =
        reservationService.reserve(item.getProductId(), retailerId, newQuantity);
    if (!reservation.granted()) {
      ReserveResult restored =
          reservationService.reserve(item.getProductId(), retailerId, oldQuantity);
      item.setReservationId(restored.granted() ? restored.reservationId() : null);
      cartItemRepository.save(item);
      throw insufficientStock(reservation.sellable());
    }

    BigDecimal unitPrice = resolveUnitPrice(product, newQuantity);
    item.setQuantity(newQuantity);
    item.setResolvedUnitPrice(unitPrice);
    item.setSubtotal(Money.lineSubtotal(unitPrice, newQuantity));
    item.setReservationId(reservation.reservationId());
    cartItemRepository.save(item);
    touchByCart(item.getCartId());
    return item;
  }

  /**
   * Removes a line item, releasing its reservation within 2 seconds via the release script. (Req
   * 7.6)
   */
  @Transactional
  public void removeItem(UUID retailerId, UUID itemId) {
    CartItem item = requireOwnedItem(retailerId, itemId);
    if (item.getReservationId() != null) {
      reservationService.release(item.getReservationId());
    }
    cartItemRepository.delete(item);
    touchByCart(item.getCartId());
  }

  /**
   * Returns the cart grouped by supplier with per-supplier subtotals and the combined total. (Req
   * 9.4–9.6)
   */
  @Transactional(readOnly = true)
  public GroupedCart view(UUID retailerId) {
    List<CartItem> items = currentItems(retailerId);
    List<CartLine> lines = items.stream().map(CartLine::from).toList();
    return CartGrouping.group(lines);
  }

  // --- helpers ---

  List<CartItem> currentItems(UUID retailerId) {
    return cartRepository
        .findByRetailerId(retailerId)
        .map(cart -> cartItemRepository.findByCartIdOrderBySupplierIdAscIdAsc(cart.getId()))
        .orElseGet(List::of);
  }

  private CartEntity getOrCreateCart(UUID retailerId) {
    return cartRepository
        .findByRetailerId(retailerId)
        .orElseGet(() -> cartRepository.save(new CartEntity(UUID.randomUUID(), retailerId)));
  }

  private CartItem requireOwnedItem(UUID retailerId, UUID itemId) {
    CartItem item =
        cartItemRepository
            .findById(itemId)
            .orElseThrow(() -> new NotFoundException("Cart item not found: " + itemId));
    CartEntity cart =
        cartRepository
            .findById(item.getCartId())
            .orElseThrow(() -> new NotFoundException("Cart not found: " + item.getCartId()));
    if (!cart.getRetailerId().equals(retailerId)) {
      throw new ForbiddenException("You do not own this cart item.");
    }
    return item;
  }

  private Product requireProduct(UUID productId) {
    return productRepository
        .findById(productId)
        .orElseThrow(() -> new NotFoundException("Product not found: " + productId));
  }

  private BigDecimal resolveUnitPrice(Product product, int quantity) {
    return PriceResolver.resolveUnitPrice(
        product.getBasePrice(), tiersOf(product.getId()), quantity);
  }

  private List<TierRange> tiersOf(UUID productId) {
    return tierRepository.findByProductIdOrderByMinQtyAsc(productId).stream()
        .map(PricingTierEntity::toRange)
        .toList();
  }

  private void touch(CartEntity cart) {
    cart.setUpdatedAt(Instant.now());
    cartRepository.save(cart);
  }

  private void touchByCart(UUID cartId) {
    cartRepository.findById(cartId).ifPresent(this::touch);
  }

  private static void requireMoq(int quantity, int moq) {
    if (quantity < moq) {
      throw new ApiException(
          ErrorCode.MOQ_NOT_MET,
          HttpStatus.CONFLICT,
          "Quantity is below the product minimum order quantity of " + moq + ".",
          List.of(new FieldIssue("quantity", "must be >= MOQ (" + moq + ")")));
    }
  }

  private static ApiException insufficientStock(long sellable) {
    return new ApiException(
        ErrorCode.INSUFFICIENT_STOCK,
        HttpStatus.CONFLICT,
        "Requested quantity exceeds the sellable quantity of " + sellable + ".",
        List.of(new FieldIssue("quantity", "sellable=" + sellable)));
  }
}
