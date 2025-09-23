// Performance Monitoring for MedLink Claims Hub
// This module tracks database, memory, and query performance during load tests

import http from 'k6/http';
import { Trend, Counter, Gauge } from 'k6/metrics';
import { check } from 'k6';
import { BASE_URL, apiRequest } from './helpers.js';

// Custom metrics for performance monitoring
const dbConnectionPoolUsage = new Gauge('db_connection_pool_usage');
const dbActiveConnections = new Gauge('db_active_connections');
const dbQueryDuration = new Trend('db_query_duration');
const dbSlowQueries = new Counter('db_slow_queries');

const memoryHeapUsed = new Gauge('memory_heap_used_mb');
const memoryRSS = new Gauge('memory_rss_mb');
const memoryExternal = new Gauge('memory_external_mb');

const n1QueryDetected = new Counter('n1_queries_detected');
const duplicateQueries = new Counter('duplicate_queries');

// Monitor database performance
export function monitorDatabasePerformance() {
  // Get metrics endpoint data
  const metricsResponse = apiRequest('GET', '/metrics');
  
  if (metricsResponse.status === 200) {
    try {
      const metrics = metricsResponse.json();
      
      // Extract database metrics
      if (metrics.database) {
        // Connection pool metrics
        if (metrics.database.connectionPool) {
          const pool = metrics.database.connectionPool;
          dbConnectionPoolUsage.add(pool.usage || 0);
          dbActiveConnections.add(pool.active || 0);
          
          // Check for connection pool exhaustion
          if (pool.usage > 0.9) {
            console.warn('⚠ Database connection pool usage critical:', pool.usage);
          }
        }
        
        // Query performance metrics
        if (metrics.database.queries) {
          const queries = metrics.database.queries;
          
          // Track slow queries
          if (queries.slowQueries && queries.slowQueries.length > 0) {
            dbSlowQueries.add(queries.slowQueries.length);
            
            queries.slowQueries.forEach(query => {
              dbQueryDuration.add(query.duration);
              
              if (query.duration > 500) {
                console.warn(`⚠ Critical slow query detected: ${query.duration}ms`);
              }
            });
          }
          
          // Detect N+1 query patterns
          if (queries.patterns) {
            const patterns = queries.patterns;
            
            // Check for repeated queries (N+1 indicator)
            Object.entries(patterns).forEach(([pattern, count]) => {
              if (count > 10) {
                n1QueryDetected.add(1);
                console.warn(`⚠ Potential N+1 query pattern detected: ${pattern} executed ${count} times`);
              }
              
              if (count > 5) {
                duplicateQueries.add(count - 1); // Count duplicates
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to parse metrics:', error);
    }
  }
}

// Monitor memory consumption
export function monitorMemoryUsage() {
  const metricsResponse = apiRequest('GET', '/metrics');
  
  if (metricsResponse.status === 200) {
    try {
      const metrics = metricsResponse.json();
      
      if (metrics.memory) {
        const memory = metrics.memory;
        
        // Convert to MB for easier reading
        const heapUsedMB = memory.heapUsed / 1024 / 1024;
        const rssMB = memory.rss / 1024 / 1024;
        const externalMB = memory.external / 1024 / 1024;
        
        memoryHeapUsed.add(heapUsedMB);
        memoryRSS.add(rssMB);
        memoryExternal.add(externalMB);
        
        // Check for memory issues
        const heapPercent = memory.heapUsed / memory.heapTotal;
        if (heapPercent > 0.85) {
          console.warn(`⚠ High memory usage: ${(heapPercent * 100).toFixed(1)}% of heap`);
        }
        
        if (rssMB > 768) {
          console.warn(`⚠ High RSS memory: ${rssMB.toFixed(1)}MB`);
        }
        
        // Check for potential memory leak
        if (metrics.memoryGrowthRate && metrics.memoryGrowthRate > 10) {
          console.warn(`⚠ Potential memory leak detected: ${metrics.memoryGrowthRate}MB/min growth`);
        }
      }
    } catch (error) {
      console.error('Failed to parse memory metrics:', error);
    }
  }
}

// Monitor specific query patterns
export function monitorQueryPatterns() {
  // Test common query patterns that might cause N+1 issues
  const testPatterns = [
    {
      name: 'Claims with attachments',
      endpoint: '/api/claims?include=attachments',
      expectQueries: 2  // Should be 1 query with join, not N+1
    },
    {
      name: 'Claims with patient data',
      endpoint: '/api/claims?include=patient',
      expectQueries: 2
    },
    {
      name: 'Dashboard with full stats',
      endpoint: '/api/dashboard/stats?full=true',
      expectQueries: 5  // Should use optimized queries
    }
  ];
  
  testPatterns.forEach(pattern => {
    const startMetrics = getQueryCount();
    const response = apiRequest('GET', pattern.endpoint);
    const endMetrics = getQueryCount();
    
    if (response.status === 200) {
      const queryCount = endMetrics - startMetrics;
      
      if (queryCount > pattern.expectQueries * 2) {
        n1QueryDetected.add(1);
        console.warn(`⚠ N+1 detected in ${pattern.name}: ${queryCount} queries (expected ~${pattern.expectQueries})`);
      }
    }
  });
}

// Get current query count from metrics
function getQueryCount() {
  const metricsResponse = apiRequest('GET', '/metrics');
  
  if (metricsResponse.status === 200) {
    try {
      const metrics = metricsResponse.json();
      return (metrics.database && metrics.database.totalQueries) || 0;
    } catch (error) {
      return 0;
    }
  }
  
  return 0;
}

// Monitor API endpoint performance
export function monitorEndpointPerformance() {
  const criticalEndpoints = [
    { path: '/api/claims', name: 'Claims List', threshold: 200 },
    { path: '/api/dashboard/stats', name: 'Dashboard', threshold: 300 },
    { path: '/api/auth/user', name: 'User Auth', threshold: 150 }
  ];
  
  const results = [];
  
  criticalEndpoints.forEach(endpoint => {
    const start = Date.now();
    const response = apiRequest('GET', endpoint.path);
    const duration = Date.now() - start;
    
    const passed = duration < endpoint.threshold;
    
    results.push({
      endpoint: endpoint.name,
      duration,
      threshold: endpoint.threshold,
      passed
    });
    
    if (!passed) {
      console.warn(`⚠ ${endpoint.name} exceeded threshold: ${duration}ms > ${endpoint.threshold}ms`);
    }
  });
  
  return results;
}

// Check system health during load test
export function checkSystemHealth() {
  const healthResponse = apiRequest('GET', '/api/health');
  
  if (healthResponse.status !== 200) {
    console.error('❌ System health check failed');
    return false;
  }
  
  try {
    const health = healthResponse.json();
    
    // Check various health indicators
    const issues = [];
    
    if (health.database && health.database.status !== 'healthy') {
      issues.push('Database unhealthy');
    }
    
    if (health.memory && health.memory.heapUsagePercent > 85) {
      issues.push(`High memory usage: ${health.memory.heapUsagePercent}%`);
    }
    
    if (health.api && health.api.errorRate > 0.05) {
      issues.push(`High error rate: ${(health.api.errorRate * 100).toFixed(2)}%`);
    }
    
    if (health.api && health.api.avgResponseTime > 500) {
      issues.push(`High response time: ${health.api.avgResponseTime}ms`);
    }
    
    if (issues.length > 0) {
      console.warn('⚠ System health issues:', issues.join(', '));
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Failed to parse health check:', error);
    return false;
  }
}

// Generate performance monitoring report
export function generatePerformanceReport(data) {
  let report = '=== PERFORMANCE MONITORING REPORT ===\n\n';
  
  // Database Performance
  report += '📊 DATABASE PERFORMANCE\n';
  report += '-----------------------\n';
  
  if (data.metrics.db_connection_pool_usage) {
    const poolUsage = data.metrics.db_connection_pool_usage.values.value;
    report += `Connection Pool Usage: ${(poolUsage * 100).toFixed(1)}%`;
    report += poolUsage > 0.7 ? ' ⚠ WARNING\n' : ' ✅\n';
  }
  
  if (data.metrics.db_active_connections) {
    report += `Active Connections: ${data.metrics.db_active_connections.values.value}\n`;
  }
  
  if (data.metrics.db_slow_queries) {
    const slowQueries = data.metrics.db_slow_queries.values.count;
    report += `Slow Queries Detected: ${slowQueries}`;
    report += slowQueries > 10 ? ' ⚠ WARNING\n' : '\n';
  }
  
  if (data.metrics.n1_queries_detected) {
    const n1Queries = data.metrics.n1_queries_detected.values.count;
    report += `N+1 Query Patterns: ${n1Queries}`;
    report += n1Queries > 0 ? ' ❌ CRITICAL\n' : ' ✅\n';
  }
  
  report += '\n';
  
  // Memory Performance
  report += '💾 MEMORY CONSUMPTION\n';
  report += '--------------------\n';
  
  if (data.metrics.memory_heap_used_mb) {
    const heapUsed = data.metrics.memory_heap_used_mb.values.value;
    report += `Heap Used: ${heapUsed.toFixed(1)}MB`;
    report += heapUsed > 512 ? ' ⚠ WARNING\n' : ' ✅\n';
  }
  
  if (data.metrics.memory_rss_mb) {
    const rss = data.metrics.memory_rss_mb.values.value;
    report += `RSS Memory: ${rss.toFixed(1)}MB`;
    report += rss > 768 ? ' ⚠ WARNING\n' : ' ✅\n';
  }
  
  report += '\n';
  
  // Query Performance
  report += '🔍 QUERY PERFORMANCE\n';
  report += '-------------------\n';
  
  if (data.metrics.db_query_duration) {
    const queryMetrics = data.metrics.db_query_duration.values;
    const avg = queryMetrics.avg ? queryMetrics.avg.toFixed(2) : 'N/A';
    const p95 = queryMetrics['p(95)'] ? queryMetrics['p(95)'].toFixed(2) : 'N/A';
    const p99 = queryMetrics['p(99)'] ? queryMetrics['p(99)'].toFixed(2) : 'N/A';
    report += `Average Query Time: ${avg}ms\n`;
    report += `P95 Query Time: ${p95}ms\n`;
    report += `P99 Query Time: ${p99}ms\n`;
    
    if (queryMetrics['p(99)'] > 500) {
      report += '⚠ Some queries are taking too long\n';
    }
  }
  
  if (data.metrics.duplicate_queries) {
    const duplicates = data.metrics.duplicate_queries.values.count;
    if (duplicates > 100) {
      report += `⚠ High number of duplicate queries: ${duplicates}\n`;
    }
  }
  
  report += '\n';
  
  // Recommendations
  report += '💡 RECOMMENDATIONS\n';
  report += '-----------------\n';
  
  const recommendations = [];
  
  if (data.metrics.n1_queries_detected && data.metrics.n1_queries_detected.values && data.metrics.n1_queries_detected.values.count > 0) {
    recommendations.push('- Optimize N+1 queries using eager loading or query optimization');
  }
  
  if (data.metrics.db_slow_queries && data.metrics.db_slow_queries.values && data.metrics.db_slow_queries.values.count > 10) {
    recommendations.push('- Review and optimize slow queries, consider adding indexes');
  }
  
  if (data.metrics.db_connection_pool_usage && data.metrics.db_connection_pool_usage.values && data.metrics.db_connection_pool_usage.values.value > 0.7) {
    recommendations.push('- Consider increasing database connection pool size');
  }
  
  if (data.metrics.memory_heap_used_mb && data.metrics.memory_heap_used_mb.values && data.metrics.memory_heap_used_mb.values.value > 512) {
    recommendations.push('- Monitor for memory leaks, consider optimizing memory usage');
  }
  
  if (data.metrics.duplicate_queries && data.metrics.duplicate_queries.values && data.metrics.duplicate_queries.values.count > 100) {
    recommendations.push('- Implement query result caching to reduce duplicate queries');
  }
  
  if (recommendations.length === 0) {
    report += '✅ No critical performance issues detected\n';
  } else {
    recommendations.forEach(rec => {
      report += rec + '\n';
    });
  }
  
  return report;
}

// Main monitoring function to be called during tests
export function runPerformanceMonitoring() {
  // Run all monitoring checks
  monitorDatabasePerformance();
  monitorMemoryUsage();
  monitorQueryPatterns();
  
  // Check system health
  const isHealthy = checkSystemHealth();
  
  // Monitor critical endpoints
  const endpointResults = monitorEndpointPerformance();
  
  return {
    healthy: isHealthy,
    endpoints: endpointResults
  };
}

// Export all monitoring functions
export default {
  monitorDatabasePerformance,
  monitorMemoryUsage,
  monitorQueryPatterns,
  checkSystemHealth,
  monitorEndpointPerformance,
  generatePerformanceReport,
  runPerformanceMonitoring
};