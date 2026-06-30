package com.b2bwholesalehub.inventory.admin;

/**
 * Marketplace counts surfaced to administrators. (Req 16.5)
 *
 * @param suppliers number of supplier profiles
 * @param retailers number of distinct retailers who have placed orders
 * @param products number of catalog products
 * @param orders number of parent orders
 */
public record MarketplaceMetrics(long suppliers, long retailers, long products, long orders) {}
