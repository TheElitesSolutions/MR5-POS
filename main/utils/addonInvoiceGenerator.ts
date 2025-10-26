/**
 * Add-On Enhanced Invoice Generator
 *
 * Extended invoice generation with comprehensive add-on support
 * Groups items by menuItemId but includes add-on details and pricing
 */

import { AddonService } from '../services/AddonService';
import * as path from 'path';
import { getCurrentLocalDateTime } from './dateTime';

/**
 * Enhanced invoice generation with add-on support
 *
 * This function extends the existing invoice functionality to include
 * detailed add-on information while maintaining the grouping behavior
 */
export class AddonInvoiceGenerator {
  private addonService: AddonService;

  constructor(addonService: AddonService) {
    this.addonService = addonService;
  }

  /**
   * Generate enhanced thermal invoice with add-on details
   */
  async generateEnhancedThermalInvoiceWithAddons(
    order: any,
    businessInfo: any,
    getResourcesPath: () => string
  ): Promise<string> {
    console.log('💰 GENERATING INVOICE WITH ADD-ONS:', {
      orderId: order?.id,
      orderNumber: order?.orderNumber,
      itemCount: order?.items?.length || 0,
    });

    // First, enrich order items with add-on data
    const enrichedOrder = await this.enrichOrderItemsWithAddons(order);

    // Then generate the enhanced invoice using grouped logic with add-on support
    return this.generateAddonEnhancedInvoice(
      enrichedOrder,
      businessInfo,
      getResourcesPath
    );
  }

  /**
   * Enrich order items with add-on data
   */
  private async enrichOrderItemsWithAddons(order: any): Promise<any> {
    if (!order?.items) {
      return order;
    }

    const enrichedItems = await Promise.all(
      order.items.map(async (item: any) => {
        try {
          // Use existing addons if available (from OrderModel), otherwise fetch from database
          let addons = [];
          if (item.addons && Array.isArray(item.addons) && item.addons.length > 0) {
            // Addons already attached by OrderModel.findById()
            addons = item.addons;
            console.log(`Using pre-loaded addons for item ${item.id}:`, addons.length);
          } else {
            // Fallback: fetch from database if not present
            const addonResult = await this.addonService.getOrderItemAddons(item.id);
            addons = addonResult.success ? addonResult.data : [];
            console.log(`Fetched addons from DB for item ${item.id}:`, addons.length);
          }

          // Calculate add-on total for this item
          const addonTotal = addons.reduce(
            (sum: number, addon: any) => sum + Number(addon.totalPrice),
            0
          );

          return {
            ...item,
            addons: addons,
            hasAddons: addons.length > 0,
            addonTotal: addonTotal,
            baseItemPrice: Number(item.totalPrice) - addonTotal,
          };
        } catch (error) {
          console.warn(`Failed to get add-ons for item ${item.id}:`, error);
          return {
            ...item,
            addons: [],
            hasAddons: false,
            addonTotal: 0,
            baseItemPrice: Number(item.totalPrice),
          };
        }
      })
    );

    return {
      ...order,
      items: enrichedItems,
    };
  }

  /**
   * Generate enhanced invoice with add-on support
   */
  private generateAddonEnhancedInvoice(
    order: any,
    businessInfo: any,
    getResourcesPath: () => string
  ): string {
    const printData = [];

    // Add global print styles to eliminate page margins and save paper
    printData.push({
      type: 'text',
      value: `<style>@page { margin: 0; padding: 0; } @media print { body { margin: 0; padding: 0; } }</style>`,
      style: { display: 'none' },
    });

    // Full thermal printer width
    const FULL_WIDTH = 35;
    const SEPARATOR = '-'.repeat(FULL_WIDTH);

    // Logo at the top center
    const logoPath = path.join(getResourcesPath(), 'logo.png');
    printData.push({
      type: 'image',
      path: logoPath,
      position: 'center',
      width: '200px',
      height: '185px',
      style: {
        marginTop: '0px',
        paddingTop: '0px',
      },
    });

    // Header - "Invoice" (large, bold, centered)
    printData.push({
      type: 'text',
      value: `<div style="text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 2px; margin-top: 0px; padding-top: 0px;">Invoice</div>`,
      style: {
        fontFamily: 'Arial, sans-serif',
        width: '100%',
        textAlign: 'center',
      },
    });

    // Invoice details
    const invoiceNumber = order.orderNumber || order.id.slice(-12);
    const orderDate = new Date(order.createdAt);
    const formattedDate =
      orderDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) +
      ', ' +
      orderDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

