package com.b2bwholesalehub.inventory.common;

/**
 * Identity header names injected by the BFF after it verifies the JWT once at the edge. The
 * Inventory Service trusts these internal headers and performs fine-grained ownership checks on top
 * of them. (Req 2.1, 2.2, 2.4)
 */
public final class Identity {

  public static final String USER_ID_HEADER = "X-User-Id";
  public static final String USER_ROLE_HEADER = "X-User-Role";

  public static final String ROLE_SUPPLIER = "SUPPLIER";
  public static final String ROLE_RETAILER = "RETAILER";
  public static final String ROLE_ADMINISTRATOR = "ADMINISTRATOR";

  private Identity() {}
}
