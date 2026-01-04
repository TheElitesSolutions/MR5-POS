/**
 * Enhanced Kitchen Ticket Generator - Optimized for Maximum Readability
 *
 * Based on 2024 restaurant industry research and best practices:
 * - Larger font sizes for better visibility in busy kitchens
 * - Clean, minimalist design without decorative elements
 * - Clear visual hierarchy with strategic font weights
 * - Consistent layout that's easy to scan quickly
 * - Professional appearance suitable for commercial kitchens
 *
 * Key Features:
 * - 18px font for item names (maximum readability)
 * - 16px font for critical information (order numbers, quantities)
 * - 14px font for secondary information
 * - Clean separators without decorative characters
 * - Optimized spacing for thermal printers
 * - Full item name display (no truncation)
 */

/**
 * Generate an enhanced kitchen ticket optimized for readability
 * @param order - The order to print
 * @param onlyUnprinted - Only include items that haven't been printed yet
 * @param cancelledItems - Optional array of cancelled items
 * @param updatedItemIds - Optional array of updated item IDs
 * @param changeDetails - Optional array with net change information
 * @returns JSON string representation of the print data
 */
export async function generateEnhancedKitchenTicket(
  order: any,
  onlyUnprinted: boolean = false,
  cancelledItems: any[] = [],
  updatedItemIds: string[] = [],
  changeDetails: any[] = []
): Promise<string> {
  console.log('🎯🎯🎯 ENHANCED KITCHEN TICKET GENERATOR FUNCTION CALLED 🎯🎯🎯');
  console.log('🎯 ENHANCED KITCHEN TICKET GENERATOR:', {
    orderId: order?.id,
    orderNumber: order?.orderNumber,
    hasCancelledItems: cancelledItems?.length > 0,
    hasUpdatedItems: updatedItemIds?.length > 0,
    hasChangeDetails: changeDetails?.length > 0,
    totalOrderItems: order?.items?.length || 0,
  });

  // ✨ DETAILED DEBUG: Show actual parameters received
  console.log('📋 DETAILED PARAMETERS:', {
    cancelledItemsCount: cancelledItems?.length || 0,
    cancelledItems: cancelledItems,
    updatedItemIdsCount: updatedItemIds?.length || 0,
    updatedItemIds: updatedItemIds,
    changeDetailsCount: changeDetails?.length || 0,
    changeDetails: changeDetails,
    onlyUnprinted: onlyUnprinted,
  });

  //  ℹ️ ANALYSIS: Determine if this should be STANDARD or UPDATE ticket
  const orderItems = order?.items || [];
  const newItemsInOrder = orderItems.filter((item: any) => {
    // An item is "new" if it wasn't previously printed (no printedAt timestamp)
    return !item.printedAt;
  });

  console.log('🔍 ORDER ANALYSIS:', {
    totalItems: orderItems.length,
    newItems: newItemsInOrder.length,
    newItemIds: newItemsInOrder.map((i: any) => i.id),
    updatedItemIdsProvided: updatedItemIds,
    shouldBeStandard: newItemsInOrder.length === orderItems.length && orderItems.length > 0,
  });

  // Route to appropriate ticket generator based on content
  if (cancelledItems && cancelledItems.length > 0) {
    console.log('🎯 Routing to: generateEnhancedRemovalTicket (cancelled items)');
    return generateEnhancedRemovalTicket(order, cancelledItems);
  } else if (updatedItemIds && updatedItemIds.length > 0) {
    console.log('🎯 Routing to: generateEnhancedUpdateTicket (updated items)');
    return generateEnhancedUpdateTicket(
      order,
      onlyUnprinted,
      updatedItemIds,
      changeDetails
    );
  } else {
    console.log('🎯 Routing to: generateEnhancedStandardTicket (standard ticket)');
    return generateEnhancedStandardTicket(order, onlyUnprinted);
  }
}

/**
 * Parse notes field to extract customizations and regular notes
 * Format: "remove: ingredient1 - ingredient2" for removed ingredients
 * Format: "customization1, customization2" for other customizations
 */
