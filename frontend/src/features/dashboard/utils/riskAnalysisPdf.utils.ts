import { formatMoney } from "@/utils/money";
import dayjs from "dayjs";
import type { AnalyticsResponse, AnalyticsFilters } from "../types";

export function generateRiskAnalysisPDF(
  analytics: AnalyticsResponse,
  filters: AnalyticsFilters,
): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const stats = analytics.stats;
  const filterDescription = getFilterDescription(filters);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Risk Analysis Report - ${dayjs().format("YYYY-MM-DD")}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 30px; max-width: 900px; margin: 0 auto; }
        h1 { color: #0ea5e9; margin-bottom: 5px; }
        h2 { color: #374151; margin-top: 30px; border-bottom: 2px solid #e5e5e5; padding-bottom: 10px; }
        .subtitle { color: #6b7280; margin-bottom: 20px; }
        .filter-info { background: #f3f4f6; padding: 12px 16px; border-radius: 8px; margin-bottom: 25px; font-size: 14px; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
        .stat-card { background: #f9fafb; border: 1px solid #e5e5e5; border-radius: 8px; padding: 15px; text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; color: #111827; }
        .stat-label { font-size: 12px; color: #6b7280; margin-top: 5px; }
        .stat-card.warning .stat-value { color: #f59e0b; }
        .stat-card.danger .stat-value { color: #ef4444; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #e5e5e5; padding: 10px; text-align: left; font-size: 13px; }
        th { background-color: #f3f4f6; font-weight: 600; }
        .chart-section { margin-top: 25px; }
        .bar-chart { display: flex; align-items: flex-end; gap: 10px; height: 150px; margin-top: 15px; padding: 10px 0; }
        .bar-item { flex: 1; display: flex; flex-direction: column; align-items: center; }
        .bar { width: 100%; border-radius: 4px 4px 0 0; min-height: 5px; }
        .bar-label { font-size: 11px; color: #6b7280; margin-top: 8px; text-align: center; }
        .bar-value { font-size: 12px; font-weight: 600; margin-bottom: 5px; }
        .legend { display: flex; gap: 20px; margin-top: 15px; flex-wrap: wrap; }
        .legend-item { display: flex; align-items: center; gap: 8px; font-size: 13px; }
        .legend-color { width: 14px; height: 14px; border-radius: 3px; }
        .two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
        .rules-list { margin-top: 15px; }
        .rule-item { display: flex; justify-content: space-between; padding: 10px 12px; background: #f9fafb; border-radius: 6px; margin-bottom: 8px; }
        .rule-name { font-weight: 500; text-transform: capitalize; }
        .rule-count { background: #e5e7eb; padding: 2px 10px; border-radius: 12px; font-size: 12px; }
        .risk-txn { padding: 12px; border-left: 4px solid #ef4444; background: #fef2f2; margin-bottom: 10px; border-radius: 0 6px 6px 0; }
        .risk-txn-amount { font-weight: 600; font-size: 15px; }
        .risk-txn-details { font-size: 12px; color: #6b7280; margin-top: 4px; }
        .risk-txn-score { background: #ef4444; color: white; padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #9ca3af; text-align: center; }
        @media print { body { padding: 15px; } }
      </style>
    </head>
    <body>
      <h1>Risk Analysis Report</h1>
      <p class="subtitle">Generated on ${dayjs().format("MMMM DD, YYYY [at] HH:mm")}</p>
      
      <div class="filter-info">
        <strong>Filters Applied:</strong> ${filterDescription}
      </div>

      <h2>Summary Statistics</h2>
      <div class="stats-grid">
        <div class="stat-card warning">
          <div class="stat-value">${stats.flagged_transactions}</div>
          <div class="stat-label">Flagged Transactions</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-value">${stats.blocked_transactions}</div>
          <div class="stat-label">Blocked Transactions</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.avg_risk_score.toFixed(1)}</div>
          <div class="stat-label">Average Risk Score</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-value">${stats.high_risk_count}</div>
          <div class="stat-label">High Risk (70+)</div>
        </div>
      </div>

      <h2>Risk Score Distribution</h2>
      <div class="bar-chart">
        ${analytics.risk_score_ranges
          .map((range) => {
            const maxCount = Math.max(
              ...analytics.risk_score_ranges.map((r) => r.count),
              1,
            );
            const height = (range.count / maxCount) * 100;
            return `
              <div class="bar-item">
                <div class="bar-value">${range.count}</div>
                <div class="bar" style="height: ${Math.max(height, 5)}%; background-color: ${range.color};"></div>
                <div class="bar-label">${range.range}</div>
              </div>
            `;
          })
          .join("")}
      </div>

      <h2>Transaction Status Breakdown</h2>
      <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr);">
        <div class="stat-card" style="border-left: 4px solid #22c55e;">
          <div class="stat-value" style="color: #22c55e;">${stats.successful_transactions}</div>
          <div class="stat-label">Successful</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid #f59e0b;">
          <div class="stat-value" style="color: #f59e0b;">${stats.flagged_transactions}</div>
          <div class="stat-label">Flagged</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid #ef4444;">
          <div class="stat-value" style="color: #ef4444;">${stats.blocked_transactions}</div>
          <div class="stat-label">Blocked</div>
        </div>
      </div>

      <div class="two-column">
        <div>
          <h2>Top Triggered Rules</h2>
          ${
            analytics.rules_triggered.length === 0
              ? '<p style="color: #6b7280;">No rules triggered in selected period</p>'
              : `<div class="rules-list">
                  ${analytics.rules_triggered
                    .map(
                      (rule, i) => `
                    <div class="rule-item">
                      <span class="rule-name">#${i + 1} ${rule.name.toLowerCase()}</span>
                      <span class="rule-count">${rule.count} times</span>
                    </div>
                  `,
                    )
                    .join("")}
                </div>`
          }
        </div>

        <div>
          <h2>High Risk Transactions</h2>
          ${
            analytics.high_risk_transactions.length === 0
              ? '<p style="color: #6b7280;">No high-risk transactions in selected period</p>'
              : analytics.high_risk_transactions
                  .map(
                    (txn) => `
                  <div class="risk-txn">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span class="risk-txn-amount">${formatMoney(txn.amount)}</span>
                      <span class="risk-txn-score">Score: ${txn.risk_score}</span>
                    </div>
                    <div class="risk-txn-details">${txn.payment_method} • ${txn.id.slice(0, 8)}... • ${txn.status.toUpperCase()}</div>
                  </div>
                `,
                  )
                  .join("")
          }
        </div>
      </div>

      <div class="footer">
        This report was automatically generated by the Fraud Detection System.<br/>
        Total transactions analyzed: ${stats.total_transactions}
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.print();
}

function getFilterDescription(filters: AnalyticsFilters): string {
  const parts: string[] = [];

  if (filters.start_date && filters.end_date) {
    parts.push(`${filters.start_date} to ${filters.end_date}`);
  } else if (filters.period) {
    const periodMap: Record<string, string> = {
      "7d": "Last 7 days",
      "30d": "Last 30 days",
      "90d": "Last 90 days",
      all: "All time",
    };
    parts.push(periodMap[filters.period] || filters.period);
  }

  if (filters.status && filters.status !== "all") {
    parts.push(`Status: ${filters.status}`);
  }

  if (filters.payment_method && filters.payment_method !== "all") {
    parts.push(`Payment: ${filters.payment_method}`);
  }

  return parts.length > 0 ? parts.join(" | ") : "No filters applied";
}