    // Order Type
    const orderType = order.type?.toUpperCase() || 'DINE_IN';
    printData.push(
      {
        type: 'text',
        value: `<div style="font-size: 14px; margin-bottom: 5px;"><strong>Type</strong>   ${orderType.replace('_', ' ')}</div>`,
        style: {
          fontFamily: 'Arial, sans-serif',
          width: '100%',
        },
      },
      {
        type: 'text',
        value: `<div style="font-size: 14px; margin-bottom: 5px;"><strong>Inv #</strong>  ${invoiceNumber}</div>`,
        style: {
          fontFamily: 'Arial, sans-serif',
          width: '100%',
        },
      },
      {
        type: 'text',
        value: `<div style="font-size: 14px; margin-bottom: 5px;"><strong>Date</strong>   ${formattedDate}</div>`,
        style: {
          fontFamily: 'Arial, sans-serif',
          width: '100%',
        },
      }
    );

    // Add customer information if present
    if (order.customerName || order.customerPhone || order.deliveryAddress) {
      printData.push({
        type: 'text',
        value: `<div style="text-align: center; font-size: 16px; font-weight: bold; margin: 10px 0;">CUSTOMER INFORMATION</div>`,
        style: {
          fontFamily: 'Arial, sans-serif',
          width: '100%',
          textAlign: 'center',
        },
      });

      if (order.customerName) {
        printData.push({
          type: 'text',
          value: `<div style="font-size: 14px; margin-bottom: 3px;"><strong>Name:</strong> ${order.customerName}</div>`,
          style: {
            fontFamily: 'Arial, sans-serif',
            width: '100%',
          },
        });
      }

      if (order.customerPhone) {
        printData.push({
          type: 'text',
          value: `<div style="font-size: 14px; margin-bottom: 3px;"><strong>Phone:</strong> ${order.customerPhone}</div>`,
          style: {
            fontFamily: 'Arial, sans-serif',
            width: '100%',
          },
        });
      }

      if (order.deliveryAddress) {
        printData.push({
          type: 'text',
          value: `<div style="font-size: 14px; margin-bottom: 3px;"><strong>Address:</strong> ${order.deliveryAddress}</div>`,
          style: {
            fontFamily: 'Arial, sans-serif',
            width: '100%',
          },
        });
      }
    }

    // Table header
    printData.push(
      {
        type: 'text',
        value: `<div style="text-align: center; font-family: monospace; font-size: 12px; margin: 10px 0 5px 0;">${SEPARATOR}</div>`,
        style: {
          fontFamily: 'monospace',
          width: '100%',
          textAlign: 'center',
        },
      },
      {
        type: 'text',
        value: `<div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; padding: 2px 0; border-bottom: 1px solid black;">
          <span style="width: 45%; text-align: left;">Item</span>
          <span style="width: 15%; text-align: center;">Qty</span>
          <span style="width: 20%; text-align: right;">Unit</span>
          <span style="width: 20%; text-align: right;">Total</span>
        </div>`,
        style: {
          fontFamily: 'Arial, sans-serif',
          width: '100%',
        },
      }
    );

    // Group items by menuItemId with add-on support
    const groupedItems = new Map<
      string,
      {
        name: string;
        totalQuantity: number;
        unitPrice: number;
        baseTotal: number;
        addonTotal: number;
        totalPrice: number;
        menuItemId: string;
        addons: Array<{
          name: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          groupName: string;
        }>;
      }
    >();

    let totalQuantity = 0;

