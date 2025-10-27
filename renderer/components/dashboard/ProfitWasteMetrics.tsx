"use client";

import { useDashboardStore } from "@/stores/dashboardStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Trash2,
  AlertTriangle,
  PieChart,
} from "lucide-react";

const ProfitWasteMetrics = () => {
  const { data, isLoading } = useDashboardStore();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Net Profit Card Loading */}
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Waste Metrics Card Loading */}
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data?.netProfitData || !data?.wasteMetrics) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-8">
              <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No profit data available</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-8">
              <Trash2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No waste data available</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { netProfitData, wasteMetrics } = data;
  const totalWasteValue = wasteMetrics.reduce(
    (sum, waste) => sum + waste.value,
    0
  );
  const profitMarginColor =
    netProfitData.profitMargin >= 30
      ? "text-green-600"
      : netProfitData.profitMargin >= 20
      ? "text-yellow-600"
      : "text-red-600";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Net Profit Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <PieChart className="w-5 h-5" />
              <span>Net Profit Breakdown</span>
            </span>
            <Badge
              variant="outline"
              className={`${profitMarginColor} border-current`}
            >
              {netProfitData.profitMargin.toFixed(1)}% margin
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Net Profit Summary */}
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {formatCurrency(netProfitData.netProfit)}
              </div>
              <p className="text-sm text-gray-600">
                Net Profit from {formatCurrency(netProfitData.totalRevenue)}{" "}
                revenue
              </p>
            </div>

            {/* Cost Breakdown */}
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Food Costs</span>
                  <span className="font-medium">
                    {formatCurrency(netProfitData.breakdown.foodCosts)}
                  </span>
                </div>
                <Progress
                  value={
                    (netProfitData.breakdown.foodCosts /
                      netProfitData.totalRevenue) *
                    100
                  }
                  className="h-2"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Labor Costs</span>
                  <span className="font-medium">
                    {formatCurrency(netProfitData.breakdown.laborCosts)}
                  </span>
                </div>
                <Progress
                  value={
                    (netProfitData.breakdown.laborCosts /
                      netProfitData.totalRevenue) *
                    100
                  }
                  className="h-2"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Overhead Costs</span>
                  <span className="font-medium">
                    {formatCurrency(netProfitData.breakdown.overheadCosts)}
                  </span>
                </div>
                <Progress
                  value={
                    (netProfitData.breakdown.overheadCosts /
                      netProfitData.totalRevenue) *
                    100
                  }
                  className="h-2"
                />
              </div>
            </div>

            {/* Profit Indicator */}
            <div className="flex items-center justify-center space-x-2 pt-4 border-t">
              {netProfitData.netProfit > 0 ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <span
                className={`text-sm font-medium ${
                  netProfitData.netProfit > 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {netProfitData.netProfit > 0 ? "Profitable" : "Loss"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Waste Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <Trash2 className="w-5 h-5" />
              <span>Total Waste</span>
            </span>
            <Badge variant="outline" className="text-red-600 border-red-600">
              {formatCurrency(totalWasteValue)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {wasteMetrics.length === 0 ? (
              <div className="text-center py-8">
                <Trash2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No waste recorded</p>
              </div>
            ) : (
              <>
                {wasteMetrics.map((waste) => (
                  <div
                    key={waste.id}
                    className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {waste.itemName}
                        </h4>
                        <span className="text-sm font-medium text-red-600">
                          {formatCurrency(waste.value)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>
                          {waste.quantity} {waste.unit} • {waste.reason}
                        </span>
                        <span>{formatTimestamp(waste.date)}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Waste Impact */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      Waste Impact on Profit
                    </span>
                    <span className="font-medium text-red-600">
                      -
                      {(
                        (totalWasteValue / netProfitData.totalRevenue) *
                        100
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                  <Progress
                    value={(totalWasteValue / netProfitData.totalRevenue) * 100}
                    className="h-2 mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Waste represents{" "}
                    {(
                      (totalWasteValue / netProfitData.totalRevenue) *
                      100
                    ).toFixed(1)}
                    % of total revenue
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfitWasteMetrics;