"use client";

import { useDashboardStore } from "@/stores/dashboardStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  Users,
  UtensilsCrossed,
  Clock,
  DollarSign,
} from "lucide-react";

const RecentActivity = () => {
  // Parse SQLite datetime as local time (not UTC)
  const parseLocalDateTime = (dateString: string): Date => {
    // SQLite format: "YYYY-MM-DD HH:MM:SS"
    // We need to parse this as local time, not UTC
    const [datePart, timePart] = dateString.replace('T', ' ').split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes, seconds] = (timePart || '00:00:00').split(':').map(Number);

    // Create date in local timezone (month is 0-indexed)
    return new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0);
  };

  const { data, isLoading } = useDashboardStore();

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "order_completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "order_cancelled":
        return <XCircle className="w-4 h-4 text-red-600" />;
      case "table_occupied":
        return <Users className="w-4 h-4 text-blue-600" />;
      case "menu_updated":
        return <UtensilsCrossed className="w-4 h-4 text-orange-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActivityBadgeColor = (type: string) => {
    switch (type) {
      case "order_completed":
        return "bg-green-100 text-green-800";
      case "order_cancelled":
        return "bg-red-100 text-red-800";
      case "table_occupied":
        return "bg-blue-100 text-blue-800";
      case "menu_updated":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatActivityType = (type: string) => {
    switch (type) {
      case "order_completed":
        return "Order Completed";
      case "order_cancelled":
        return "Order Cancelled";
      case "table_occupied":
        return "Table Occupied";
      case "menu_updated":
        return "Menu Updated";
      default:
        return "Activity";
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center space-x-3 animate-pulse"
              >
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
    );
  }

  if (!data?.recentActivity || data.recentActivity.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No recent activity</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Recent Activity
          <Badge variant="outline" className="text-xs">
            Live
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.recentActivity.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex-shrink-0 mt-0.5">
                {getActivityIcon(activity.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <Badge
                    variant="outline"
                    className={`text-xs ${getActivityBadgeColor(
                      activity.type
                    )}`}
                  >
                    {formatActivityType(activity.type)}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(activity.timestamp)}
                  </span>
                </div>

                <p className="text-sm text-gray-900 mb-1">
                  {activity.description}
                </p>

                {/* Additional metadata display */}
                {activity.metadata && (
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    {activity.metadata.amount && (
                      <div className="flex items-center space-x-1">
                        <DollarSign className="w-3 h-3" />
                        <span>${activity.metadata.amount}</span>
                      </div>
                    )}
                    {activity.metadata.tableNumber && (
                      <div className="flex items-center space-x-1">
                        <Users className="w-3 h-3" />
                        <span>Table {activity.metadata.tableNumber}</span>
                      </div>
                    )}
                    {activity.metadata.orderId && (
                      <span>#{activity.metadata.orderId}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t">
          <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            View all activity →
          </button>
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentActivity;
