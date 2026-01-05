"use client";
import { useDashboardStore } from "@/stores/dashboardStore";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, } from "recharts";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TrendingUp, BarChart3 } from "lucide-react";
const SalesChart = () => {
    const { data, isLoading, dateRange } = useDashboardStore();
    const [chartType, setChartType] = useState("line");
    const formatCurrency = (value) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
        }).format(value);
    };
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        });
    };
    const getDateRangeDescription = () => {
        switch (dateRange.preset) {
            case "today":
                return "Today's revenue and order trends";
            case "week":
                return "Last 7 days revenue and order trends";
            case "month":
                return "This month's revenue and order trends";
            case "quarter":
                return "This quarter's revenue and order trends";
            default:
                return "Revenue and order trends for selected period";
        }
    };
    if (isLoading) {
        return (<div className="h-80 flex items-center justify-center">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (<div key={i} className="h-8 bg-gray-200 rounded"></div>))}
          </div>
        </div>
      </div>);
    }
    if (!data?.salesData || data.salesData.length === 0) {
        return (<div className="h-80 flex items-center justify-center">
        <div className="text-center">
          <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4"/>
          <p className="text-gray-500">No sales data available</p>
        </div>
      </div>);
    }
    const chartData = data.salesData.map((item) => ({
        ...item,
        date: formatDate(item.date),
        revenue: Math.round(item.revenue),
    }));
    return (<div className="space-y-4">
      {/* Chart Type Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Sales Performance</h3>
          <p className="text-sm text-gray-600">{getDateRangeDescription()}</p>
        </div>
        <div className="flex space-x-2">
          <Button variant={chartType === "line" ? "default" : "outline"} size="sm" onClick={() => setChartType("line")}>
            <TrendingUp className="w-4 h-4 mr-2"/>
            Line
          </Button>
          <Button variant={chartType === "bar" ? "default" : "outline"} size="sm" onClick={() => setChartType("bar")}>
            <BarChart3 className="w-4 h-4 mr-2"/>
            Bar
          </Button>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "line" ? (<LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3"/>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false}/>
              <YAxis yAxisId="revenue" orientation="left" tick={{ fontSize: 12 }} tickLine={false}/>
              <YAxis yAxisId="orders" orientation="right" tick={{ fontSize: 12 }} tickLine={false}/>
              <Tooltip formatter={(value, name) => [
                name === "revenue" ? formatCurrency(value) : value,
                name === "revenue" ? "Revenue" : "Orders",
            ]} labelStyle={{ color: "#374151" }} contentStyle={{
                backgroundColor: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
            }}/>
              <Legend />
              <Line yAxisId="revenue" type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} name="Revenue"/>
              <Line yAxisId="orders" type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={3} dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} name="Orders"/>
            </LineChart>) : (<BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3"/>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false}/>
              <YAxis yAxisId="revenue" orientation="left" tick={{ fontSize: 12 }} tickLine={false}/>
              <YAxis yAxisId="orders" orientation="right" tick={{ fontSize: 12 }} tickLine={false}/>
              <Tooltip formatter={(value, name) => [
                name === "revenue" ? formatCurrency(value) : value,
                name === "revenue" ? "Revenue" : "Orders",
            ]} labelStyle={{ color: "#374151" }} contentStyle={{
                backgroundColor: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
            }}/>
              <Legend />
              <Bar yAxisId="revenue" dataKey="revenue" fill="#3b82f6" name="Revenue" radius={[4, 4, 0, 0]}/>
              <Bar yAxisId="orders" dataKey="orders" fill="#10b981" name="Orders" radius={[4, 4, 0, 0]}/>
            </BarChart>)}
        </ResponsiveContainer>
      </div>
    </div>);
};
export default SalesChart;