function parseNotesForCustomizations(notes: string): {
  regularNotes: string;
  removedIngredients: string[];
  otherCustomizations: string[];
} {
  if (!notes || typeof notes !== 'string') {
    return {
      regularNotes: '',
      removedIngredients: [],
      otherCustomizations: [],
    };
  }

  const lines = notes
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  let regularNotes: string[] = [];
  let removedIngredients: string[] = [];
  let otherCustomizations: string[] = [];

  lines.forEach(line => {
    // Check for removed ingredients: "remove: ingredient1 - ingredient2"
    if (line.toLowerCase().startsWith('remove:')) {
      const ingredients = line.substring(7).trim(); // Remove "remove:" prefix
      if (ingredients) {
        // Split by " - " and clean up each ingredient
        const ingredientList = ingredients
          .split(' - ')
          .map(ing => ing.trim())
          .filter(ing => ing.length > 0);
        removedIngredients.push(...ingredientList);
      }
    }
    // Check if line contains customizations (comma-separated without "remove:")
    else if (
      line.includes(',') &&
      !line.toLowerCase().includes('note') &&
      !line.toLowerCase().includes('instruction')
    ) {
      // Treat as customizations
      const customizations = line
        .split(',')
        .map(c => c.trim())
        .filter(c => c.length > 0);
      otherCustomizations.push(...customizations);
    }
    // Otherwise treat as regular notes
    else {
      regularNotes.push(line);
    }
  });

  return {
    regularNotes: regularNotes.join(' ').trim(),
    removedIngredients,
    otherCustomizations,
  };
}

/**
 * Generate enhanced standard ticket with optimal readability
 */