    // Debug: Log order items before processing
    console.log('📋 INVOICE GENERATION - Order items to process:', {
      orderId: order.id,
      itemsCount: order.items?.length || 0,
      items: order.items?.map((item: any) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        name: item.menuItem?.name || item.menuItemName || item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        hasAddons: item.hasAddons,
        addonsCount: item.addons?.length || 0
      }))
    });

    // Ensure items array exists
    if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
      console.warn('⚠️ INVOICE GENERATION - No items found in order:', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        hasItems: !!order.items,
        isArray: Array.isArray(order.items),
        itemsLength: order.items?.length
      });

      // Add a placeholder row if no items
      printData.push({
        type: 'text',
        value: `<div style="display: flex; justify-content: space-between; font-size: 13px; padding: 10px 0; text-align: center; font-style: italic; color: #666;">
          <span style="width: 100%;">No items in order</span>
        </div>`,
        style: {
          fontFamily: 'Arial, sans-serif',
          width: '100%',
        },
      });
    }

    // Group items by menuItemId and aggregate add-ons
    order.items?.forEach((item: any) => {
      const menuItemId = item.menuItemId || item.menuItem?.id || 'unknown';
      const name = item.menuItem?.name || item.menuItemName || item.name || 'Unknown Item';
      const qty = item.quantity || 1;
      const baseItemPrice = item.baseItemPrice || item.unitPrice || item.totalPrice || 0;
      const addonTotal = item.addonTotal || 0;
      const itemTotalPrice = item.totalPrice || 0;
      const unitPrice = baseItemPrice / qty; // Unit price for base item only

      if (groupedItems.has(menuItemId)) {
        // Add to existing group
        const existing = groupedItems.get(menuItemId)!;
        existing.totalQuantity += qty;
        existing.baseTotal += baseItemPrice;
        existing.addonTotal += addonTotal;
        existing.totalPrice += itemTotalPrice;

        // Add add-ons to the group
        if (item.hasAddons && item.addons?.length > 0) {
          item.addons.forEach((addon: any) => {
            existing.addons.push({
              name: addon.addon?.name || addon.addonName || 'Unknown Addon',
              quantity: addon.quantity,
              unitPrice: Number(addon.unitPrice),
              totalPrice: Number(addon.totalPrice),
              groupName: addon.addon?.addonGroup?.name || 'Add-ons',
            });
          });
        }
      } else {
        // Create new group
        const addons: Array<{
          name: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          groupName: string;
        }> = [];

        if (item.hasAddons && item.addons?.length > 0) {
          item.addons.forEach((addon: any) => {
            addons.push({
              name: addon.addon?.name || addon.addonName || 'Unknown Addon',
              quantity: addon.quantity,
              unitPrice: Number(addon.unitPrice),
              totalPrice: Number(addon.totalPrice),
              groupName: addon.addon?.addonGroup?.name || 'Add-ons',
            });
          });
        }

        groupedItems.set(menuItemId, {
          name,
          totalQuantity: qty,
          unitPrice,
          baseTotal: baseItemPrice,
          addonTotal: addonTotal,
          totalPrice: itemTotalPrice,
          menuItemId,
          addons,
        });
      }
    });

    // Debug: Log grouped items before display
    console.log('📊 INVOICE GENERATION - Grouped items:', {
      groupedItemsCount: groupedItems.size,
      groupedItems: Array.from(groupedItems.entries()).map(([id, item]) => ({
        menuItemId: id,
        name: item.name,
        totalQuantity: item.totalQuantity,
        unitPrice: item.unitPrice,
        baseTotal: item.baseTotal,
        addonTotal: item.addonTotal,
        totalPrice: item.totalPrice,
        addonsCount: item.addons.length
      }))
    });

    // Display grouped items with add-ons
    groupedItems.forEach(groupedItem => {
      totalQuantity += groupedItem.totalQuantity;

      const itemName = groupedItem.name.toLowerCase();
      const unitPriceStr = typeof groupedItem.unitPrice === 'number' ? groupedItem.unitPrice.toFixed(2) : '0.00';
      const baseTotalStr = typeof groupedItem.baseTotal === 'number' ? groupedItem.baseTotal.toFixed(2) : '0.00';

      console.log('🖨️ INVOICE GENERATION - Adding item to display:', {
        name: itemName,
        quantity: groupedItem.totalQuantity,
        unitPrice: unitPriceStr,
        baseTotal: baseTotalStr
      });

      // Display main item
      printData.push({
        type: 'text',
        value: `<div style="display: flex; justify-content: space-between; font-size: 13px; padding: 2px 0; min-height: 20px;">
          <span style="width: 45%; text-align: left; word-wrap: break-word; font-weight: bold;">${itemName}</span>
          <span style="width: 15%; text-align: center;">${groupedItem.totalQuantity}</span>
          <span style="width: 20%; text-align: right;">$${unitPriceStr}</span>
          <span style="width: 20%; text-align: right;">$${baseTotalStr}</span>
        </div>`,
        style: {
          fontFamily: 'Arial, sans-serif',
          width: '100%',
        },
      });

      // Display add-ons if present
      if (groupedItem.addons.length > 0) {
        // Group add-ons by group name for better organization
        const addonsByGroup: {
          [groupName: string]: typeof groupedItem.addons;
        } = {};
        groupedItem.addons.forEach(addon => {
          if (!addonsByGroup[addon.groupName]) {
            addonsByGroup[addon.groupName] = [];
          }
          addonsByGroup[addon.groupName].push(addon);
        });

        Object.entries(addonsByGroup).forEach(([groupName, addons]) => {
          // Display group header if more than one group
          if (Object.keys(addonsByGroup).length > 1) {
            printData.push({
              type: 'text',
              value: `<div style="font-size: 11px; padding: 1px 0; font-style: italic;">
                <span style="margin-left: 15px;">${groupName}:</span>
              </div>`,
              style: {
                fontFamily: 'Arial, sans-serif',
                width: '100%',
              },
            });
          }

          // Display each add-on in the group
          addons.forEach(addon => {
            const addonDisplay =
              addon.quantity > 1
                ? `${addon.quantity}x ${addon.name}`
                : addon.name;
            const marginLeft =
              Object.keys(addonsByGroup).length > 1 ? '25px' : '15px';

            const addonUnitPriceStr = typeof addon.unitPrice === 'number' ? addon.unitPrice.toFixed(2) : '0.00';
            const addonTotalPriceStr = typeof addon.totalPrice === 'number' ? addon.totalPrice.toFixed(2) : '0.00';

            printData.push({
              type: 'text',
              value: `<div style="display: flex; justify-content: space-between; font-size: 11px; padding: 1px 0;">
                <span style="width: 45%; text-align: left; margin-left: ${marginLeft}; font-style: italic;">+ ${addonDisplay}</span>
                <span style="width: 15%; text-align: center;"></span>
                <span style="width: 20%; text-align: right;">$${addonUnitPriceStr}</span>
                <span style="width: 20%; text-align: right;">$${addonTotalPriceStr}</span>
              </div>`,
              style: {
                fontFamily: 'Arial, sans-serif',
                width: '100%',
              },
            });
          });
        });
      }
    });

    // Table separator
    printData.push({
      type: 'text',
      value: `<div style="text-align: center; font-family: monospace; font-size: 12px;">${SEPARATOR}</div>`,
      style: {
        fontFamily: 'monospace',
        width: '100%',
        textAlign: 'center',
      },
    });

    // Calculate totals
    const subtotal = order.subtotal || order.total || 0;
    const tax = order.tax || 0;
    const total = order.total || subtotal + tax;

    console.log('💰 INVOICE GENERATION - Totals calculated:', {
      subtotal,
      tax,
      total,
      totalQuantity,
      itemsDisplayed: groupedItems.size
    });

    // Totals section
    const totalsData = [
      { label: 'Total Quantity:', value: `${totalQuantity}` },
      { label: 'Items Total:', value: `$${subtotal.toFixed(2)}` },
    ];

    if (tax > 0) {
      totalsData.push({ label: 'Tax:', value: `$${tax.toFixed(2)}` });
    }

    totalsData.push({ label: 'Total Invoice:', value: `$${total.toFixed(2)}` });
    totalsData.push({ label: 'Net to pay:', value: `$${total.toFixed(2)}` });

    totalsData.forEach((item, index) => {
      const isTotal = index === totalsData.length - 1;
      printData.push({
        type: 'text',
        value: `<div style="display: flex; justify-content: space-between; font-size: ${isTotal ? '16px' : '14px'}; padding: 2px 0; ${isTotal ? 'font-weight: bold; border-top: 1px solid black; margin-top: 3px; padding-top: 5px;' : ''}">
          <span>${item.label}</span>
          <span>${item.value}</span>
        </div>`,
        style: {
          fontFamily: 'Arial, sans-serif',
          width: '100%',
        },
      });
    });

    // Payment information
    if (order.paymentMethod) {
      printData.push(
        {
          type: 'text',
          value: `<div style="text-align: center; font-size: 12px; margin-top: 10px;">${SEPARATOR}</div>`,
          style: {
            fontFamily: 'monospace',
            width: '100%',
            textAlign: 'center',
          },
        },
        {
          type: 'text',
          value: `<div style="font-size: 14px; text-align: center; margin: 5px 0;">
            <strong>Payment: ${order.paymentMethod.toUpperCase()}</strong>
          </div>`,
          style: {
            fontFamily: 'Arial, sans-serif',
            width: '100%',
            textAlign: 'center',
          },
        }
      );
    }

    // Footer
    printData.push(
      {
        type: 'text',
        value: `<div style="text-align: center; font-size: 12px; margin-top: 10px;">${SEPARATOR}</div>`,
        style: {
          fontFamily: 'monospace',
          width: '100%',
          textAlign: 'center',
        },
      },
      {
        type: 'text',
        value: `<div style="text-align: center; font-size: 11px; margin: 10px 0 5px 0; font-weight: bold;">Powered by</div>`,
        style: {
          fontFamily: 'Arial, sans-serif',
          width: '100%',
          textAlign: 'center',
        },
      },
      {
        type: 'text',
        value: `<div style="text-align: center; font-size: 11px; margin: 0 0 10px 0; font-weight: bold;">THE ELITES SOLUTIONS</div>`,
        style: {
          fontFamily: 'Arial, sans-serif',
          width: '100%',
          textAlign: 'center',
        },
      }
    );

    // Convert to JSON string for printer
    const result = JSON.stringify(printData, null, 0);

    // Final debug summary
    console.log('✅ INVOICE GENERATION COMPLETE:', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalItemsProcessed: order.items?.length || 0,
      totalGroupedItems: groupedItems.size,
      totalQuantity: totalQuantity,
      invoiceTotal: total.toFixed(2),
      printDataElements: printData.length
    });

    return result;
  }

  /**
   * Generate thermal invoice text format with add-ons
   */
  async generateThermalInvoiceWithAddons(
    order: any,
    businessInfo: any
  ): Promise<string> {
    console.log('🖨️ GENERATING THERMAL INVOICE WITH ADD-ONS:', {
      orderId: order?.id,
      orderNumber: order?.orderNumber,
      itemCount: order?.items?.length || 0,
    });

    // First, enrich order items with add-on data
    const enrichedOrder = await this.enrichOrderItemsWithAddons(order);

    // Generate simple thermal text format
    let thermal = '';

    // Header
    thermal += `${businessInfo.name}\n`;
    thermal += `${businessInfo.address || ''}\n`;
    thermal += `${businessInfo.phone || ''}\n`;
    thermal += '========================================\n';
    thermal += `Invoice #: INV-${order.orderNumber}\n`;
    thermal += `Date: ${new Date().toLocaleString()}\n`;
    thermal += `Table: ${order.table?.name || order.tableName || 'N/A'}\n`;
    thermal += `Order: ${order.orderNumber}\n`;
    thermal += '========================================\n\n';

    // Items with add-ons
    enrichedOrder.items.forEach((item: any) => {
      thermal += `${item.quantity}x ${item.name || item.menuItem?.name}\n`;
      thermal += `   $${Number(item.baseItemPrice || item.price).toFixed(2)}\n`;

      // Add-ons for this item
      if (item.hasAddons && item.addons.length > 0) {
        item.addons.forEach((addon: any) => {
          thermal += `   + ${addon.quantity}x ${addon.addon.name}\n`;
          thermal += `     $${Number(addon.totalPrice).toFixed(2)}\n`;
        });
      }

      thermal += `   Subtotal: $${Number(item.totalPrice).toFixed(2)}\n`;
      thermal += '\n';
    });

    // Totals
    thermal += '========================================\n';
    thermal += `Subtotal: $${Number(enrichedOrder.subtotal || enrichedOrder.total).toFixed(2)}\n`;
    if (enrichedOrder.tax) {
      thermal += `Tax: $${Number(enrichedOrder.tax).toFixed(2)}\n`;
    }
    thermal += `Total: $${Number(enrichedOrder.total).toFixed(2)}\n`;
    thermal += '========================================\n';
    thermal += 'Thank you for your business!\n';
    thermal += '========================================\n';

    console.log('✅ Thermal invoice with add-ons generated successfully');
    return thermal;
  }

  /**
   * Generate PDF invoice with add-ons
   */
  async generatePDFInvoiceWithAddons(
    order: any,
    businessInfo: any
  ): Promise<Buffer> {
    console.log('📄 GENERATING PDF INVOICE WITH ADD-ONS:', {
      orderId: order?.id,
      orderNumber: order?.orderNumber,
      itemCount: order?.items?.length || 0,
    });

    // First, enrich order items with add-on data
    const enrichedOrder = await this.enrichOrderItemsWithAddons(order);

    // Simple HTML to PDF conversion (simplified implementation)
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .business { font-size: 20px; font-weight: bold; }
        .invoice-info { margin: 20px 0; }
        .items { margin: 20px 0; }
        .item { margin: 10px 0; }
        .addon { margin-left: 20px; color: #666; }
        .totals { border-top: 2px solid #000; padding-top: 10px; text-align: right; }
        .total-line { margin: 5px 0; }
        .final-total { font-weight: bold; font-size: 18px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="business">${businessInfo.name}</div>
        <div>${businessInfo.address || ''}</div>
        <div>${businessInfo.phone || ''}</div>
      </div>
      
      <div class="invoice-info">
        <strong>Invoice #:</strong> INV-${order.orderNumber}<br>
        <strong>Date:</strong> ${new Date().toLocaleString()}<br>
        <strong>Table:</strong> ${order.table?.name || order.tableName || 'N/A'}<br>
        <strong>Order:</strong> ${order.orderNumber}
      </div>
      
      <div class="items">
        <strong>Items:</strong><br>
        ${enrichedOrder.items
          .map(
            (item: any) => `
          <div class="item">
            <strong>${item.quantity}x ${item.name || item.menuItem?.name}</strong> - $${Number(item.baseItemPrice || item.price).toFixed(2)}
            ${
              item.hasAddons && item.addons.length > 0
                ? item.addons
                    .map(
                      (addon: any) => `
                <div class="addon">
                  + ${addon.quantity}x ${addon.addon.name} - $${Number(addon.totalPrice).toFixed(2)}
                </div>
              `
                    )
                    .join('')
                : ''
            }
            <div><strong>Subtotal: $${Number(item.totalPrice).toFixed(2)}</strong></div>
          </div>
        `
          )
          .join('')}
      </div>
      
      <div class="totals">
        <div class="total-line">Subtotal: $${Number(enrichedOrder.subtotal || enrichedOrder.total).toFixed(2)}</div>
        ${enrichedOrder.tax ? `<div class="total-line">Tax: $${Number(enrichedOrder.tax).toFixed(2)}</div>` : ''}
        <div class="total-line final-total">Total: $${Number(enrichedOrder.total).toFixed(2)}</div>
      </div>
      
      <div style="text-align: center; margin-top: 30px;">
        <strong>Thank you for your business!</strong>
      </div>
    </body>
    </html>
    `;

    // For now, return HTML as buffer (in production, use a proper HTML-to-PDF library)
    const buffer = Buffer.from(html, 'utf8');

    console.log('✅ PDF invoice with add-ons generated successfully');
    return buffer;
  }
}
