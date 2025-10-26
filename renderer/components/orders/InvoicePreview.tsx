'use client';

import React from 'react';
import { Order } from '@/types';

interface InvoicePreviewProps {
  order: Order;
}

const InvoicePreview: React.FC<InvoicePreviewProps> = ({ order }) => {
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

  // Helper function to format currency
  const formatCurrency = (amount: number) => {
    return amount.toFixed(2);
  };

  // Format date strings
  const formatDate = (dateString: string) => {
    const date = parseLocalDateTime(dateString);
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

  // Calculate total quantity of items
  const totalQuantity =
    order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;

  return (
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
          <strong>Type</strong> {(order.type || 'DINE_IN').replace('_', ' ')}
        </div>
        <div>
          <strong>Inv #</strong> {order.orderNumber || order.id?.slice(-12)}
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

              {order.notes && (
                <div
                  style={{
                    fontSize: '13px',
                    marginBottom: '10px',
                    fontStyle: 'italic',
                  }}
                >
                  <strong>Instructions:</strong> {order.notes}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Table separator */}
      <div
        style={{ textAlign: 'center', marginTop: '10px', marginBottom: '10px' }}
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
        <span style={{ width: '20%', textAlign: 'right' }}>Total($)</span>
      </div>

      {/* Table separator */}
      <div style={{ textAlign: 'center', marginBottom: '5px' }}>
        {'-'.repeat(35)}
      </div>

      {/* Items */}
      {order.items?.map((item, index) => {
        const name = item.name || item.menuItemName || 'Unknown Item';
        const qty = item.quantity || 1;
        const unitPrice = item.unitPrice || (item.totalPrice ? item.totalPrice / qty : 0);
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
            <span style={{ width: '15%', textAlign: 'center' }}>{qty}</span>
            <span style={{ width: '20%', textAlign: 'right' }}>
              {formatCurrency(unitPrice)}
            </span>
            <span style={{ width: '20%', textAlign: 'right' }}>
              {formatCurrency(totalPrice)}
            </span>
          </div>
        );
      })}

      {/* Table separator */}
      <div
        style={{ textAlign: 'center', marginTop: '5px', marginBottom: '5px' }}
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
          {formatCurrency(order.subtotal || 0)}$
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
  );
};

export default InvoicePreview;
