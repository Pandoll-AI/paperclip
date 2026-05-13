export type ReliabilityTrendDirection = "up" | "down" | "flat" | "insufficient_data";

export interface ReliabilityKpiEntry {
  value: number | null;
  trendDirection: ReliabilityTrendDirection;
  numerator?: number;
  denominator?: number;
  sampleCount?: number;
  sources: string[];
}

export interface ReliabilityMetricQualityEntry {
  value: number | null;
  numerator?: number;
  denominator: number;
}

export interface ReliabilityCoverageEntry {
  eventEnvelopeVersion: number;
  requiredDimensions: string[];
  sourceTables: string[];
}

export interface ReliabilityWindow {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
}

export interface ReliabilityWeeklyReport {
  window: ReliabilityWindow;
  kpis: {
    checkout_success_rate: ReliabilityKpiEntry;
    state_transition_error_rate: ReliabilityKpiEntry;
    blocker_resolution_latency_hours: ReliabilityKpiEntry;
    cycle_time_hours: ReliabilityKpiEntry;
  };
  metric_quality: {
    checkout_failure_coverage: ReliabilityMetricQualityEntry;
    transition_failure_coverage: ReliabilityMetricQualityEntry;
  };
  instrumentation_coverage: {
    reliability_issue_events_v1: ReliabilityCoverageEntry;
  };
}
