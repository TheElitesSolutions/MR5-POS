import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { Order, OrderItem, Table, User } from '../types/index';
import { getCurrentLocalDateTime } from './dateTime';

interface ReceiptData {
  order: Order & {
    items: (OrderItem & {
      menuItem: {
        name: string;
        price: number;
      } | null;
      customizations?: Array<{
        id: string;
        type: string;
        value: string;
        priceAdjustment: number;
      }>;
    })[];
    table: Table | null;
    user: User | null;
  };
  businessInfo: {
    name: string;
    address: string;
    phone: string;
    email: string;
    registrationNumber: string;
    taxNumber: string;
  };
}

interface ReceiptCalculations {
  subtotal: number;
  vatAmount: number;
  total: number;
  vatRate: number;
}

export class LebanesReceiptGenerator {
  private static readonly VAT_RATE = 0.11; // 11% VAT rate for Lebanon
  private static readonly RECEIPT_WIDTH = 80; // 80mm thermal printer width

  /**
   * Generate a Lebanese-compliant receipt PDF
   */
  static async generateReceipt(receiptData: ReceiptData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: [226.77, 841.89], // 80mm width, A4 height in points
          margin: 0, // ZERO MARGIN to eliminate paper waste
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });

        // Generate receipt content
        this.buildReceiptContent(doc, receiptData);
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Build the complete receipt content
   */
  private static buildReceiptContent(
    doc: PDFKit.PDFDocument,
    data: ReceiptData
  ) {
    const { order, businessInfo } = data;
    const calculations = this.calculateTotals(order);

    // Header - Business Information
    this.addBusinessHeader(doc, businessInfo);

    // Receipt Information
    this.addReceiptInfo(doc, order);

    // Items Section
    this.addItemsSection(doc, order);

    // Totals Section
    this.addTotalsSection(doc, calculations);

    // Footer - Tax & Legal Information
    this.addLegalFooter(doc, businessInfo, calculations);
  }

  /**
   * Add business header with logo and information
   */
  private static addBusinessHeader(doc: PDFKit.PDFDocument, businessInfo: any) {
    // Business Name
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(businessInfo.name, { align: 'center' });

    // Business Address
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(businessInfo.address, { align: 'center' })
      .text(`Tel: ${businessInfo.phone}`, { align: 'center' })
      .text(`Email: ${businessInfo.email}`, { align: 'center' });

    // Registration Information (Lebanese Legal Requirement)
    doc
      .fontSize(8)
      .text(`Reg. No: ${businessInfo.registrationNumber}`, { align: 'center' })
      .text(`Tax ID: ${businessInfo.taxNumber}`, { align: 'center' });

    // Separator Line
    doc.moveDown(0.5).moveTo(10, doc.y).lineTo(216.77, doc.y).stroke();

    doc.moveDown(0.5);
  }

  /**
   * Add receipt information section
   */
  private static addReceiptInfo(doc: PDFKit.PDFDocument, order: any) {
    const receiptDate = format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm:ss');

    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('RECEIPT / فاتورة', { align: 'center' });

    doc.moveDown(0.3);

    // Receipt Details
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Receipt No: ${order.orderNumber || order.id.slice(-8)}`)
      .text(`Date/Time: ${receiptDate}`)
      .text(`Table: ${order.table?.name || order.tableName || 'N/A'}`)
      .text(
        `Server: ${order.user?.firstName || 'N/A'} ${
          order.user?.lastName || ''
        }`
      );

    // Separator Line
    doc.moveDown(0.3).moveTo(10, doc.y).lineTo(216.77, doc.y).stroke();

    doc.moveDown(0.5);
  }

  /**
   * Add items section with proper formatting
   */
  private static addItemsSection(doc: PDFKit.PDFDocument, order: any) {
    doc.fontSize(10).font('Helvetica-Bold').text('ITEMS:', { align: 'left' });

    doc.moveDown(0.2);

    // Column Headers
    doc
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('Item', 10, doc.y, { width: 120, align: 'left' })
      .text('Qty', 130, doc.y, { width: 20, align: 'center' })
      .text('Price', 150, doc.y, { width: 30, align: 'right' })
      .text('Total', 180, doc.y, { width: 36.77, align: 'right' });

    // Separator Line
    doc.moveDown(0.2).moveTo(10, doc.y).lineTo(216.77, doc.y).stroke();

    doc.moveDown(0.2);

    // Group items by menuItemId for PDF invoice
    const groupedItems = new Map<
      string,
      {
        name: string;
        totalQuantity: number;
        unitPrice: number;
        totalPrice: number;
        menuItemId: string;
      }
    >();

    // Group items by menuItemId
    order.items.forEach((item: any) => {
      const menuItemId = item.menuItemId || item.menuItem?.id || 'unknown';
      const name = item.menuItem?.name || 'Unknown Item';
      const qty = item.quantity || 1;
      const unitPrice = item.unitPrice || 0;
      const itemTotalPrice = item.totalPrice || unitPrice * qty;

      if (groupedItems.has(menuItemId)) {
        // Add to existing group
        const existing = groupedItems.get(menuItemId)!;
        existing.totalQuantity += qty;
        existing.totalPrice += itemTotalPrice;
      } else {
        // Create new group
        groupedItems.set(menuItemId, {
          name,
          totalQuantity: qty,
          unitPrice,
          totalPrice: itemTotalPrice,
          menuItemId,
        });
      }
    });

    // Display grouped items (no customizations shown in invoice)
    groupedItems.forEach(groupedItem => {
      // Item name (with wrapping if needed)
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(groupedItem.name, 10, doc.y, { width: 120, align: 'left' })
        .text(groupedItem.totalQuantity.toString(), 130, doc.y, {
          width: 20,
          align: 'center',
        })
        .text(`$${groupedItem.unitPrice.toFixed(2)}`, 150, doc.y, {
          width: 30,
          align: 'right',
        })
        .text(`$${groupedItem.totalPrice.toFixed(2)}`, 180, doc.y, {
          width: 36.77,
          align: 'right',
        });

      doc.moveDown(0.3);
    });

    // Items separator line
    doc.moveTo(10, doc.y).lineTo(216.77, doc.y).stroke();
    doc.moveDown(0.3);
  }

  /**
   * Add totals section with VAT breakdown
   */
  private static addTotalsSection(
    doc: PDFKit.PDFDocument,
    calculations: ReceiptCalculations
  ) {
    doc.fontSize(10).font('Helvetica-Bold').text('TOTALS:', { align: 'left' });

    doc.moveDown(0.2);

    // Subtotal
    doc
      .fontSize(10)
      .font('Helvetica')
      .text('Subtotal:', 120, doc.y, { width: 60, align: 'left' })
      .text(`$${calculations.subtotal.toFixed(2)}`, 180, doc.y, {
        width: 36.77,
        align: 'right',
      });

    doc.moveDown(0.2);

    // VAT
    doc
      .text(`VAT (${(calculations.vatRate * 100).toFixed(0)}%):`, 120, doc.y, {
        width: 60,
        align: 'left',
      })
      .text(`$${calculations.vatAmount.toFixed(2)}`, 180, doc.y, {
        width: 36.77,
        align: 'right',
      });

    doc.moveDown(0.2);

    // Double line before total
    doc.moveTo(120, doc.y).lineTo(216.77, doc.y).stroke();
    doc.moveDown(0.1);
    doc.moveTo(120, doc.y).lineTo(216.77, doc.y).stroke();
    doc.moveDown(0.3);

    // Total
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('TOTAL:', 120, doc.y, { width: 60, align: 'left' })
      .text(`$${calculations.total.toFixed(2)}`, 180, doc.y, {
        width: 36.77,
        align: 'right',
      });

    doc.moveDown(0.5);
  }

  /**
   * Add legal footer with Lebanese tax compliance
   */
  private static addLegalFooter(
    doc: PDFKit.PDFDocument,
    businessInfo: any,
    calculations: ReceiptCalculations
  ) {
    // Lebanese legal requirements
    doc
      .fontSize(8)
      .font('Helvetica')
      .text('Lebanese Republic - Ministry of Finance', { align: 'center' })
      .text(`Tax Registration: ${businessInfo.taxNumber}`, { align: 'center' })
      .text(
        `VAT Amount: $${calculations.vatAmount.toFixed(2)} (${(
          calculations.vatRate * 100
        ).toFixed(0)}%)`,
        { align: 'center' }
      );

    doc.moveDown(0.3);

    // Receipt footer message
    doc
      .fontSize(9)
      .font('Helvetica')
      .text('Thank you for your visit!', { align: 'center' })
      .text('شكراً لزيارتكم', { align: 'center' }); // Arabic: "Thank you for your visit"

    doc.moveDown(0.2);

    // QR Code placeholder (for future implementation)
    doc.fontSize(7).text('Receipt validation QR code would appear here', {
      align: 'center',
    });

    doc.moveDown(0.3);

    // Timestamp
    doc
      .fontSize(7)
      .text(`Generated: ${getCurrentLocalDateTime()}`, { align: 'center' });
  }

  /**
   * Calculate totals with Lebanese VAT
   * ✅ FIX: Calculate from items instead of trusting database
   */
  private static calculateTotals(order: any): ReceiptCalculations {
    // ✅ Calculate subtotal from items instead of using stale DB value
    let calculatedSubtotal = 0;

    // Sum all item totals (item.totalPrice already includes addon prices)
    order.items?.forEach((item: any) => {
      const itemTotal = Number(item.totalPrice) || 0;
      calculatedSubtotal += itemTotal;
    });

    const subtotal = calculatedSubtotal;
    const deliveryFee = Number(order.deliveryFee) || 0;
    const vatRate = this.VAT_RATE;
    const vatAmount = subtotal * vatRate;
    const total = subtotal + deliveryFee + vatAmount;

    return {
      subtotal,
      vatAmount,
      total,
      vatRate,
    };
  }

  /**
   * Get default Lebanese business information
   */
  static getDefaultBusinessInfo() {
    return {
      name: 'MR5 Restaurant',
      address: 'Beirut, Lebanon',
      phone: '+961 1 123456',
      email: 'info@mr5restaurant.com',
      registrationNumber: '123456789',
      taxNumber: 'LB-123456789',
    };
  }

  /**
   * Generate receipt for thermal printer (proper 80mm width)
   * Updated to match the requested invoice design
   */
  static generateThermalReceipt(receiptData: ReceiptData): string {
    const { order, businessInfo } = receiptData;
    const calculations = this.calculateTotals(order);

    let receipt = '';
    const LINE_WIDTH = 32; // Standard thermal printer width

    // Helper function to center text
    const centerText = (text: string): string => {
      const padding = Math.max(0, Math.floor((LINE_WIDTH - text.length) / 2));
      return ' '.repeat(padding) + text;
    };

    // Helper function to format table row
    const formatTableRow = (
      item: string,
      qty: string,
      unitPrice: string,
      total: string
    ): string => {
      // Adjust column widths for 32-character thermal printer
      const itemWidth = 12;
      const qtyWidth = 3;
      const priceWidth = 6;
      const totalWidth = 8;

      const truncatedItem =
        item.length > itemWidth ? item.substring(0, itemWidth - 1) : item;
      const paddedItem = truncatedItem.padEnd(itemWidth);
      const paddedQty = qty.padStart(qtyWidth);
      const paddedPrice = unitPrice.padStart(priceWidth);
      const paddedTotal = total.padStart(totalWidth);

      return `${paddedItem}${paddedQty}${paddedPrice}${paddedTotal}`;
    };

    // Header
    receipt += centerText('Invoice') + '\n';
    receipt += '\n';

    // Invoice details
    const invoiceNumber = order.orderNumber || order.id.slice(-12);
    receipt += `Inv #  ${invoiceNumber}\n`;

    // Format date like in the image: "Jun 25, 2025, 3:02 PM"
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
    receipt += `Date   ${formattedDate}\n`;
    receipt += '\n';

    // Table header
    receipt += '-'.repeat(LINE_WIDTH) + '\n';
    receipt += formatTableRow('Item', 'Qty', 'U.P', 'Total($)') + '\n';
    receipt += '-'.repeat(LINE_WIDTH) + '\n';

    // Items
    let totalQuantity = 0;
    order.items.forEach((item: any) => {
      const name = item.menuItem?.name || 'Unknown Item';
      const qty = item.quantity || 1;
      const unitPrice = item.unitPrice || item.totalPrice / qty || 0;
      const totalPrice = item.totalPrice || 0;

      totalQuantity += qty;

      receipt +=
        formatTableRow(
          name,
          qty.toString(),
          unitPrice.toFixed(1),
          totalPrice.toFixed(1)
        ) + '\n';
    });

    receipt += '-'.repeat(LINE_WIDTH) + '\n';

    // Totals section
    receipt += `Total Quantity${' '.repeat(LINE_WIDTH - 14 - totalQuantity.toString().length)}${totalQuantity}$\n`;
    receipt += `Total Invoice${' '.repeat(LINE_WIDTH - 13 - calculations.total.toFixed(1).length)}${calculations.total.toFixed(1)}$\n`;
    receipt += `Net to pay${' '.repeat(LINE_WIDTH - 10 - calculations.total.toFixed(1).length)}${calculations.total.toFixed(1)}$\n`;

    receipt += '\n';
    receipt += '-'.repeat(LINE_WIDTH) + '\n';
    receipt += centerText('Powered by') + '\n';
    receipt += centerText('THE ELITES SOLUTIONS') + '\n';

    return receipt;
  }

  /**
   * Generate a kitchen ticket text for thermal printers (fallback plain text version)
   * With improved formatting per latest requirements
   */
  static generateKitchenTicket(receiptData: ReceiptData): string {
    const { order } = receiptData;

    // Full width separator for standard thermal printer
    const LINE_WIDTH = 80;
    const SEPARATOR = '-'.repeat(LINE_WIDTH);

    // Get current date and time for the header
    const currentDate = new Date();
    const dateString = currentDate.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    });
    const timeString = currentDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    // Get table information
    const tableLabel =
      (order as any).table?.name ||
      (order as any).table?.number ||
      order.tableId ||
      'N/A';

    // Start building ticket content
    const lines: string[] = [];

    // Add spacing at top for better readability
    lines.push('');
    lines.push('');

    // Date and Time on same line with Date at start and Time at end
    // In plain text, use uppercase for bold labels
    const dateTimeSpacing = 35; // Spacing between Date and Time
    lines.push(
      `DATE ${dateString}${' '.repeat(dateTimeSpacing)}TIME ${timeString}`
    );
    lines.push('');

    // Table label and value with bold label
    lines.push(tableLabel);
    lines.push('TABLE');
    lines.push('');

    // Separator line - full width
    lines.push(SEPARATOR);

    // Column headers with quantity moved to the far right
    lines.push(`Item Description${' '.repeat(50)}Quantity`);

    // Separator under headers - full width
    lines.push(SEPARATOR);
    lines.push('');

    // List items with improved formatting for better readability
    order.items.forEach((item: any, index: number) => {
      const name = (item.menuItem?.name || item.name || 'Item').toLowerCase();
      // Format quantity to match the example (3 decimal places)
      const qty = item.quantity ? Number(item.quantity).toFixed(3) : '1.000';

      // Size information formatting
      const size = item.size ? ` - ${item.size}` : '';

      // Format item with quantity pushed to the far right
      const itemText = `${name}${size}`;
      const paddedItem = itemText.padEnd(65, ' '); // More padding to push quantity to far right

      // Item and quantity in proper format
      lines.push(`${paddedItem}${qty}`);

      // Special instructions with improved formatting
      if (item.notes || item.specialInstructions) {
        const notes = (item.notes || item.specialInstructions).toLowerCase();
        lines.push(`Notes:${notes}`);
        lines.push('');
      }

      // Add spacing between items for better readability
      lines.push('');

      // Add separator between items if not the last item
      if (index < order.items.length - 1) {
        lines.push(SEPARATOR);
        lines.push('');
      }
    });

    // Final separator - full width
    lines.push(SEPARATOR);

    // Add spacing at bottom for better readability
    lines.push('');
    lines.push('');

    return lines.join('\n');
  }

  private static centerText(text: string, width: number): string {
    const padding = 0;
    return ' '.repeat(padding) + text;
  }
}
