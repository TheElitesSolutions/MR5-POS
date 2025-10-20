'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Order, OrderStatus } from '@/types';
import { CheckCircle, Eye, Printer, XCircle } from 'lucide-react';
import { useState } from 'react';
import InvoicePreview from './InvoicePreview';

interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus?:
    | ((orderId: string, status: OrderStatus) => void | Promise<void>)
    | null;
  onPrintReceipt?: ((orderId: string) => void | Promise<void>) | null;
  showActions?: boolean;
}

const OrderDetailsModal = ({
  order,
  isOpen,
  onClose,
  onUpdateStatus = null,
  onPrintReceipt = null,
  showActions = true,
}: OrderDetailsModalProps) => {
  const [printPreviewMode, setPrintPreviewMode] = useState(false);

  // Debug logging for order items
  if (order && isOpen) {
    console.log('📋 OrderDetailsModal - Order data:', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      hasItems: !!order.items,
      itemsCount: order.items?.length || 0,
      items: order.items?.map(item => ({
        id: item.id,
        name: item.name || item.menuItemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice
      }))
    });
  }

  if (!order) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return (
      date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) +
      ', ' +
      date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    );
  };

  const formatCurrency = (amount: number) => {
    return amount.toFixed(2);
  };

  const calculateSubtotal = () => {
    return (
      order.items?.reduce((sum, item) => sum + (item.totalPrice || 0), 0) || 0
    );
  };

  // Calculate total quantity of items (like in invoice)
  const totalQuantity =
    order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-h-[90dvh] max-w-2xl overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='text-center text-2xl font-bold'>
            Invoice
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          {/* Print Preview Toggle */}
          <div className='flex justify-end'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setPrintPreviewMode(!printPreviewMode)}
              className='flex items-center space-x-2'
            >
              <Eye className='h-4 w-4' />
              <span>
                {printPreviewMode ? 'Show Details' : 'Show Print Preview'}
              </span>
            </Button>
          </div>

          {printPreviewMode ? (
            <div className='mt-4'>
              <InvoicePreview order={order} />
            </div>
          ) : (
            <div
              className='rounded-lg border border-gray-300 bg-white font-mono text-black shadow-inner'
              style={{
                maxWidth: '80mm',
                margin: '0 auto',
                fontSize: '12px',
                padding: '4px 8px 12px 8px',
              }}
            >
              {/* Header */}
              <div className='text-center' style={{ marginBottom: '8px' }}>
                {/* Logo */}
                <div style={{ marginBottom: '0px' }}>
                  <img
                    src='/logo.png'
                    alt='Restaurant Logo'
                    style={{
                      width: '150px',
                      height: '60px',
                      margin: '0 auto',
                      display: 'block',
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    marginBottom: '2px',
                    marginTop: '0px',
                  }}
                >
                  Invoice
                </div>
              </div>

              {/* Order Info */}
              <div style={{ fontSize: '14px', marginBottom: '5px' }}>
                <div>
                  <strong>Type</strong>{' '}
                  {(order.type || 'DINE_IN').replace('_', ' ')}
                </div>
                <div>
                  <strong>Inv #</strong>{' '}
                  {order.orderNumber || order.id?.slice(-12)}
                </div>
                <div>
                  <strong>Date</strong> {formatDate(order.createdAt)}
                </div>
              </div>

              {/* Customer Information for Delivery/Takeout */}
              {(order.type === 'DELIVERY' ||
                (order.type === 'TAKEOUT' &&
                  (order.customerName ||
                    order.customerPhone ||
                    order.deliveryAddress))) && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                    {order.type === 'DELIVERY'
                      ? 'Delivery Information:'
                      : 'Customer Information:'}
                  </div>

                  {order.customerName && (
                    <div style={{ fontSize: '14px', marginBottom: '5px' }}>
                      <strong>Name</strong> {order.customerName}
                    </div>
                  )}

                  {order.customerPhone && (
                    <div style={{ fontSize: '14px', marginBottom: '5px' }}>
                      <strong>Phone</strong> {order.customerPhone}
                    </div>
                  )}

                  {order.type === 'DELIVERY' && (
                    <>
                      <div style={{ fontSize: '14px', marginBottom: '5px' }}>
                        <strong>Address:</strong>{' '}
                        {order.deliveryAddress || 'NO ADDRESS PROVIDED'}
                      </div>

                      {(order as any).deliveryInstructions && (
                        <div
                          style={{
                            fontSize: '13px',
                            marginBottom: '10px',
                            fontStyle: 'italic',
                          }}
                        >
                          <strong>Instructions:</strong>{' '}
                          {(order as any).deliveryInstructions}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Table separator */}
              <div
                style={{
                  textAlign: 'center',
                  marginTop: '10px',
                  marginBottom: '10px',
                }}
              >
                {'-'.repeat(35)}
              </div>

              {/* Table Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  padding: '3px 0',
                }}
              >
                <span style={{ width: '45%', textAlign: 'left' }}>Item</span>
                <span style={{ width: '15%', textAlign: 'center' }}>Qty</span>
                <span style={{ width: '20%', textAlign: 'right' }}>U.P</span>
                <span style={{ width: '20%', textAlign: 'right' }}>
                  Total($)
                </span>
              </div>

              {/* Table separator */}
              <div style={{ textAlign: 'center', marginBottom: '5px' }}>
                {'-'.repeat(35)}
              </div>

              {/* Items */}
              {!order.items || order.items.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  fontSize: '13px',
                  padding: '20px 0',
                  fontStyle: 'italic',
                  color: '#666'
                }}>
                  No items in this order
                </div>
              ) : (
                order.items.map((item, index) => {
                const name = item.name || item.menuItemName || 'Unknown Item';
                const qty = item.quantity || 1;
                const unitPrice =
                  item.unitPrice || (item.totalPrice || 0) / qty || 0;
                const totalPrice = item.totalPrice || 0;

                return (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '13px',
                      padding: '2px 0',
                      minHeight: '20px',
                    }}
                  >
                    <span
                      style={{
                        width: '45%',
                        textAlign: 'left',
                        wordWrap: 'break-word',
                      }}
                    >
                      {name.toLowerCase()}
                    </span>
                    <span style={{ width: '15%', textAlign: 'center' }}>
                      {qty}
                    </span>
                    <span style={{ width: '20%', textAlign: 'right' }}>
                      {formatCurrency(unitPrice)}
                    </span>
                    <span style={{ width: '20%', textAlign: 'right' }}>
                      {formatCurrency(totalPrice)}
                    </span>
                  </div>
                );
              })
              )}

              {/* Table separator */}
              <div
                style={{
                  textAlign: 'center',
                  marginTop: '5px',
                  marginBottom: '5px',
                }}
              >
                {'-'.repeat(35)}
              </div>

              {/* Totals */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '14px',
                  padding: '3px 0',
                }}
              >
                <span style={{ fontWeight: 'bold' }}>Total Quantity</span>
                <span style={{ fontWeight: 'bold' }}>{totalQuantity}</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '14px',
                  padding: '3px 0',
                }}
              >
                <span style={{ fontWeight: 'bold' }}>Items Total</span>
                <span style={{ fontWeight: 'bold' }}>
                  {formatCurrency(order.subtotal || calculateSubtotal())}$
                </span>
              </div>

              {/* Delivery Fee */}
              {order.type === 'DELIVERY' && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    padding: '3px 0',
                    marginTop: '2px',
                  }}
                >
                  <span style={{ fontWeight: 'bold' }}>Delivery Fee</span>
                  <span style={{ fontWeight: 'bold' }}>
                    {formatCurrency(order.deliveryFee || 0)}$
                  </span>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '14px',
                  padding: '3px 0',
                }}
              >
                <span style={{ fontWeight: 'bold' }}>Total Invoice</span>
                <span style={{ fontWeight: 'bold' }}>
                  {formatCurrency(order.totalAmount || order.total || 0)}$
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '14px',
                  padding: '3px 0',
                  marginBottom: '15px',
                }}
              >
                <span style={{ fontWeight: 'bold' }}>Net to pay</span>
                <span style={{ fontWeight: 'bold' }}>
                  {formatCurrency(order.totalAmount || order.total || 0)}$
                </span>
              </div>

              {/* Bottom separator */}
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                {'-'.repeat(35)}
              </div>

              {/* Footer */}
              <div style={{ textAlign: 'center', marginTop: '10px' }}>
                <div style={{ fontSize: '12px' }}>Powered by</div>
                <div style={{ fontSize: '12px', fontWeight: 'bold' }}>
                  THE ELITES SOLUTIONS
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          {showActions && (
            <>
              <Separator />
              <div className='flex items-center space-x-3'>
                {onPrintReceipt && (
                  <Button
                    variant='outline'
                    onClick={() => onPrintReceipt(order.id)}
                    className='flex items-center space-x-2'
                  >
                    <Printer className='h-4 w-4' />
                    <span>Print Invoice</span>
                  </Button>
                )}

                {onUpdateStatus && order.status.toLowerCase() === 'pending' && (
                  <>
                    <Button
                      variant='default'
                      onClick={() =>
                        onUpdateStatus &&
                        onUpdateStatus(order.id, OrderStatus.COMPLETED)
                      }
                      className='flex items-center space-x-2'
                    >
                      <CheckCircle className='h-4 w-4' />
                      <span>Mark Complete</span>
                    </Button>

                    <Button
                      variant='destructive'
                      onClick={() =>
                        onUpdateStatus &&
                        onUpdateStatus(order.id, OrderStatus.CANCELLED)
                      }
                      className='flex items-center space-x-2'
                    >
                      <XCircle className='h-4 w-4' />
                      <span>Cancel Order</span>
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsModal;