function generateEnhancedStandardTicket(
  order: any,
  onlyUnprinted: boolean
): string {
  const printData = [];
  let itemsToProcess = order?.items || [];

  // Apply unprinted filter if requested
  if (onlyUnprinted) {
    itemsToProcess = itemsToProcess.filter(
      (item: any) => item.printed !== true
    );
  }

  // ✅ FIX: Filter out items marked as not printable in kitchen
  console.log('========================================');
  console.log('🔍 [FILTERING] Starting kitchen ticket filtering process');
  console.log(`🔍 [FILTERING] Total items BEFORE filter: ${itemsToProcess.length}`);
  console.log('========================================');

  // Log all items BEFORE filtering
  console.log('📋 [FILTERING] Items BEFORE filtering:');
  itemsToProcess.forEach((item: any, index: number) => {
    const isPrintableValue = item.menuItem?.isPrintableInKitchen !== undefined
      ? item.menuItem.isPrintableInKitchen
      : item.isPrintableInKitchen;
    console.log(`  ${index + 1}. "${item.menuItem?.name || item.name}" - isPrintableInKitchen: ${isPrintableValue} (${isPrintableValue === 1 || isPrintableValue === true ? '✅ PRINTABLE' : '❌ NOT PRINTABLE'})`);
  });

  // Track filtered items for logging
  const filteredOutItems: any[] = [];
  const keptItems: any[] = [];

  // Apply filtering
  itemsToProcess = itemsToProcess.filter((item: any) => {
    const isPrintable = isItemPrintable(item);

    if (isPrintable) {
      keptItems.push(item);
    } else {
      filteredOutItems.push(item);
    }

    return isPrintable;
  });

  // Log filtering results
  console.log('========================================');
  console.log('🎯 [FILTERING] Filtering Results:');
  console.log(`✅ Items KEPT (printable): ${keptItems.length}`);
  keptItems.forEach((item: any, index: number) => {
    console.log(`  ${index + 1}. "${item.menuItem?.name || item.name}" - Will be printed`);
  });

  console.log(`❌ Items FILTERED OUT (not printable): ${filteredOutItems.length}`);
  filteredOutItems.forEach((item: any, index: number) => {
    console.log(`  ${index + 1}. "${item.menuItem?.name || item.name}" - EXCLUDED from kitchen ticket`);
  });

  console.log(`🔍 [FILTERING] Total items AFTER filter: ${itemsToProcess.length}`);
  console.log('========================================');

  // ✅ FIX: If all items are filtered out, don't print an empty ticket
  if (itemsToProcess.length === 0) {
    console.log('🚫 [FILTERING] ALL items are unprintable - Skipping kitchen ticket printing');
    console.log('========================================');
    return JSON.stringify([]); // Return empty array - will cause print to be skipped
  }

  // Generate clean header
  const currentDate = new Date();
  const dateString = currentDate.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
  const timeString = currentDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Clean header section - no decorative elements
  printData.push(
    {
      type: 'text',
      value: '',
      style: { fontSize: '14px' }, // Add top spacing
    },
    {
      type: 'text',
      value: 'KITCHEN ORDER',
      style: {
        fontSize: '20px',
        fontFamily: 'monospace',
        textAlign: 'center',
        fontWeight: 'bold',
      },
    },
    {
      type: 'text',
      value: '_'.repeat(42), // Clean separator line
      style: { fontSize: '14px', fontFamily: 'monospace', textAlign: 'center' },
    },
    {
      type: 'text',
      value: '',
      style: { fontSize: '10px' }, // Spacing
    }
  );

  // Order information - clear and prominent
  printData.push(
    {
      type: 'text',
      value: `ORDER #${order?.orderNumber || 'N/A'}`,
      style: {
        fontSize: '18px',
        fontFamily: 'monospace',
        textAlign: 'center',
        fontWeight: 'bold',
      },
    },
    {
      type: 'text',
      value: `${dateString} at ${timeString}`,
      style: {
        fontSize: '14px',
        fontFamily: 'monospace',
        textAlign: 'center',
      },
    }
  );

  // Order type and location - clean formatting
  const orderType = order?.type || 'DINE_IN';
  const orderTypeDisplay = getOrderTypeDisplay(orderType);

  printData.push({
    type: 'text',
    value: `${orderTypeDisplay}`,
    style: {
      fontSize: '16px',
      fontFamily: 'monospace',
      textAlign: 'center',
      fontWeight: 'bold',
    },
  });

  // Location information
  if (orderType === 'DINE_IN') {
    const tableName = order?.table?.name || order?.tableName || 'N/A';
    printData.push({
      type: 'text',
      value: `Table: ${tableName}`,
      style: {
        fontSize: '16px',
        fontFamily: 'monospace',
        textAlign: 'center',
        fontWeight: 'bold',
      },
    });
  } else if (orderType === 'TAKEOUT') {
    // Takeaway customer info
    printData.push({
      type: 'text',
      value: `Customer: ${order?.customerName || 'N/A'}`,
      style: {
        fontSize: '16px',
        fontFamily: 'monospace',
        textAlign: 'center',
        fontWeight: 'bold',
      },
    });
    if (order?.customerPhone) {
      printData.push({
        type: 'text',
        value: `Phone: ${order.customerPhone}`,
        style: {
          fontSize: '14px',
          fontFamily: 'monospace',
          textAlign: 'center',
        },
      });
    }
  } else if (orderType === 'DELIVERY') {
    // Delivery customer info - concise format
    printData.push(
      {
        type: 'text',
        value: '',
        style: { fontSize: '10px' }, // Spacing
      },
      {
        type: 'text',
        value: 'DELIVERY INFO',
        style: {
          fontSize: '14px',
          fontFamily: 'monospace',
          textAlign: 'center',
          fontWeight: 'bold',
        },
      },
      {
        type: 'text',
        value: `${order?.customerName || 'N/A'}`,
        style: {
          fontSize: '14px',
          fontFamily: 'monospace',
          textAlign: 'center',
        },
      },
      {
        type: 'text',
        value: `${order?.customerPhone || 'N/A'}`,
        style: {
          fontSize: '14px',
          fontFamily: 'monospace',
          textAlign: 'center',
        },
      }
    );
  }

  // Items section separator
  printData.push(
    {
      type: 'text',
      value: '',
      style: { fontSize: '12px' }, // Spacing
    },
    {
      type: 'text',
      value: '_'.repeat(42),
      style: { fontSize: '14px', fontFamily: 'monospace', textAlign: 'center' },
    },
    {
      type: 'text',
      value: '',
      style: { fontSize: '10px' }, // Spacing
    }
  );

  // Filter items to only include those that should be printed in kitchen
  const printableItems = itemsToProcess.filter(isItemPrintable);

  // Process items with enhanced readability
  if (printableItems.length === 0) {
    printData.push({
      type: 'text',
      value: 'No items to display',
      style: {
        fontSize: '16px',
        fontFamily: 'monospace',
        textAlign: 'center',
        fontStyle: 'italic',
      },
    });
  } else {
    printableItems.forEach((item: any, index: number) => {
      const itemName = getItemName(item);
      const quantity = item.quantity || 0;

      // Add spacing between items (except first)
      if (index > 0) {
        printData.push({
          type: 'text',
          value: '',
          style: { fontSize: '16px' },
        });
      }

      // Item display - quantity first, then name (easier to scan)
      printData.push({
        type: 'text',
        value: `${quantity}x  ${itemName}`,
        style: {
          fontSize: '18px', // Large font for maximum readability
          fontFamily: 'monospace',
          fontWeight: 'bold',
        },
      });

      // Display add-ons if present (CRITICAL FOR KITCHEN)
      // Filter to only show printable addons
      const printableAddons = filterPrintableAddons(item.addons);

      if (printableAddons.length > 0) {
        // Add small spacing before add-ons
        printData.push({
          type: 'text',
          value: '',
          style: { fontSize: '8px' },
        });

        printableAddons.forEach((addon: any) => {
          const addonName = addon.addonName || addon.addon?.name || 'Addon';
          const perItemQty = addon.quantity || 1;
          // ✅ FIX: Show total addon quantity (per-item qty × item qty)
          const totalAddonQty = perItemQty * quantity;

          printData.push({
            type: 'text',
            value: `       + ${totalAddonQty}x ${addonName}`,
            style: {
              fontSize: '16px',
              fontFamily: 'Arial, sans-serif',
              fontWeight: 'bold',
              fontStyle: 'italic',
            },
          });
        });
      }

      // Parse notes to extract customizations and regular notes
      if (item.notes) {
        const { regularNotes, removedIngredients, otherCustomizations } =
          parseNotesForCustomizations(item.notes);

        // Add small spacing before customizations
        printData.push({
          type: 'text',
          value: '',
          style: { fontSize: '10px' },
        });

        // Display regular notes (non-customization text)
        if (regularNotes) {
          printData.push({
            type: 'text',
            value: `       Note: ${regularNotes}`,
            style: {
              fontSize: '18px',
              fontFamily: 'Arial, sans-serif',
              fontStyle: 'italic',
            },
          });
        }

        // Display removed ingredients
        if (removedIngredients.length > 0) {
          printData.push({
            type: 'text',
            value: `       Remove: ${removedIngredients.join(', ')}`,
            style: {
              fontSize: '18px',
              fontFamily: 'Arial, sans-serif',
              fontWeight: 'bold',
            },
          });
        }

        // Display other customizations
        otherCustomizations.forEach((customization: string) => {
          printData.push({
            type: 'text',
            value: `       Add: ${customization}`,
            style: {
              fontSize: '18px',
              fontFamily: 'Arial, sans-serif',
              fontWeight: 'bold',
            },
          });
        });
      }

      // Handle legacy customizations array (if any)
      if (item.customizations && Array.isArray(item.customizations)) {
        item.customizations.forEach((customization: any) => {
          printData.push({
            type: 'text',
            value: `     ➕ ${customization.name || customization}`,
            style: {
              fontSize: '14px',
              fontFamily: 'monospace',
              fontWeight: 'bold',
            },
          });
        });
      }
    });
  }

  // Footer - clean and professional
  printData.push(
    {
      type: 'text',
      value: '',
      style: { fontSize: '12px' },
    },
    {
      type: 'text',
      value: '_'.repeat(42),
      style: { fontSize: '14px', fontFamily: 'monospace', textAlign: 'center' },
    },
    {
      type: 'text',
      value: `Printed: ${timeString}`,
      style: {
        fontSize: '12px',
        fontFamily: 'monospace',
        textAlign: 'center',
      },
    },
    {
      type: 'text',
      value: '',
      style: { fontSize: '16px' }, // Bottom spacing for easy tearing
    }
  );

  console.log(
    `✅ ENHANCED STANDARD TICKET: ${printableItems.length} printable items (${itemsToProcess.length} total items)`
  );
  return JSON.stringify(printData);
}

