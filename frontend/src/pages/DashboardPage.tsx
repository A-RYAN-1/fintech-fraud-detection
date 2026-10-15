import { useState, useMemo } from "react";
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  Shield,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/features/auth/hooks";
import { useDashboardStats } from "@/features/transactions";
import { PageTransition } from "@/components/common";
import {
  StatsCard,
  TransactionVolumeChart,
  RiskDistributionChart,
  RiskHeatmap,
  PeriodSelector,
  RecentTransactions,
  useAnalytics,
  formatCurrency,
  formatNumber,
  type ComparisonPeriod,
} from "@/features/dashboard";

export default function DashboardPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<ComparisonPeriod>("7d");

  // Analytics data (aggregated server-side)
  const { data: analytics, isLoading: analyticsLoading } = useAnalytics({
    period,
  });

  // Recent transactions (only for the table, limit 10 is fine)
  const { data: txData, isLoading: txLoading } = useDashboardStats();
  const recentTransactions = txData?.transactions || [];

  const stats = useMemo(() => {
    if (!analytics) {
      return {
        totalTransactions: 0,
        successfulTransactions: 0,
        flaggedTransactions: 0,
        blockedTransactions: 0,
        totalVolume: 0,
        averageSpending: 0,
        successRate: 0,
        riskRate: 0,
      };
    }
    const s = analytics.stats;
    return {
      totalTransactions: s.total_transactions,
      successfulTransactions: s.successful_transactions,
      flaggedTransactions: s.flagged_transactions,
      blockedTransactions: s.blocked_transactions,
      totalVolume: s.total_volume,
      averageSpending: s.average_spending,
      successRate: s.success_rate,
      riskRate: s.risk_rate,
    };
  }, [analytics]);

  const chartData = analytics?.chart_data || [];
  const riskDistribution = analytics?.risk_distribution || [];
  const heatmapData = useMemo(() => {
    if (!analytics?.heatmap_data) return [];
    // Map risk_level from backend to riskLevel expected by component
    return analytics.heatmap_data.map((cell) => ({
      day: cell.day,
      hour: cell.hour,
      value: cell.value,
      riskLevel: cell.risk_level,
    }));
  }, [analytics]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              Welcome back, {user?.first_name}
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              Here's what's happening with your transactions today.
            </p>
          </div>
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>

        {/* Stats Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"
        >
          <motion.div variants={itemVariants}>
            <StatsCard
              title="Total Transactions"
              value={formatNumber(stats.totalTransactions)}
              icon={Activity}
              isLoading={analyticsLoading}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <StatsCard
              title="Successful"
              value={formatNumber(stats.successfulTransactions)}
              icon={CheckCircle}
              iconColor="text-success-600 dark:text-success-400"
              isLoading={analyticsLoading}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <StatsCard
              title="Flagged"
              value={formatNumber(stats.flaggedTransactions)}
              icon={AlertTriangle}
              iconColor="text-warning-600 dark:text-warning-400"
              isLoading={analyticsLoading}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <StatsCard
              title="Blocked"
              value={formatNumber(stats.blockedTransactions)}
              icon={Shield}
              iconColor="text-danger-600 dark:text-danger-400"
              isLoading={analyticsLoading}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <StatsCard
              title="Total Volume"
              value={formatCurrency(stats.totalVolume)}
              icon={DollarSign}
              isLoading={analyticsLoading}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <StatsCard
              title="Success Rate"
              value={`${stats.successRate.toFixed(1)}%`}
              icon={TrendingUp}
              isLoading={analyticsLoading}
            />
          </motion.div>
        </motion.div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <TransactionVolumeChart
              data={chartData}
              isLoading={analyticsLoading}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
          >
            <RiskDistributionChart
              data={riskDistribution}
              isLoading={analyticsLoading}
            />
          </motion.div>
        </div>

        {/* Heatmap & Recent Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <RiskHeatmap data={heatmapData} isLoading={analyticsLoading} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <RecentTransactions
              transactions={recentTransactions}
              isLoading={txLoading}
            />
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}
