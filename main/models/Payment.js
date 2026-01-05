import { AppError } from '../error-handler';
import { PaymentMethod, PaymentStatus } from '../types';
import { addDecimals, decimalToNumber, subtractDecimals, validateCurrencyAmount, } from '../utils/decimal';
import { Decimal as DecimalJS } from 'decimal.js';
import { logger } from '../utils/logger';
import { getCurrentLocalDateTime } from '../utils/dateTime';
export class PaymentModel {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Convert Prisma Payment to type-safe Payment interface
     */
    mapPrismaPayment(payment) {
        return {
            id: payment.id,
            orderId: payment.orderId,
            amount: decimalToNumber(payment.amount), // Convert Prisma.Decimal to plain number for IPC
            method: payment.method,
            status: payment.status,
            reference: payment.reference,
            processedAt: payment.processedAt,
            createdAt: payment.createdAt,
            updatedAt: payment.updatedAt,
        };
    }
    async findById(id) {
        try {
            const payment = await this.prisma.payment.findUnique({
                where: { id },
                include: {
                    order: {
                        include: {
                            table: true,
                            customer: true,
                        },
                    },
                },
            });
            return {
                success: true,
                data: payment ? this.mapPrismaPayment(payment) : null,
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to get payment by ID ${id}: ${error instanceof Error ? error.message : error}`, 'PaymentModel');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get payment',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async findByOrderId(orderId) {
        try {
            const payments = await this.prisma.payment.findMany({
                where: { orderId },
                include: {
                    order: true,
                },
                orderBy: { createdAt: 'asc' },
            });
            return {
                success: true,
                data: payments.map(payment => this.mapPrismaPayment(payment)),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to get payments for order ${orderId}: ${error instanceof Error ? error.message : error}`, 'PaymentModel');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get payments',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async create(paymentData) {
        try {
            // Validate monetary amounts
            if (!validateCurrencyAmount(paymentData.amount)) {
                throw new AppError('Invalid payment amount', true);
            }
            // Validate that amount is positive
            if (paymentData.amount.lte(0)) {
                throw new AppError('Payment amount must be greater than 0', true);
            }
            // Check if order exists and get its total
            const order = await this.prisma.order.findUnique({
                where: { id: paymentData.orderId },
                select: { total: true, status: true },
            });
            if (!order) {
                throw new AppError('Order not found', true);
            }
            // Get existing payments for this order
            const existingPayments = await this.prisma.payment.findMany({
                where: {
                    orderId: paymentData.orderId,
                    status: PaymentStatus.COMPLETED,
                },
                select: { amount: true },
            });
            // Calculate total paid amount
            let totalPaid = new DecimalJS(0);
            for (const payment of existingPayments) {
                totalPaid = addDecimals(totalPaid, payment.amount);
            }
            // Check if adding this payment would exceed the order total
            const newTotalPaid = addDecimals(totalPaid, paymentData.amount);
            if (newTotalPaid.gt(order.total)) {
                throw new AppError(`Payment amount exceeds remaining balance. Remaining: ${subtractDecimals(order.total, totalPaid).toString()}`, true);
            }
            const payment = await this.prisma.payment.create({
                data: {
                    orderId: paymentData.orderId,
                    amount: paymentData.amount,
                    method: paymentData.method,
                    status: PaymentStatus.PENDING,
                    reference: paymentData.reference || null,
                },
                include: {
                    order: true,
                },
            });
            logger.info('Payment created successfully', `paymentId: ${payment.id}, orderId: ${paymentData.orderId}, amount: ${paymentData.amount}`);
            return {
                success: true,
                data: this.mapPrismaPayment(payment),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            logger.error(`Failed to create payment: ${error instanceof Error ? error.message : error}`, 'PaymentModel');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create payment',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async updateStatus(id, status, reference) {
        try {
            const updateData = { status };
            if (status === PaymentStatus.COMPLETED) {
                updateData.processedAt = new Date();
            }
            if (reference) {
                updateData.reference = reference;
            }
            const payment = await this.prisma.payment.update({
                where: { id },
                data: updateData,
                include: {
                    order: true,
                },
            });
            logger.info('Payment status updated', `paymentId: ${id}, newStatus: ${status}`);
            return {
                success: true,
                data: this.mapPrismaPayment(payment),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to update payment status for ${id} to ${status}: ${error instanceof Error ? error.message : error}`, 'PaymentModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to update payment status',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async processPayment(id) {
        try {
            const payment = await this.prisma.payment.update({
                where: { id },
                data: {
                    status: PaymentStatus.COMPLETED,
                    processedAt: getCurrentLocalDateTime(),
                },
                include: {
                    order: true,
                },
            });
            // Check if order is fully paid
            await this.checkOrderPaymentStatus(payment.orderId);
            logger.info('Payment processed successfully', `paymentId: ${id}`);
            return {
                success: true,
                data: this.mapPrismaPayment(payment),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to process payment ${id}: ${error instanceof Error ? error.message : error}`, 'PaymentModel');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to process payment',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async refundPayment(id, reason) {
        try {
            const payment = await this.prisma.payment.update({
                where: { id },
                data: {
                    status: PaymentStatus.REFUNDED,
                    reference: reason ? `Refunded: ${reason}` : 'Refunded',
                },
                include: {
                    order: true,
                },
            });
            logger.info('Payment refunded successfully', `paymentId: ${id}`);
            return {
                success: true,
                data: this.mapPrismaPayment(payment),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to refund payment ${id}: ${error instanceof Error ? error.message : error}`, 'PaymentModel');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to refund payment',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async getOrderPaymentSummary(orderId) {
        try {
            const order = await this.prisma.order.findUnique({
                where: { id: orderId },
                select: { total: true },
            });
            if (!order) {
                throw new AppError('Order not found', true);
            }
            const payments = await this.prisma.payment.findMany({
                where: { orderId },
                orderBy: { createdAt: 'asc' },
            });
            // Calculate total paid from completed payments
            let totalPaid = new DecimalJS(0);
            for (const payment of payments) {
                if (payment.status === PaymentStatus.COMPLETED) {
                    totalPaid = addDecimals(totalPaid, payment.amount);
                }
            }
            const remainingBalance = subtractDecimals(order.total, totalPaid);
            const isFullyPaid = remainingBalance.lte(0);
            return {
                success: true,
                data: {
                    orderTotal: order.total,
                    totalPaid,
                    remainingBalance,
                    payments: payments.map(payment => this.mapPrismaPayment(payment)),
                    isFullyPaid,
                },
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            logger.error(`Failed to get payment summary for order ${orderId}: ${error instanceof Error ? error.message : error}`, 'PaymentModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to get payment summary',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async checkOrderPaymentStatus(orderId) {
        const summaryResult = await this.getOrderPaymentSummary(orderId);
        if (summaryResult.success && summaryResult.data?.isFullyPaid) {
            // Update order status to paid/completed if business logic requires it
            // This could be implemented based on your business requirements
            logger.info('Order is fully paid', `orderId: ${orderId}`);
        }
    }
    async findByStatus(status) {
        try {
            const payments = await this.prisma.payment.findMany({
                where: { status },
                include: {
                    order: {
                        include: {
                            table: true,
                            customer: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });
            return {
                success: true,
                data: payments.map(payment => this.mapPrismaPayment(payment)),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to get payments by status ${status}: ${error instanceof Error ? error.message : error}`, 'PaymentModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to get payments by status',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async getDailySummary(date) {
        try {
            const targetDate = date || new Date();
            const startOfDay = new Date(targetDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(targetDate);
            endOfDay.setHours(23, 59, 59, 999);
            const payments = await this.prisma.payment.findMany({
                where: {
                    status: PaymentStatus.COMPLETED,
                    processedAt: {
                        gte: startOfDay,
                        lte: endOfDay,
                    },
                },
            });
            let totalRevenue = new DecimalJS(0);
            const paymentMethodBreakdown = {
                [PaymentMethod.CASH]: { count: 0, total: new DecimalJS(0) },
                [PaymentMethod.CARD]: { count: 0, total: new DecimalJS(0) },
                [PaymentMethod.DIGITAL_WALLET]: {
                    count: 0,
                    total: new DecimalJS(0),
                },
                [PaymentMethod.CHECK]: { count: 0, total: new DecimalJS(0) },
                [PaymentMethod.OTHER]: { count: 0, total: new DecimalJS(0) },
            };
            for (const payment of payments) {
                totalRevenue = addDecimals(totalRevenue, payment.amount);
                paymentMethodBreakdown[payment.method].count++;
                paymentMethodBreakdown[payment.method].total = addDecimals(paymentMethodBreakdown[payment.method].total, payment.amount);
            }
            return {
                success: true,
                data: {
                    totalRevenue,
                    totalTransactions: payments.length,
                    paymentMethodBreakdown,
                },
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to get daily payment summary: ${error instanceof Error ? error.message : error}`, 'PaymentModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to get daily payment summary',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
}