/**
 * Generate enhanced removal ticket
 */
function generateEnhancedRemovalTicket(
  order: any,
  cancelledItems: any[]
): string {
  const printData = [];
  const currentDate = new Date();
  const timeString = currentDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Header for removal ticket
  printData.push(
    {
      type: 'text',
      value: '',
      style: { fontSize: '14px' },
    },
    {
      type: 'text',
      value: 'REMOVE ITEMS',
      style: {
        fontSize: '20px',
        fontFamily: 'monospace',
        textAlign: 'center',
        fontWeight: 'bold',
      },
    },
    {
      type: 'text',
      value: '_'.repeat(42),
      style: { fontSize: '14px', fontFamily: 'monospace', textAlign: 'center' },
    },
    {
      type: 'text',
      value: '',
      style: { fontSize: '10px' },
    },
    {
      type: 'text',
      value: `ORDER #${order?.orderNumber || 'N/A'}`,
      style: {
        fontSize: '18px',
        fontFamily: 'monospace',
        textAlign: 'center',
        fontWeight: 'bold',
      },
    },
    {
      type: 'text',
      value: order?.type === 'DINE_IN'
        ? `Table: ${order?.table?.name || order?.tableName || 'N/A'}`
        : `Customer: ${order?.customerName || 'N/A'}`,
      style: {
        fontSize: '16px',
        fontFamily: 'monospace',
        textAlign: 'center',
      },
    },
    {
      type: 'text',
      value: '',
      style: { fontSize: '12px' },
    },
    {
      type: 'text',
      value: '_'.repeat(42),
      style: { fontSize: '14px', fontFamily: 'monospace', textAlign: 'center' },
    },
    {
      type: 'text',
      value: '',
      style: { fontSize: '10px' },
    }
  );

  // Filter cancelled items to only include those that should be printed in kitchen
  const printableCancelledItems = cancelledItems.filter(isItemPrintable);

  console.log('========================================');
  console.log('🔍 [REMOVAL TICKET FILTERING] Starting filtering for cancelled items');
  console.log(`🔍 [REMOVAL TICKET FILTERING] Cancelled items count: ${cancelledItems.length}`);
  console.log(`✅ Printable cancelled items: ${printableCancelledItems.length}`);
  console.log(`❌ Unprintable cancelled items: ${cancelledItems.length - printableCancelledItems.length}`);
  console.log('========================================');

  // ✅ FIX: If all cancelled items are unprintable, don't print an empty removal ticket
  if (printableCancelledItems.length === 0) {
    console.log('🚫 [REMOVAL TICKET FILTERING] ALL cancelled items are unprintable - Skipping removal ticket printing');
    console.log('========================================');
    return JSON.stringify([]); // Return empty array - will cause print to be skipped
  }

  // Process removed items
  printableCancelledItems.forEach((item: any, index: number) => {
    const itemName = getItemName(item);
    const quantity = item.quantity ? parseInt(item.quantity) : 1;

    if (index > 0) {
      printData.push({
        type: 'text',
        value: '',
        style: { fontSize: '8px' },
      });
    }

    printData.push({
      type: 'text',
      value: `REMOVE: ${quantity}x  ${itemName}`,
      style: {
        fontSize: '18px',
        fontFamily: 'monospace',
        fontWeight: 'bold',
      },
    });

    // Display add-ons for the item being removed
    // Filter to only show printable addons
    const printableAddons = filterPrintableAddons(item.addons);

    if (printableAddons.length > 0) {
      printData.push({
        type: 'text',
        value: '',
        style: { fontSize: '8px' },
      });

      printableAddons.forEach((addon: any) => {
        const addonName = addon.addonName || addon.addon?.name || 'Addon';
        const perItemQty = addon.quantity || 1;
        // ✅ FIX: Show total addon quantity (per-item qty × item qty)
        const totalAddonQty = perItemQty * quantity;

        printData.push({
          type: 'text',
          value: `       + ${totalAddonQty}x ${addonName}`,
          style: {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fontStyle: 'italic',
          },
        });
      });
    }

    // Show customizations for the item being removed
    if (item.notes) {
      const { regularNotes, removedIngredients, otherCustomizations } =
        parseNotesForCustomizations(item.notes);

      if (regularNotes) {
        printData.push({
          type: 'text',
          value: `       Note: ${regularNotes}`,
          style: {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'italic',
          },
        });
      }

      if (removedIngredients.length > 0) {
        printData.push({
          type: 'text',
          value: `       Remove: ${removedIngredients.join(', ')}`,
          style: {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
          },
        });
      }

      otherCustomizations.forEach((customization: string) => {
        printData.push({
          type: 'text',
          value: `       Add: ${customization}`,
          style: {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
          },
        });
      });
    }
  });

  // Footer
  printData.push(
    {
      type: 'text',
      value: '',
      style: { fontSize: '12px' },
    },
    {
      type: 'text',
      value: '_'.repeat(42),
      style: { fontSize: '14px', fontFamily: 'monospace', textAlign: 'center' },
    },
    {
      type: 'text',
      value: `Printed: ${timeString}`,
      style: {
        fontSize: '12px',
        fontFamily: 'monospace',
        textAlign: 'center',
      },
    },
    {
      type: 'text',
      value: '',
      style: { fontSize: '16px' },
    }
  );

  return JSON.stringify(printData);
}

