"use client";

import { useState } from "react";
import { Expense, ExpenseStatus } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DollarSign,
  Calendar,
  User,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  Receipt,
  Edit,
  Trash2,
  CreditCard,
  Repeat,
} from "lucide-react";

interface ExpenseCardProps {
  expense: Expense;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onMarkPaid: (id: string) => void;
  canApprove?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

const ExpenseCard = ({
  expense,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  onMarkPaid,
  canApprove = false,
  canEdit = true,
  canDelete = true,
}: ExpenseCardProps) => {
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

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    const parsedDate = typeof date === 'string' ? parseLocalDateTime(date) : date;
    return parsedDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusEnum = status as ExpenseStatus;
    const variants = {
      [ExpenseStatus.PENDING]:
        "bg-yellow-100 text-yellow-800 border-yellow-200",
      [ExpenseStatus.APPROVED]: "bg-green-100 text-green-800 border-green-200",
      [ExpenseStatus.REJECTED]: "bg-red-100 text-red-800 border-red-200",
      [ExpenseStatus.PAID]: "bg-blue-100 text-blue-800 border-blue-200",
    };

    const icons = {
      [ExpenseStatus.PENDING]: <Clock className="w-3 h-3" />,
      [ExpenseStatus.APPROVED]: <CheckCircle className="w-3 h-3" />,
      [ExpenseStatus.REJECTED]: <XCircle className="w-3 h-3" />,
      [ExpenseStatus.PAID]: <CreditCard className="w-3 h-3" />,
    };

    return (
      <Badge className={`${variants[statusEnum]} flex items-center space-x-1`}>
        {icons[statusEnum]}
        <span>{status}</span>
      </Badge>
    );
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      UTILITIES: "bg-blue-500",
      RENT: "bg-purple-500",
      SUPPLIES: "bg-green-500",
      MAINTENANCE: "bg-orange-500",
      MARKETING: "bg-pink-500",
      INSURANCE: "bg-indigo-500",
      LICENSES: "bg-yellow-500",
      EQUIPMENT: "bg-red-500",
      FOOD_SUPPLIES: "bg-emerald-500",
      PROFESSIONAL: "bg-teal-500",
      TRANSPORTATION: "bg-cyan-500",
      OTHER: "bg-gray-500",
    };
    return colors[category as keyof typeof colors] || colors.OTHER;
  };

  const handleDelete = () => {
    onDelete(expense.id);
    setShowDeleteDialog(false);
  };

  const canPerformActions = expense.status === ExpenseStatus.PENDING;
  const canMarkPaid = expense.status === ExpenseStatus.APPROVED;

  return (
    <>
      <Card className="hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-4 sm:space-y-0">
            {/* Main Content */}
            <div className="flex-1 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                    {expense.description}
                  </h3>
                  {expense.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {expense.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end space-y-2">
                  {getStatusBadge(expense.status)}
                  {expense.isRecurring && (
                    <Badge
                      variant="outline"
                      className="flex items-center space-x-1"
                    >
                      <Repeat className="w-3 h-3" />
                      <span>{expense.recurringType}</span>
                    </Badge>
                  )}
                </div>
              </div>

              {/* Amount and Category */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    ${expense.amount.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-3 h-3 rounded-full ${getCategoryColor(
                      expense.category
                    )}`}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {expense.category.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                {expense.vendor && (
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400">
                      {expense.vendor}
                    </span>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">
                    {formatDate(expense.createdAt)}
                  </span>
                </div>
                {expense.receiptUrl && (
                  <div className="flex items-center space-x-2">
                    <Receipt className="w-4 h-4 text-gray-400" />
                    <a
                      href={expense.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                    >
                      View Receipt
                    </a>
                  </div>
                )}
              </div>

              {/* Payment Method and Creator */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">
                    {expense.paymentMethod.replace(/_/g, " ")}
                  </span>
                </div>
                {expense.createdBy && (
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-400">
                      Created by {expense.createdBy}
                    </span>
                  </div>
                )}
              </div>

              {/* Approval Info */}
              {expense.status === ExpenseStatus.APPROVED &&
                expense.approvedBy && (
                  <div className="text-sm text-green-600 dark:text-green-400">
                    Approved by {expense.approvedBy}
                    {expense.approvedAt &&
                      ` on ${formatDate(expense.approvedAt)}`}
                  </div>
                )}

              {expense.status === ExpenseStatus.REJECTED && (
                <div className="text-sm text-red-600 dark:text-red-400">
                  Status: Rejected
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              {/* Quick Actions */}
              {canApprove && canPerformActions && (
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-600 hover:text-green-700"
                    onClick={() => onApprove(expense.id)}
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span className="hidden sm:inline ml-1">Approve</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => onReject(expense.id)}
                  >
                    <XCircle className="w-4 h-4" />
                    <span className="hidden sm:inline ml-1">Reject</span>
                  </Button>
                </div>
              )}

              {canMarkPaid && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-blue-600 hover:text-blue-700"
                  onClick={() => onMarkPaid(expense.id)}
                >
                  <CreditCard className="w-4 h-4" />
                  <span className="hidden sm:inline ml-1">Mark Paid</span>
                </Button>
              )}

              {/* More Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canEdit && (
                    <DropdownMenuItem onClick={() => onEdit(expense)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {expense.receiptUrl && (
                    <DropdownMenuItem asChild>
                      <a
                        href={expense.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Receipt className="w-4 h-4 mr-2" />
                        View Receipt
                      </a>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {canDelete && (
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-red-600 dark:text-red-400"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{expense.title}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ExpenseCard;