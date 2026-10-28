import { formatMoney } from "@/utils/money";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  AlertTriangle,
  Activity,
  XCircle,
  Calendar,
  FileDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  DatePicker,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { PageTransition } from "@/components/common";
import {
  StatsCard,
  RiskHeatmap,
  useAnalytics,
  generateRiskAnalysisPDF,
  formatNumber,
  type AnalyticsFilters,
} from "@/features/dashboard";

type DatePreset = "7d" | "30d" | "90d" | "all" | "custom";

export default function RiskAnalysisPage() {
  // Filter state
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");

  // Build analytics filters
  const filters: AnalyticsFilters = useMemo(() => {
    const f: AnalyticsFilters = {};

    if (datePreset === "custom" && startDate && endDate) {
      f.start_date = startDate;
      f.end_date = endDate;
    } else if (datePreset !== "custom") {
      f.period = datePreset === "all" ? "all" : datePreset;
    }

    if (statusFilter !== "all") {
      f.status = statusFilter;
    }

    if (paymentMethodFilter !== "all") {
      f.payment_method = paymentMethodFilter;
    }

    return f;
  }, [datePreset, startDate, endDate, statusFilter, paymentMethodFilter]);

  const { data: analytics, isLoading } = useAnalytics(filters);

  // Transform heatmap data
  const heatmapData = useMemo(() => {
    if (!analytics?.heatmap_data) return [];
    return analytics.heatmap_data.map((cell) => ({
      day: cell.day,
      hour: cell.hour,
      value: cell.value,
      riskLevel: cell.risk_level,
    }));
  }, [analytics]);

  // Status breakdown for pie chart
  const statusBreakdown = useMemo(() => {
    if (!analytics) return [];
    return [
      {
        name: "Success",
        value: analytics.stats.successful_transactions,
        color: "#22c55e",
      },
      {
        name: "Flagged",
        value: analytics.stats.flagged_transactions,
        color: "#f59e0b",
      },
      {
        name: "Blocked",
        value: analytics.stats.blocked_transactions,
        color: "#ef4444",
      },
    ];
  }, [analytics]);

  const handlePresetChange = (value: DatePreset) => {
    setDatePreset(value);
    if (value !== "custom") {
      setStartDate(undefined);
      setEndDate(undefined);
    }
  };

  const handleExportPDF = () => {
    if (analytics) {
      generateRiskAnalysisPDF(analytics, filters);
    }
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              Risk Analysis
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              Advanced fraud detection analytics and insights
            </p>
          </div>
          <Button
            onClick={handleExportPDF}
            disabled={isLoading || !analytics}
            variant="outline"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Date Preset */}
                <div className="space-y-2">
                  <Label className="text-xs text-neutral-500">
                    Time Period
                  </Label>
                  <Select
                    value={datePreset}
                    onValueChange={(v) => handlePresetChange(v as DatePreset)}
                  >
                    <SelectTrigger className="w-full sm:w-40">
                      <Calendar className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d">Last 7 days</SelectItem>
                      <SelectItem value="30d">Last 30 days</SelectItem>
                      <SelectItem value="90d">Last 90 days</SelectItem>
                      <SelectItem value="all">All time</SelectItem>
                      <SelectItem value="custom">Custom range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Date Range */}
                {datePreset === "custom" && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs text-neutral-500">
                        Start Date
                      </Label>
                      <DatePicker
                        value={startDate}
                        onChange={setStartDate}
                        placeholder="From"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-neutral-500">
                        End Date
                      </Label>
                      <DatePicker
                        value={endDate}
                        onChange={setEndDate}
                        placeholder="To"
                      />
                    </div>
                  </>
                )}

                {/* Status Filter */}
                <div className="space-y-2">
                  <Label className="text-xs text-neutral-500">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="SUCCESS">Success</SelectItem>
                      <SelectItem value="FLAGGED">Flagged</SelectItem>
                      <SelectItem value="BLOCKED">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment Method Filter */}
                <div className="space-y-2">
                  <Label className="text-xs text-neutral-500">
                    Payment Method
                  </Label>
                  <Select
                    value={paymentMethodFilter}
                    onValueChange={setPaymentMethodFilter}
                  >
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="bank_transfer">
                        Bank Transfer
                      </SelectItem>
                      <SelectItem value="wallet">Wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Results count */}
                <div className="flex items-end">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {isLoading
                      ? "Loading..."
                      : `${analytics?.stats.total_transactions || 0} transactions`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <StatsCard
            title="Flagged Transactions"
            value={formatNumber(analytics?.stats.flagged_transactions || 0)}
            icon={AlertTriangle}
            iconColor="text-warning-600 dark:text-warning-400"
            isLoading={isLoading}
          />
          <StatsCard
            title="Blocked Transactions"
            value={formatNumber(analytics?.stats.blocked_transactions || 0)}
            icon={XCircle}
            iconColor="text-danger-600 dark:text-danger-400"
            isLoading={isLoading}
          />
          <StatsCard
            title="Avg Risk Score"
            value={(analytics?.stats.avg_risk_score || 0).toFixed(1)}
            icon={Activity}
            isLoading={isLoading}
          />
          <StatsCard
            title="High Risk (70+)"
            value={formatNumber(analytics?.stats.high_risk_count || 0)}
            icon={Shield}
            iconColor="text-danger-600 dark:text-danger-400"
            isLoading={isLoading}
          />
        </motion.div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Risk Score Distribution */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Risk Score Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics?.risk_score_ranges || []}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-neutral-200 dark:stroke-neutral-800"
                      />
                      <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--tooltip-bg, #fff)",
                          border: "1px solid var(--tooltip-border, #e5e5e5)",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="count" name="Transactions">
                        {(analytics?.risk_score_ranges || []).map(
                          (entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ),
                        )}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Transaction Status Breakdown */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Transaction Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {statusBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Rules & High Risk Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Triggered Rules */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Top Triggered Rules</CardTitle>
              </CardHeader>
              <CardContent>
                {!analytics?.rules_triggered?.length ? (
                  <p className="text-center text-neutral-500 dark:text-neutral-400 py-8">
                    No rules triggered in selected period
                  </p>
                ) : (
                  <div className="space-y-3">
                    {analytics.rules_triggered.map((rule, index) => (
                      <div
                        key={rule.name}
                        className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400 w-6">
                            #{index + 1}
                          </span>
                          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 capitalize">
                            {rule.name.toLowerCase()}
                          </span>
                        </div>
                        <Badge variant="default">{rule.count} times</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* High Risk Transactions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>High Risk Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                {!analytics?.high_risk_transactions?.length ? (
                  <p className="text-center text-neutral-500 dark:text-neutral-400 py-8">
                    No high-risk transactions in selected period
                  </p>
                ) : (
                  <div className="space-y-3">
                    {analytics.high_risk_transactions.map((txn) => (
                      <div
                        key={txn.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-danger-200 dark:border-danger-900 bg-danger-50 dark:bg-danger-950/30"
                      >
                        <div>
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            {formatMoney(txn.amount)}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            {txn.payment_method} • {txn.id.slice(0, 8)}...
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant="danger">
                            Score: {txn.risk_score}
                          </Badge>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 uppercase">
                            {txn.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Heatmap */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <RiskHeatmap data={heatmapData} isLoading={isLoading} />
        </motion.div>
      </div>
    </PageTransition>
  );
}