/**
 * Generate enhanced update ticket
 */
function generateEnhancedUpdateTicket(
  order: any,
  onlyUnprinted: boolean,
  updatedItemIds: string[],
  changeDetails: any[]
): string {
  const printData = [];
  const currentDate = new Date();
  const timeString = currentDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Header for update ticket
  printData.push(
    {
      type: 'text',
      value: '',
      style: { fontSize: '14px' },
    },
    {
      type: 'text',
      value: 'ORDER UPDATE',
      style: {
        fontSize: '20px',
        fontFamily: 'monospace',
        textAlign: 'center',
        fontWeight: 'bold',
      },
    },
    {
      type: 'text',
      value: '_'.repeat(42),
      style: { fontSize: '14px', fontFamily: 'monospace', textAlign: 'center' },
    },
    {
      type: 'text',
      value: '',
      style: { fontSize: '10px' },
    },
    {
      type: 'text',
      value: `ORDER #${order?.orderNumber || 'N/A'}`,
      style: {
        fontSize: '18px',
        fontFamily: 'monospace',
        textAlign: 'center',
        fontWeight: 'bold',
      },
    },
    {
      type: 'text',
      value: order?.type === 'DINE_IN'
        ? `Table: ${order?.table?.name || order?.tableName || 'N/A'}`
        : `Customer: ${order?.customerName || 'N/A'}`,
      style: {
        fontSize: '16px',
        fontFamily: 'monospace',
        textAlign: 'center',
      },
    },
    {
      type: 'text',
      value: '',
      style: { fontSize: '12px' },
    },
    {
      type: 'text',
      value: '_'.repeat(42),
      style: { fontSize: '14px', fontFamily: 'monospace', textAlign: 'center' },
    },
    {
      type: 'text',
      value: '',
      style: { fontSize: '10px' },
    }
  );

  // Process updated items
  const itemsToProcess =
    order?.items?.filter((item: any) => updatedItemIds.includes(item.id)) || [];

  console.log('========================================');
  console.log('🔍 [UPDATE TICKET FILTERING] Starting filtering for updated items');
  console.log(`🔍 [UPDATE TICKET FILTERING] Updated items count: ${itemsToProcess.length}`);
  console.log('========================================');

  // Filter updated items to only include those that should be printed in kitchen
  const printableUpdatedItems = itemsToProcess.filter(isItemPrintable);

  console.log('========================================');
  console.log('🎯 [UPDATE TICKET FILTERING] Filtering Results:');
  console.log(`✅ Printable updated items: ${printableUpdatedItems.length}`);
  console.log(`❌ Unprintable updated items: ${itemsToProcess.length - printableUpdatedItems.length}`);
  console.log('========================================');

  // ✅ FIX: If all updated items are filtered out, don't print an empty update ticket
  if (printableUpdatedItems.length === 0) {
    console.log('🚫 [UPDATE TICKET FILTERING] ALL updated items are unprintable - Skipping update ticket printing');
    console.log('========================================');
    return JSON.stringify([]); // Return empty array - will cause print to be skipped
  }

  printableUpdatedItems.forEach((item: any, index: number) => {
    const itemName = getItemName(item);
    const quantity = item.quantity || 0;
    const change = changeDetails.find(
      c => c.itemId === item.id || c.id === item.id
    );

    if (index > 0) {
      printData.push({
        type: 'text',
        value: '',
        style: { fontSize: '8px' },
      });
    }

    // Format change display
    // For UPDATE tickets, show the CHANGE amount (what to add/remove), not total quantity
    let changeDisplay = `${quantity}x  ${itemName}`;
    if (change && change.netChange !== undefined) {
      const operator = change.netChange > 0 ? '+' : '';
      const action = change.netChange > 0 ? 'ADD' : 'REDUCE';
      changeDisplay = `${action}: ${itemName}  ${operator}${change.netChange}`;
    }

    printData.push({
      type: 'text',
      value: changeDisplay,
      style: {
        fontSize: '18px',
        fontFamily: 'monospace',
        fontWeight: 'bold',
      },
    });

    // Display add-ons for the updated item
    // Filter to only show printable addons
    const printableAddons = filterPrintableAddons(item.addons);

    if (printableAddons.length > 0) {
      printData.push({
        type: 'text',
        value: '',
        style: { fontSize: '8px' },
      });

      printableAddons.forEach((addon: any) => {
        const addonName = addon.addonName || addon.addon?.name || 'Addon';
        const perItemQty = addon.quantity || 1;
        // ✅ FIX: For UPDATE tickets, show addon change quantity (per-item qty × netChange)
        // Not total quantity - kitchen needs to know how many addons to ADD/REDUCE
        const addonChangeQty = perItemQty * (change?.netChange || quantity);

        printData.push({
          type: 'text',
          value: `       + ${addonChangeQty}x ${addonName}`,
          style: {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fontStyle: 'italic',
          },
        });
      });
    }

    // Show customizations for the updated item
    if (item.notes) {
      const { regularNotes, removedIngredients, otherCustomizations } =
        parseNotesForCustomizations(item.notes);

      if (regularNotes) {
        printData.push({
          type: 'text',
          value: `       Note: ${regularNotes}`,
          style: {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'italic',
          },
        });
      }

      if (removedIngredients.length > 0) {
        printData.push({
          type: 'text',
          value: `       Remove: ${removedIngredients.join(', ')}`,
          style: {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
          },
        });
      }

      otherCustomizations.forEach((customization: string) => {
        printData.push({
          type: 'text',
          value: `       Add: ${customization}`,
          style: {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
          },
        });
      });
    }
  });

  // Footer
  printData.push(
    {
      type: 'text',
      value: '',
      style: { fontSize: '12px' },
    },
    {
      type: 'text',
      value: '_'.repeat(42),
      style: { fontSize: '14px', fontFamily: 'monospace', textAlign: 'center' },
    },
    {
      type: 'text',
      value: `Printed: ${timeString}`,
      style: {
        fontSize: '12px',
        fontFamily: 'monospace',
        textAlign: 'center',
      },
    },
    {
      type: 'text',
      value: '',
      style: { fontSize: '16px' },
    }
  );

  return JSON.stringify(printData);
}

