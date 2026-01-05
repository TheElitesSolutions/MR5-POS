"use client";
import { useDashboardStore } from "@/stores/dashboardStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, UtensilsCrossed, Target } from "lucide-react";
const TopMenuItems = () => {
    const { data, isLoading } = useDashboardStore();
    const formatCurrency = (value) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
        }).format(value);
    };
    const getCategoryColor = (category) => {
        const colors = {
            Steaks: "bg-red-100 text-red-800",
            Seafood: "bg-blue-100 text-blue-800",
            Appetizers: "bg-green-100 text-green-800",
            Desserts: "bg-purple-100 text-purple-800",
            Beverages: "bg-yellow-100 text-yellow-800",
            Salads: "bg-emerald-100 text-emerald-800",
        };
        return colors[category] || "bg-gray-100 text-gray-800";
    };
    const getProfitMarginColor = (margin) => {
        if (margin >= 70)
            return "text-green-600 bg-green-50";
        if (margin >= 60)
            return "text-emerald-600 bg-emerald-50";
        if (margin >= 50)
            return "text-yellow-600 bg-yellow-50";
        return "text-red-600 bg-red-50";
    };
    if (isLoading) {
        return (<Card>
        <CardHeader>
          <CardTitle>Top Menu Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (<div key={index} className="flex items-center space-x-3 animate-pulse">
                <div className="w-8 h-8 bg-gray-200 rounded"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-2 bg-gray-200 rounded w-full"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>))}
          </div>
        </CardContent>
      </Card>);
    }
    if (!data?.topMenuItems || data.topMenuItems.length === 0) {
        return (<Card>
        <CardHeader>
          <CardTitle>Top Menu Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <UtensilsCrossed className="w-12 h-12 text-gray-400 mx-auto mb-4"/>
            <p className="text-gray-500">No menu data available</p>
          </div>
        </CardContent>
      </Card>);
    }
    // Calculate max values for progress bars
    const maxSold = Math.max(...data.topMenuItems.map((item) => item.totalSold));
    const maxRevenue = Math.max(...data.topMenuItems.map((item) => item.revenue));
    return (<Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <UtensilsCrossed className="w-5 h-5"/>
            <span>Top Menu Items</span>
          </span>
          <TrendingUp className="w-5 h-5 text-green-600"/>
        </CardTitle>
        <p className="text-sm text-gray-600">
          Best performing dishes with profit analysis
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {data.topMenuItems.map((item, index) => (<div key={item.id} className="space-y-4 p-4 rounded-lg border hover:shadow-sm transition-shadow">
              {/* Header with ranking and basic info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                    #{index + 1}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">{item.name}</h4>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="outline" className={`text-xs ${getCategoryColor(item.category)}`}>
                        {item.category}
                      </Badge>
                      <Badge variant="outline" className={`text-xs ${getProfitMarginColor(item.profitMargin)}`}>
                        <Target className="w-3 h-3 mr-1"/>
                        {item.profitMargin.toFixed(2)}% profit
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900 dark:text-white text-lg">
                    {formatCurrency(item.revenue)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {item.totalSold} sold
                  </div>
                </div>
              </div>

              {/* Performance metrics */}
              <div className="grid grid-cols-2 gap-4">
                {/* Units sold progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Units sold</span>
                    <span className="font-medium">{item.totalSold}</span>
                  </div>
                  <Progress value={(item.totalSold / maxSold) * 100} className="h-2"/>
                </div>

                {/* Revenue progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Revenue share</span>
                    <span className="font-medium">
                      {formatCurrency(item.revenue)}
                    </span>
                  </div>
                  <Progress value={(item.revenue / maxRevenue) * 100} className="h-2"/>
                </div>
              </div>

              {/* Profit margin indicator */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-600">Profit Margin</span>
                <div className="flex items-center space-x-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div className={`h-2 rounded-full ${item.profitMargin >= 70
                ? "bg-green-500"
                : item.profitMargin >= 60
                    ? "bg-emerald-500"
                    : item.profitMargin >= 50
                        ? "bg-yellow-500"
                        : "bg-red-500"}`} style={{ width: `${Math.min(item.profitMargin, 100)}%` }}></div>
                  </div>
                  <span className={`text-xs font-medium ${getProfitMarginColor(item.profitMargin).split(" ")[0]}`}>
                    {item.profitMargin.toFixed(2)}%
                  </span>
                </div>
              </div>

              {index < data.topMenuItems.length - 1 && (<div className="border-b border-gray-100 -mx-4"></div>)}
            </div>))}
        </div>

        <div className="mt-6 pt-4 border-t">
          <button className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors">
            View full menu analytics →
          </button>
        </div>
      </CardContent>
    </Card>);
};
export default TopMenuItems;
