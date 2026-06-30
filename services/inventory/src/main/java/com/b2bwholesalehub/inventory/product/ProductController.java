package com.b2bwholesalehub.inventory.product;

import com.b2bwholesalehub.inventory.common.Identity;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Product catalog endpoints for suppliers. (Req 4) */
@RestController
public class ProductController {

  /** Create-product payload. */
  public record CreateProductRequest(
      String name,
      String description,
      String category,
      BigDecimal basePrice,
      Integer moq,
      List<String> imageUrls) {}

  /** Update-product payload (partial). */
  public record UpdateProductRequest(String name, String description, String category) {}

  private final ProductService productService;

  public ProductController(ProductService productService) {
    this.productService = productService;
  }

  @PostMapping("/products")
  public ResponseEntity<Product> create(
      @RequestHeader(Identity.USER_ID_HEADER) UUID userId,
      @RequestBody CreateProductRequest request) {
    Product product =
        productService.create(
            userId,
            request.name(),
            request.description(),
            request.category(),
            request.basePrice(),
            request.moq(),
            request.imageUrls());
    return ResponseEntity.status(HttpStatus.CREATED).body(product);
  }

  @PutMapping("/products/{id}")
  public ResponseEntity<Product> update(
      @RequestHeader(Identity.USER_ID_HEADER) UUID userId,
      @PathVariable UUID id,
      @RequestBody UpdateProductRequest request) {
    return ResponseEntity.ok(
        productService.update(
            userId, id, request.name(), request.description(), request.category()));
  }

  @PostMapping("/products/{id}/publish")
  public ResponseEntity<Product> publish(
      @RequestHeader(Identity.USER_ID_HEADER) UUID userId, @PathVariable UUID id) {
    return ResponseEntity.ok(productService.publish(userId, id));
  }

  @PostMapping("/products/{id}/unpublish")
  public ResponseEntity<Product> unpublish(
      @RequestHeader(Identity.USER_ID_HEADER) UUID userId, @PathVariable UUID id) {
    return ResponseEntity.ok(productService.unpublish(userId, id));
  }

  @GetMapping("/suppliers/me/products")
  public ResponseEntity<Page<Product>> myProducts(
      @RequestHeader(Identity.USER_ID_HEADER) UUID userId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    int clamped = Math.min(Math.max(size, 1), 100);
    return ResponseEntity.ok(
        productService.listOwnProducts(userId, PageRequest.of(Math.max(page, 0), clamped)));
  }
}