/**
 * Helper functions
 */
function getOrderTypeDisplay(orderType: string): string {
  switch (orderType) {
    case 'DINE_IN':
      return 'DINE IN';
    case 'TAKEOUT':
      return 'TAKEOUT';
    case 'DELIVERY':
      return 'DELIVERY';
    default:
      return 'DINE IN';
  }
}

function getItemName(item: any): string {
  return (
    item.menuItem?.name ||
    item.name ||
    item.menuItemName ||
    `Item ${item.menuItemId?.slice(-4) || 'Unknown'}`
  );
}

/**
 * Check if an item should be printed in kitchen tickets
 * Returns true if isPrintableInKitchen is true or undefined (backward compatibility)
 */
function isItemPrintable(item: any): boolean {
  console.log('🔍 [isItemPrintable] Checking item:', {
    itemId: item.id,
    menuItemId: item.menuItemId,
    'item.menuItem?.isPrintableInKitchen': item.menuItem?.isPrintableInKitchen,
    'item.isPrintableInKitchen': item.isPrintableInKitchen,
    'item.menuItem (keys)': item.menuItem ? Object.keys(item.menuItem) : 'no menuItem',
  });

  // Check item.menuItem.isPrintableInKitchen first (joined data)
  if (item.menuItem?.isPrintableInKitchen !== undefined) {
    const result = item.menuItem.isPrintableInKitchen === true || item.menuItem.isPrintableInKitchen === 1;
    console.log('✅ [isItemPrintable] Using item.menuItem.isPrintableInKitchen:', result);
    return result;
  }
  // Check item.isPrintableInKitchen (direct property)
  if (item.isPrintableInKitchen !== undefined) {
    const result = item.isPrintableInKitchen === true || item.isPrintableInKitchen === 1;
    console.log('✅ [isItemPrintable] Using item.isPrintableInKitchen:', result);
    return result;
  }
  // Default to true for backward compatibility (existing items without this field)
  console.log('⚠️ [isItemPrintable] No isPrintableInKitchen found, defaulting to true');
  return true;
}

/**
 * Filter addons - addons always follow the parent menu item's printability
 * If the item is printable, all its addons are printed with it
 */
function filterPrintableAddons(addons: any[]): any[] {
  if (!addons || !Array.isArray(addons)) {
    return [];
  }
  // ✅ FIX: Addons always follow the parent item - no separate filtering needed
  // If the item is printable, all addons are included
  console.log('🔍 [filterPrintableAddons] Returning all addons (follow parent item), count:', addons.length);
  return addons;
}
