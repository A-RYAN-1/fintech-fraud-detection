import { formatMoney } from "@/utils/money";
import type { Transaction } from "@/types";
import type {
  DashboardStats,
  ChartDataPoint,
  RiskDistribution,
  HeatmapCell,
} from "../types";
import dayjs from "dayjs";

// Parse amount (backend may return string)
function parseAmount(amount: number | string): number {
  return typeof amount === "string" ? parseFloat(amount) : amount;
}

// Normalize status to uppercase
function normalizeStatus(status: string): string {
  return status.toUpperCase();
}

export function calculateDashboardStats(
  transactions: Transaction[],
): DashboardStats {
  const total = transactions.length;
  const successful = transactions.filter(
    (t) => normalizeStatus(t.status) === "SUCCESS",
  ).length;
  const flagged = transactions.filter(
    (t) => normalizeStatus(t.status) === "FLAGGED",
  ).length;
  const blocked = transactions.filter(
    (t) => normalizeStatus(t.status) === "BLOCKED",
  ).length;
  const totalVolume = transactions.reduce(
    (sum, t) => sum + parseAmount(t.amount),
    0,
  );
  const averageSpending = total > 0 ? totalVolume / total : 0;

  return {
    totalTransactions: total,
    successfulTransactions: successful,
    flaggedTransactions: flagged,
    blockedTransactions: blocked,
    totalVolume,
    averageSpending,
    successRate: total > 0 ? (successful / total) * 100 : 0,
    riskRate: total > 0 ? ((flagged + blocked) / total) * 100 : 0,
  };
}

export function generateChartData(
  transactions: Transaction[],
  days: number = 7,
): ChartDataPoint[] {
  const data: ChartDataPoint[] = [];
  const today = dayjs();

  for (let i = days - 1; i >= 0; i--) {
    const date = today.subtract(i, "day");
    const dateStr = date.format("YYYY-MM-DD");
    const dayTransactions = transactions.filter(
      (t) => dayjs(t.created_at).format("YYYY-MM-DD") === dateStr,
    );

    data.push({
      date: date.format("MMM DD"),
      success: dayTransactions.filter(
        (t) => normalizeStatus(t.status) === "SUCCESS",
      ).length,
      flagged: dayTransactions.filter(
        (t) => normalizeStatus(t.status) === "FLAGGED",
      ).length,
      blocked: dayTransactions.filter(
        (t) => normalizeStatus(t.status) === "BLOCKED",
      ).length,
      total: dayTransactions.length,
    });
  }

  return data;
}

export function generateRiskDistribution(
  transactions: Transaction[],
): RiskDistribution[] {
  const lowRisk = transactions.filter((t) => (t.risk_score ?? 0) < 30).length;
  const mediumRisk = transactions.filter(
    (t) => (t.risk_score ?? 0) >= 30 && (t.risk_score ?? 0) < 70,
  ).length;
  const highRisk = transactions.filter((t) => (t.risk_score ?? 0) >= 70).length;

  return [
    { name: "Low Risk", value: lowRisk, color: "#22c55e" },
    { name: "Medium Risk", value: mediumRisk, color: "#f59e0b" },
    { name: "High Risk", value: highRisk, color: "#ef4444" },
  ];
}

export function generateHeatmapData(
  transactions: Transaction[],
): HeatmapCell[] {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const data: HeatmapCell[] = [];

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const relevantTxns = transactions.filter((t) => {
        const txnDate = dayjs(t.created_at);
        return txnDate.day() === day && txnDate.hour() === hour;
      });

      const avgRisk =
        relevantTxns.length > 0
          ? relevantTxns.reduce((sum, t) => sum + (t.risk_score ?? 0), 0) /
            relevantTxns.length
          : 0;

      let riskLevel: "low" | "medium" | "high" = "low";
      if (avgRisk >= 50) riskLevel = "high";
      else if (avgRisk >= 25) riskLevel = "medium";

      data.push({
        day: days[day],
        hour,
        value: relevantTxns.length,
        riskLevel,
      });
    }
  }

  return data;
}

export function formatCurrency(amount: number | string): string {
  return formatMoney(amount, { whole: true });
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

export function calculatePercentageChange(
  current: number,
  previous: number,
): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}
