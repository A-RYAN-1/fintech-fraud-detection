import { useState, useEffect } from "react";
import {
  Search,
  X,
  Filter,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DatePicker,
  Label,
} from "@/components/ui";
import { useDebounce } from "@/hooks";
import { cn } from "@/utils";
import type { TransactionFilters as Filters } from "../api";

interface TransactionFiltersProps {
  filters: Filters;
  onFilterChange: (filters: Filters) => void;
  isLoading?: boolean;
}

export default function TransactionFilters({
  filters,
  onFilterChange,
  isLoading = false,
}: TransactionFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Local state for debounced inputs
  const [searchInput, setSearchInput] = useState(filters.search || "");
  const [minAmountInput, setMinAmountInput] = useState(
    filters.min_amount?.toString() || "",
  );
  const [maxAmountInput, setMaxAmountInput] = useState(
    filters.max_amount?.toString() || "",
  );
  const [minRiskInput, setMinRiskInput] = useState(
    filters.min_risk_score?.toString() || "",
  );
  const [maxRiskInput, setMaxRiskInput] = useState(
    filters.max_risk_score?.toString() || "",
  );

  // Debounced values
  const debouncedSearch = useDebounce(searchInput, 400);
  const debouncedMinAmount = useDebounce(minAmountInput, 400);
  const debouncedMaxAmount = useDebounce(maxAmountInput, 400);
  const debouncedMinRisk = useDebounce(minRiskInput, 400);
  const debouncedMaxRisk = useDebounce(maxRiskInput, 400);

  // Update filters when debounced values change
  useEffect(() => {
    const newFilters: Filters = {
      ...filters,
      search: debouncedSearch || undefined,
      page: 1,
    };

    if (debouncedSearch !== (filters.search || "")) {
      onFilterChange(newFilters);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    const minAmount = debouncedMinAmount
      ? parseFloat(debouncedMinAmount)
      : undefined;
    const maxAmount = debouncedMaxAmount
      ? parseFloat(debouncedMaxAmount)
      : undefined;

    if (minAmount !== filters.min_amount || maxAmount !== filters.max_amount) {
      onFilterChange({
        ...filters,
        min_amount: minAmount,
        max_amount: maxAmount,
        page: 1,
      });
    }
  }, [debouncedMinAmount, debouncedMaxAmount]);

  useEffect(() => {
    const minRisk = debouncedMinRisk ? parseInt(debouncedMinRisk) : undefined;
    const maxRisk = debouncedMaxRisk ? parseInt(debouncedMaxRisk) : undefined;

    if (
      minRisk !== filters.min_risk_score ||
      maxRisk !== filters.max_risk_score
    ) {
      onFilterChange({
        ...filters,
        min_risk_score: minRisk,
        max_risk_score: maxRisk,
        page: 1,
      });
    }
  }, [debouncedMinRisk, debouncedMaxRisk]);

  const handleStatusChange = (value: string) => {
    onFilterChange({
      ...filters,
      status: value === "all" ? undefined : value,
      page: 1,
    });
  };

  const handlePaymentMethodChange = (value: string) => {
    onFilterChange({
      ...filters,
      payment_method: value === "all" ? undefined : value,
      page: 1,
    });
  };

  const handleStartDateChange = (date: string | undefined) => {
    onFilterChange({
      ...filters,
      start_date: date,
      page: 1,
    });
  };

  const handleEndDateChange = (date: string | undefined) => {
    onFilterChange({
      ...filters,
      end_date: date,
      page: 1,
    });
  };

  const clearFilters = () => {
    setSearchInput("");
    setMinAmountInput("");
    setMaxAmountInput("");
    setMinRiskInput("");
    setMaxRiskInput("");
    onFilterChange({ page: 1, per_page: filters.per_page });
  };

  const hasActiveFilters =
    filters.search ||
    filters.status ||
    filters.payment_method ||
    filters.start_date ||
    filters.end_date ||
    filters.min_amount !== undefined ||
    filters.max_amount !== undefined ||
    filters.min_risk_score !== undefined ||
    filters.max_risk_score !== undefined;

  const activeFilterCount = [
    filters.search,
    filters.status,
    filters.payment_method,
    filters.start_date,
    filters.end_date,
    filters.min_amount,
    filters.max_amount,
    filters.min_risk_score,
    filters.max_risk_score,
  ].filter(Boolean).length;

  // Check if search is in progress (local differs from debounced)
  const isSearching = searchInput !== debouncedSearch;

  return (
    <div className="space-y-4">
      {/* Primary Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            placeholder="Search ID, amount, method..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 pr-9"
          />
          {(isSearching || isLoading) && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 animate-spin" />
          )}
        </div>

        {/* Status Filter */}
        <Select
          value={filters.status || "all"}
          onValueChange={handleStatusChange}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="SUCCESS">Success</SelectItem>
            <SelectItem value="FLAGGED">Flagged</SelectItem>
            <SelectItem value="BLOCKED">Blocked</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
          </SelectContent>
        </Select>

        {/* Payment Method Filter */}
        <Select
          value={filters.payment_method || "all"}
          onValueChange={handlePaymentMethodChange}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Payment Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="card">Card</SelectItem>
            <SelectItem value="upi">UPI</SelectItem>
            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
            <SelectItem value="wallet">Wallet</SelectItem>
          </SelectContent>
        </Select>

        {/* Advanced Filters Toggle */}
        <Button
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(activeFilterCount > 0 && "border-primary-500")}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-2 h-5 w-5 rounded-full bg-primary-500 text-white text-xs flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
          {showAdvanced ? (
            <ChevronUp className="h-4 w-4 ml-2" />
          ) : (
            <ChevronDown className="h-4 w-4 ml-2" />
          )}
        </Button>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="icon"
            onClick={clearFilters}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Clear filters</span>
          </Button>
        )}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
          {/* Date Range */}
          <div className="space-y-2">
            <Label className="text-xs text-neutral-500">Start Date</Label>
            <DatePicker
              value={filters.start_date}
              onChange={handleStartDateChange}
              placeholder="From date"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-neutral-500">End Date</Label>
            <DatePicker
              value={filters.end_date}
              onChange={handleEndDateChange}
              placeholder="To date"
            />
          </div>

          {/* Amount Range */}
          <div className="space-y-2">
            <Label className="text-xs text-neutral-500">Min Amount (USD)</Label>
            <Input
              type="number"
              placeholder="0"
              value={minAmountInput}
              onChange={(e) => setMinAmountInput(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-neutral-500">Max Amount (USD)</Label>
            <Input
              type="number"
              placeholder="Any"
              value={maxAmountInput}
              onChange={(e) => setMaxAmountInput(e.target.value)}
            />
          </div>

          {/* Risk Score Range */}
          <div className="space-y-2">
            <Label className="text-xs text-neutral-500">Min Risk Score</Label>
            <Input
              type="number"
              min={0}
              max={100}
              placeholder="0"
              value={minRiskInput}
              onChange={(e) => setMinRiskInput(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-neutral-500">Max Risk Score</Label>
            <Input
              type="number"
              min={0}
              max={100}
              placeholder="100"
              value={maxRiskInput}
              onChange={(e) => setMaxRiskInput(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
