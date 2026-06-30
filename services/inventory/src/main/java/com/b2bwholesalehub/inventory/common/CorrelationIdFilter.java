package com.b2bwholesalehub.inventory.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Reads the {@code X-Correlation-Id} header propagated by the BFF (or mints one when absent), binds
 * it to the SLF4J {@link MDC} so every structured log line carries it, and echoes it back on the
 * response. This is the Spring equivalent of the shared Node correlation-id middleware. (Req 20.2)
 */
@Component
@Order(CorrelationIdFilter.ORDER)
public class CorrelationIdFilter extends OncePerRequestFilter {

  public static final int ORDER = Integer.MIN_VALUE + 10;
  public static final String HEADER = "X-Correlation-Id";
  public static final String MDC_KEY = "correlationId";

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String correlationId = request.getHeader(HEADER);
    if (!StringUtils.hasText(correlationId)) {
      correlationId = UUID.randomUUID().toString();
    }
    MDC.put(MDC_KEY, correlationId);
    response.setHeader(HEADER, correlationId);
    try {
      chain.doFilter(request, response);
    } finally {
      MDC.remove(MDC_KEY);
    }
  }
}
