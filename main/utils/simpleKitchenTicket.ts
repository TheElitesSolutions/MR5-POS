/**
 * SimpleKitchenTicket - SIMPLIFIED approach with NET CHANGE support
 * Focuses on core functionality: new items, net changes, and removals
 *
 * Key Features:
 * - Simple removal tickets with clear formatting
 * - Net change display (+X/-X quantities)
 * - Standard order printing with unprinted filtering
 * - Clear, readable kitchen instructions
 */

/**
 * Generate a simple, clean kitchen ticket format with NET CHANGE support
 * SIMPLIFIED: One function handles all cases with clear logic
 * @param order - The order to print
 * @param onlyUnprinted - Only include items that haven't been printed yet
 * @param cancelledItems - Optional array of cancelled items
 * @param updatedItemIds - Optional array of updated item IDs
 * @param changeDetails - Optional array with net change information (+X/-X)
 * @returns JSON string representation of the print data
 */
export async function generateSimpleKitchenTicket(
  order: any,
  onlyUnprinted: boolean = false,
  cancelledItems: any[] = [],
  updatedItemIds: string[] = [],
  changeDetails: any[] = []
): Promise<string> {
  console.log('🚀 SIMPLIFIED KITCHEN TICKET GENERATOR:', {
    orderId: order?.id,
    orderNumber: order?.orderNumber,
    hasCancelledItems: cancelledItems?.length > 0,
    hasUpdatedItems: updatedItemIds?.length > 0,
    hasChangeDetails: changeDetails?.length > 0,
    totalOrderItems: order?.items?.length || 0,
  });

  const printData = [];
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

  // Clean professional header
  printData.push(
    {
      type: 'text',
      value: '========================================',
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    },
    {
      type: 'text',
      value: 'MR5 POS SYSTEM - KITCHEN ORDER',
      style: {
        fontSize: '14px',
        fontFamily: 'monospace',
        textAlign: 'center',
        fontWeight: 'bold',
      },
    },
    {
      type: 'text',
      value: '========================================',
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    },
    {
      type: 'text',
      value: `Date: ${dateString}     Time: ${timeString}`,
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    },
    {
      type: 'text',
      value: `Order #: ${order?.orderNumber || 'N/A'}`,
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    }
  );

  // Add order type and location information
  const orderType = order?.type || 'DINE_IN';
  const orderTypeDisplay =
    orderType === 'DINE_IN'
      ? 'DINE IN'
      : orderType === 'TAKEOUT'
        ? 'TAKEAWAY'
        : orderType === 'DELIVERY'
          ? 'DELIVERY'
          : 'DINE IN';

  printData.push({
    type: 'text',
    value: `Type: ${orderTypeDisplay}`,
    style: {
      fontSize: '14px',
      fontFamily: 'monospace',
      textAlign: 'center',
      fontWeight: 'bold',
    },
  });

  // Add location info based on order type
  if (orderType === 'DINE_IN') {
    printData.push({
      type: 'text',
      value: `Table: ${order?.table?.name || 'N/A'}`,
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    });
  } else if (orderType === 'TAKEOUT') {
    // For takeaway orders, show customer name
    printData.push({
      type: 'text',
      value: `Customer: ${order?.customerName || 'N/A'}`,
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    });
    if (order?.customerPhone) {
      printData.push({
        type: 'text',
        value: `Phone: ${order.customerPhone}`,
        style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
      });
    }
  } else if (orderType === 'DELIVERY') {
    // Add customer information for delivery orders
    printData.push(
      {
        type: 'text',
        value: '--- DELIVERY INFORMATION ---',
        style: {
          fontSize: '12px',
          fontFamily: 'monospace',
          textAlign: 'center',
          fontWeight: 'bold',
        },
      },
      {
        type: 'text',
        value: `Customer: ${order?.customerName || 'N/A'}`,
        style: { fontSize: '12px', fontFamily: 'monospace' },
      },
      {
        type: 'text',
        value: `Phone: ${order?.customerPhone || 'N/A'}`,
        style: { fontSize: '12px', fontFamily: 'monospace' },
      },
      {
        type: 'text',
        value: `Address: ${order?.deliveryAddress || 'N/A'}`,
        style: { fontSize: '12px', fontFamily: 'monospace' },
      }
    );
    if (order?.notes) {
      printData.push({
        type: 'text',
        value: `Notes: ${order.notes}`,
        style: { fontSize: '12px', fontFamily: 'monospace' },
      });
    }
  }

  printData.push({
    type: 'text',
    value: '========================================',
    style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
  });

  // SIMPLE LOGIC: Handle each case clearly
  if (cancelledItems && cancelledItems.length > 0) {
    // REMOVAL TICKET
    return generateRemovalTicket(order, cancelledItems);
  } else if (updatedItemIds && updatedItemIds.length > 0) {
    // UPDATE TICKET (with net changes)
    return await generateUpdateTicket(
      order,
      onlyUnprinted,
      updatedItemIds,
      changeDetails
    );
  } else {
    // STANDARD TICKET (new items or full order)
    return generateStandardTicket(order, onlyUnprinted);
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
 * OPTIMIZED: Dedicated removal ticket generator
 * Completely independent of order item filtering
 */
function generateRemovalTicket(order: any, cancelledItems: any[]): string {
  const printData = [];

  // Clean header for removal ticket
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

  printData.push(
    {
      type: 'text',
      value: '========================================',
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    },
    {
      type: 'text',
      value: 'MR5 POS SYSTEM - KITCHEN ORDER',
      style: {
        fontSize: '14px',
        fontFamily: 'monospace',
        textAlign: 'center',
        fontWeight: 'bold',
      },
    },
    {
      type: 'text',
      value: '========================================',
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    },
    {
      type: 'text',
      value: `Date: ${dateString}     Time: ${timeString}`,
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    },
    {
      type: 'text',
      value: `Order #: ${order?.orderNumber || 'N/A'}`,
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    }
  );

  // Add order type
  const orderType = order?.type || 'DINE_IN';
  const orderTypeDisplay =
    orderType === 'DINE_IN'
      ? 'DINE IN'
      : orderType === 'TAKEOUT'
        ? 'TAKEAWAY'
        : orderType === 'DELIVERY'
          ? 'DELIVERY'
          : 'DINE IN';

  printData.push({
    type: 'text',
    value: `Type: ${orderTypeDisplay}`,
    style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
  });

  if (orderType === 'DINE_IN') {
    printData.push({
      type: 'text',
      value: `Table: ${order?.table?.name || 'N/A'}`,
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    });
  } else if (orderType === 'TAKEOUT') {
    printData.push({
      type: 'text',
      value: `Customer: ${order?.customerName || 'N/A'}`,
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    });
  } else if (orderType === 'DELIVERY') {
    printData.push({
      type: 'text',
      value: `Customer: ${order?.customerName || 'N/A'}`,
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    });
  }

  printData.push(
    {
      type: 'text',
      value: '========================================',
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    },
    {
      type: 'text',
      value: '*** ITEM REMOVAL NOTICE ***',
      style: {
        fontSize: '16px',
        fontFamily: 'monospace',
        textAlign: 'center',
        fontWeight: 'bold',
      },
    },
    {
      type: 'text',
      value: '========================================',
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    }
  );

  // Process each removed item
  cancelledItems.forEach((item: any, index: number) => {
    // CRITICAL FIX: Ensure we get the actual menu item name from the relation
    const name =
      (item.menuItem && item.menuItem.name) || // Try menuItem relation first
      item.name ||
      item.menuItemName ||
      `Item ${item.menuItemId?.slice(-4) || 'Unknown'}`; // Fallback with ID
    const quantity = item.quantity ? parseInt(item.quantity) : 1;

    console.log('REMOVAL PROCESSING ITEM:', {
      itemId: item.id,
      menuItemId: item.menuItemId,
      storedName: item.name,
      menuItemName: item.menuItemName,
      relationName: item.menuItem?.name,
      finalName: name,
    });

    if (index > 0) {
      printData.push({
        type: 'text',
        value: '---',
        style: {
          fontSize: '12px',
          fontFamily: 'monospace',
          textAlign: 'center',
        },
      });
    }

    // Format: REMOVE: Item Name x2
    const itemLine = `REMOVE: ${name}`.padEnd(25) + `x${quantity}`.padStart(8);
    printData.push({
      type: 'text',
      value: itemLine,
      style: { fontSize: '14px', fontFamily: 'monospace', fontWeight: 'bold' },
    });

    // Parse notes to extract customizations and regular notes
    if (item.notes) {
      const { regularNotes, removedIngredients, otherCustomizations } =
        parseNotesForCustomizations(item.notes);

      if (regularNotes) {
        printData.push({
          type: 'text',
          value: `    Notes: ${regularNotes}`,
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
          value: `    Remove: ${removedIngredients.join(', ')}`,
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
          value: `    Add: ${customization}`,
          style: {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
          },
        });
      });
    }
  });

  printData.push({
    type: 'text',
    value: '========================================',
    style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
  });

  console.log(
    `REMOVAL TICKET GENERATED: ${cancelledItems.length} items removed`
  );
  return JSON.stringify(printData);
}

/**
 * OPTIMIZED: Dedicated update ticket generator
 * Enhanced filtering with comprehensive debugging and timing issue fix
 */
async function generateUpdateTicket(
  order: any,
  onlyUnprinted: boolean,
  updatedItemIds: string[],
  changeDetails: any[] = []
): Promise<string> {
  const printData = [];

  // DEBUG: Log filtering details for troubleshooting if needed
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 UPDATE FILTERING START:', {
      requestedIds: updatedItemIds,
      requestedIdsCount: updatedItemIds.length,
      changeDetailsCount: changeDetails.length,
      totalOrderItems: order?.items?.length || 0,
    });
  }

  // Filter order items to only include updated ones
  let itemsToProcess = order?.items || [];

  // Apply unprinted filter first if requested
  if (onlyUnprinted) {
    itemsToProcess = itemsToProcess.filter(
      (item: any) => item.printed !== true
    );
    console.log(
      `📋 UNPRINTED FILTER: ${itemsToProcess.length} unprinted items found`
    );
  }

  // Apply update filter
  let matchingItems = itemsToProcess.filter((item: any) =>
    updatedItemIds.includes(item.id)
  );

  // TIMING FIX: If no matches found, implement retry mechanism for database timing issues
  if (matchingItems.length === 0) {
    console.log(
      '⏱️ TIMING FIX: No items found on first attempt, implementing retry mechanism...'
    );

    // Wait 100ms for database transaction to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Re-fetch order if we have access to the order model (will need to be passed in)
    console.log('🔄 RETRY: Attempting to find items after 100ms delay...');

    // Re-apply the filter after delay
    matchingItems = itemsToProcess.filter((item: any) =>
      updatedItemIds.includes(item.id)
    );

    console.log('🎯 RETRY RESULTS:', {
      foundAfterDelay: matchingItems.length,
      matchedIds: matchingItems.map((item: any) => item.id),
    });
  }

  // FALLBACK: If we have changeDetails but no matching items, use changeDetails to create virtual items
  if (matchingItems.length === 0 && changeDetails && changeDetails.length > 0) {
    console.log(
      '🔄 FALLBACK: Using changeDetails to generate net change ticket'
    );
    return generateNetChangeTicket(order, changeDetails);
  }

  console.log('🎯 UPDATE FILTER RESULTS:', {
    itemsAfterUnprintedFilter: itemsToProcess.length,
    matchingUpdatedItems: matchingItems.length,
    matchedIds: matchingItems.map((item: any) => item.id),
    unmatchedRequestedIds: updatedItemIds.filter(
      id => !matchingItems.find((item: any) => item.id === id)
    ),
  });

  // CRITICAL: If still no matches after retry, return detailed debug ticket
  if (matchingItems.length === 0) {
    console.log('⚠️ NO MATCHING ITEMS AFTER RETRY - Generating debug ticket');
    console.log(
      '😨 DEBUGGING: Frontend sent these IDs but none were found even after delay:',
      {
        requestedIds: updatedItemIds,
        availableIds: itemsToProcess.map((item: any) => item.id),
        allOrderItemIds: order?.items?.map((item: any) => item.id) || [],
        onlyUnprinted: onlyUnprinted,
        itemsAfterFilter: itemsToProcess.length,
        originalItemCount: order?.items?.length || 0,
        retryAttempted: true,
      }
    );
    return generateDebugTicket(order, updatedItemIds, itemsToProcess);
  }

  console.log(`UPDATE PIPELINE: Processing ${matchingItems.length} items`);

  // Generate clean update ticket header
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

  // Clean header
  printData.push(
    {
      type: 'text',
      value: '========================================',
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    },
    {
      type: 'text',
      value: 'MR5 POS SYSTEM - KITCHEN ORDER',
      style: {
        fontSize: '14px',
        fontFamily: 'monospace',
        textAlign: 'center',
        fontWeight: 'bold',
      },
    },
    {
      type: 'text',
      value: '========================================',
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    },
    {
      type: 'text',
      value: `Date: ${dateString}     Time: ${timeString}`,
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    },
    {
      type: 'text',
      value: `Order #: ${order?.orderNumber || 'N/A'}`,
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    }
  );

  // Add order type
  const orderType = order?.type || 'DINE_IN';
  const orderTypeDisplay =
    orderType === 'DINE_IN'
      ? 'DINE IN'
      : orderType === 'TAKEOUT'
        ? 'TAKEAWAY'
        : orderType === 'DELIVERY'
          ? 'DELIVERY'
          : 'DINE IN';

  printData.push({
    type: 'text',
    value: `Type: ${orderTypeDisplay}`,
    style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
  });

  if (orderType === 'DINE_IN') {
    printData.push({
      type: 'text',
      value: `Table: ${order?.table?.name || 'N/A'}`,
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    });
  } else if (orderType === 'TAKEOUT') {
    printData.push({
      type: 'text',
      value: `Customer: ${order?.customerName || 'N/A'}`,
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    });
  } else if (orderType === 'DELIVERY') {
    printData.push({
      type: 'text',
      value: `Customer: ${order?.customerName || 'N/A'}`,
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    });
  }

  // Continue with content header
  printData.push({
    type: 'text',
    value: '========================================',
    style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
  });

  // Update/Addition header
  printData.push({
    type: 'text',
    value: '*** ORDER UPDATES ***',
    style: {
      fontSize: '16px',
      fontFamily: 'monospace',
      textAlign: 'center',
      fontWeight: 'bold',
    },
  });

  printData.push({
    type: 'text',
    value: '========================================',
    style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
  });

  // Process matched items
  matchingItems.forEach((item: any, index: number) => {
    // CRITICAL FIX: Ensure we get the actual menu item name from the relation
    const name =
      (item.menuItem && item.menuItem.name) || // Try menuItem relation first
      item.name ||
      item.menuItemName ||
      `Item ${item.menuItemId?.slice(-4) || 'Unknown'}`; // Fallback with ID
    const quantity = item.quantity || 0;

    console.log('PROCESSING ITEM:', {
      itemId: item.id,
      menuItemId: item.menuItemId,
      storedName: item.name,
      menuItemName: item.menuItemName,
      relationName: item.menuItem?.name,
      finalName: name,
    });

    if (index > 0) {
      printData.push({
        type: 'text',
        value: '---',
        style: {
          fontSize: '12px',
          fontFamily: 'monospace',
          textAlign: 'center',
        },
      });
    }

    // ENHANCED: Show net changes when available
    const itemLine = formatUpdateItemLine(
      name,
      quantity,
      item.id,
      changeDetails
    );
    printData.push({
      type: 'text',
      value: itemLine,
      style: { fontSize: '14px', fontFamily: 'monospace', fontWeight: 'bold' },
    });

    // Parse notes to extract customizations and regular notes
    if (item.notes) {
      const { regularNotes, removedIngredients, otherCustomizations } =
        parseNotesForCustomizations(item.notes);

      if (regularNotes) {
        printData.push({
          type: 'text',
          value: `    Notes: ${regularNotes}`,
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
          value: `    Remove: ${removedIngredients.join(', ')}`,
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
          value: `    Add: ${customization}`,
          style: {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
          },
        });
      });
    }
  });

  printData.push({
    type: 'text',
    value: '═══════════════════════════════════════',
    style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
  });

  console.log(
    `✅ UPDATE TICKET GENERATED: ${matchingItems.length} items updated`
  );
  return JSON.stringify(printData);
}

/**
 * OPTIMIZED: Dedicated debug ticket generator
 * Provides detailed information when filtering fails
 */
function generateDebugTicket(
  order: any,
  requestedIds: string[],
  availableItems: any[]
): string {
  const printData = [];

  // Header
  printData.push({
    type: 'text',
    value: '═══════════════════════════════════════',
    style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
  });

  printData.push({
    type: 'text',
    value: '🏪 MR5 POS SYSTEM - DEBUG',
    style: {
      fontSize: '14px',
      fontFamily: 'monospace',
      textAlign: 'center',
      fontWeight: 'bold',
    },
  });

  // Debug information
  printData.push({
    type: 'text',
    value: '🔍 FILTERING DEBUG INFO',
    style: {
      fontSize: '14px',
      fontFamily: 'monospace',
      textAlign: 'center',
      fontWeight: 'bold',
    },
  });

  printData.push({
    type: 'text',
    value: `📝 Order: ${order?.orderNumber || 'N/A'}`,
    style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
  });

  printData.push({
    type: 'text',
    value: `🎯 Requested IDs: ${requestedIds.length}`,
    style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
  });

  printData.push({
    type: 'text',
    value: `📋 Available Items: ${availableItems.length}`,
    style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
  });

  // Show requested vs available
  printData.push({
    type: 'text',
    value: '--- REQUESTED IDs ---',
    style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
  });

  requestedIds.forEach(id => {
    printData.push({
      type: 'text',
      value: `  ${id}`,
      style: { fontSize: '11px', fontFamily: 'monospace' },
    });
  });

  printData.push({
    type: 'text',
    value: '--- AVAILABLE IDs ---',
    style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
  });

  availableItems.slice(0, 10).forEach(item => {
    // Show first 10 items
    printData.push({
      type: 'text',
      value: `  ${item.id} (${item.name || item.menuItemName})`,
      style: { fontSize: '11px', fontFamily: 'monospace' },
    });
  });

  if (availableItems.length > 10) {
    printData.push({
      type: 'text',
      value: `  ... and ${availableItems.length - 10} more`,
      style: { fontSize: '11px', fontFamily: 'monospace' },
    });
  }

  printData.push({
    type: 'text',
    value: '═══════════════════════════════════════',
    style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
  });

  console.log(
    `🔍 DEBUG TICKET GENERATED: ${requestedIds.length} requested, ${availableItems.length} available`
  );
  return JSON.stringify(printData);
}

/**
 * OPTIMIZED: Dedicated standard ticket generator
 * Handles full order printing with proper formatting
 */
function generateStandardTicket(order: any, onlyUnprinted: boolean): string {
  const printData = [];
  let itemsToProcess = order?.items || [];

  console.log('📋 STANDARD PIPELINE: Processing full order', {
    totalItems: itemsToProcess.length,
    onlyUnprinted: onlyUnprinted,
    orderNumber: order?.orderNumber,
  });

  // Apply unprinted filter if requested
  if (onlyUnprinted) {
    itemsToProcess = itemsToProcess.filter(
      (item: any) => item.printed !== true
    );
    console.log(
      `📋 UNPRINTED FILTER: ${itemsToProcess.length} unprinted items found`
    );
  }

  // Generate header
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

  // Restaurant Header
  printData.push({
    type: 'text',
    value: '═══════════════════════════════════════',
    style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
  });

  printData.push({
    type: 'text',
    value: '🏪 MR5 POS SYSTEM',
    style: {
      fontSize: '14px',
      fontFamily: 'monospace',
      textAlign: 'center',
      fontWeight: 'bold',
    },
  });

  printData.push({
    type: 'text',
    value: `📅 ${dateString}`,
    style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
  });

  printData.push({
    type: 'text',
    value: `🕐 ${timeString}`,
    style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
  });

  printData.push({
    type: 'text',
    value: `📝 Order: ${order?.orderNumber || 'N/A'}`,
    style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
  });

  const orderType = order?.type || 'DINE_IN';
  const locationDisplay =
    orderType === 'DINE_IN'
      ? `Table: ${order?.table?.name || 'N/A'}`
      : `Customer: ${order?.customerName || 'N/A'}`;

  printData.push({
    type: 'text',
    value: locationDisplay,
    style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
  });

  // Standard order header
  printData.push({
    type: 'text',
    value: onlyUnprinted
      ? '📋 KITCHEN ORDER (UNPRINTED) 📋'
      : '📋 KITCHEN ORDER 📋',
    style: {
      fontSize: '16px',
      fontFamily: 'monospace',
      textAlign: 'center',
      fontWeight: 'bold',
    },
  });

  printData.push({
    type: 'text',
    value: '═══════════════════════════════════════',
    style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
  });

  // Process all items
  if (itemsToProcess.length === 0) {
    printData.push({
      type: 'text',
      value: 'No items to display',
      style: {
        fontSize: '14px',
        fontFamily: 'monospace',
        textAlign: 'center',
        fontStyle: 'italic',
      },
    });
  } else {
    itemsToProcess.forEach((item: any, index: number) => {
      // CRITICAL FIX: Ensure we get the actual menu item name from the relation
      const name =
        (item.menuItem && item.menuItem.name) || // Try menuItem relation first
        item.name ||
        item.menuItemName ||
        `Item ${item.menuItemId?.slice(-4) || 'Unknown'}`; // Fallback with ID
      const quantity = item.quantity || 0;

      console.log('🔍 STANDARD PROCESSING ITEM:', {
        itemId: item.id,
        menuItemId: item.menuItemId,
        storedName: item.name,
        menuItemName: item.menuItemName,
        relationName: item.menuItem?.name,
        finalName: name,
      });

      if (index > 0) {
        printData.push({
          type: 'text',
          value: '',
          style: { fontSize: '16px' },
        });
        printData.push({
          type: 'text',
          value: '---',
          style: {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            textAlign: 'center',
          },
        });
      }

      // Format: Item Name x2
      const itemLine = name.padEnd(25) + `x${quantity}`.padStart(8);
      printData.push({
        type: 'text',
        value: itemLine,
        style: {
          fontSize: '16px',
          fontFamily: 'Arial, sans-serif',
          fontWeight: 'bold',
        },
      });

      // Parse notes to extract customizations and regular notes
      if (item.notes) {
        const { regularNotes, removedIngredients, otherCustomizations } =
          parseNotesForCustomizations(item.notes);

        // Add small spacing before customizations
        printData.push({
          type: 'text',
          value: '',
          style: { fontSize: '8px' },
        });

        // Display regular notes
        if (regularNotes) {
          printData.push({
            type: 'text',
            value: `    Notes: ${regularNotes}`,
            style: {
              fontSize: '14px',
              fontFamily: 'monospace',
              fontStyle: 'italic',
            },
          });
        }

        // Display removed ingredients
        if (removedIngredients.length > 0) {
          printData.push({
            type: 'text',
            value: `    Remove: ${removedIngredients.join(', ')}`,
            style: {
              fontSize: '14px',
              fontFamily: 'monospace',
              fontWeight: 'bold',
            },
          });
        }

        // Display other customizations
        otherCustomizations.forEach((customization: string) => {
          printData.push({
            type: 'text',
            value: `    Add: ${customization}`,
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

  printData.push({
    type: 'text',
    value: '═══════════════════════════════════════',
    style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
  });

  console.log(
    `✅ STANDARD TICKET GENERATED: ${itemsToProcess.length} items processed`
  );
  return JSON.stringify(printData);
}

/**
 * Helper function to format update line with net changes
 */
function formatUpdateItemLine(
  name: string,
  quantity: number,
  itemId: string,
  changeDetails: any[]
): string {
  // Find change details for this item
  const change = changeDetails?.find(
    c => c.itemId === itemId || c.id === itemId
  );

  // DEBUG: Log change data for troubleshooting if needed
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 FORMAT UPDATE ITEM LINE:', {
      itemId,
      name,
      changeFound: !!change,
      changeType: change?.changeType,
      netChange: change?.netChange,
    });
  }

  if (change) {
    // Handle different types of changes
    if (change.type === 'NEW' || change.changeType === 'NEW') {
      // New item added
      return `ADD: ${name}`.padEnd(25) + `x${quantity}`.padStart(8);
    } else if (
      change.changeType === 'UPDATE' &&
      change.netChange !== undefined
    ) {
      // CRITICAL FIX: Handle frontend UPDATE format with netChange
      const operator = change.netChange > 0 ? '+' : '';
      const action = change.netChange > 0 ? 'ADD' : 'REDUCE';
      return (
        `${action}: ${name}`.padEnd(25) +
        `${operator}${change.netChange}`.padStart(8)
      );
    } else if (change.type === 'QUANTITY_INCREASE') {
      // Quantity increased
      const netChange = change.netChange || change.addedQuantity || 1;
      return `ADD: ${name}`.padEnd(25) + `+${netChange}`.padStart(8);
    } else if (change.type === 'QUANTITY_DECREASE') {
      // Quantity decreased
      const netChange = change.netChange || change.removedQuantity || 1;
      return (
        `REDUCE: ${name}`.padEnd(25) + `-${Math.abs(netChange)}`.padStart(8)
      );
    } else if (change.addedQuantity && change.addedQuantity > 0) {
      // Legacy format for added quantity
      return `ADD: ${name}`.padEnd(25) + `+${change.addedQuantity}`.padStart(8);
    } else if (change.removedQuantity && change.removedQuantity > 0) {
      // Legacy format for reduced quantity
      return (
        `REDUCE: ${name}`.padEnd(25) + `-${change.removedQuantity}`.padStart(8)
      );
    } else if (change.netChange) {
      // Net change format fallback
      const operator = change.netChange > 0 ? '+' : '';
      const action = change.netChange > 0 ? 'ADD' : 'REDUCE';
      return (
        `${action}: ${name}`.padEnd(25) +
        `${operator}${change.netChange}`.padStart(8)
      );
    }
  }

  // Fallback: new item or standard format
  return `ADD: ${name}`.padEnd(25) + `x${quantity}`.padStart(8);
}

/**
 * Generate ticket using only changeDetails when item IDs don't match
 * This handles the case where frontend item IDs are out of sync with backend
 */
function generateNetChangeTicket(order: any, changeDetails: any[]): string {
  console.log(
    'GENERATING NET CHANGE TICKET from changeDetails:',
    changeDetails
  );

  const printData = [];
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

  // Header
  printData.push(
    {
      type: 'text',
      value: '═══════════════════════════════════════',
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    },
    {
      type: 'text',
      value: '🏩 MR5 POS SYSTEM',
      style: {
        fontSize: '14px',
        fontFamily: 'monospace',
        textAlign: 'center',
        fontWeight: 'bold',
      },
    },
    {
      type: 'text',
      value: `📅 ${dateString}     🕐 ${timeString}`,
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    },
    {
      type: 'text',
      value: `📝 Order: ${order?.orderNumber || 'N/A'}`,
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    },
    {
      type: 'text',
      value: order?.type === 'DINE_IN'
        ? `Table: ${order?.table?.name || 'N/A'}`
        : `Customer: ${order?.customerName || 'N/A'}`,
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    },
    {
      type: 'text',
      value: '🆕 NET CHANGES 🆕',
      style: {
        fontSize: '16px',
        fontFamily: 'monospace',
        textAlign: 'center',
        fontWeight: 'bold',
      },
    },
    {
      type: 'text',
      value: '═══════════════════════════════════════',
      style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
    }
  );

  // Process changeDetails directly
  changeDetails.forEach((change: any, index: number) => {
    // Try to find the item name from the order data - check both id fields
    const changeId = change.itemId || change.id;
    const orderItem = order?.items?.find((item: any) => item.id === changeId);
    const itemName =
      orderItem?.menuItem?.name ||
      orderItem?.name ||
      orderItem?.menuItemName ||
      change.name || // Use the name from changeDetails if available
      `Item ${changeId?.slice(-4) || 'Unknown'}`;

    if (index > 0) {
      printData.push({
        type: 'text',
        value: '---',
        style: {
          fontSize: '12px',
          fontFamily: 'monospace',
          textAlign: 'center',
        },
      });
    }

    // Generate the appropriate change line
    let changeLine = '';

    // CRITICAL FIX: Handle netChange format from frontend tracking
    let addedQty = change.addedQuantity;
    let removedQty = change.removedQuantity;

    if (!addedQty && !removedQty && change.netChange !== undefined) {
      if (change.netChange > 0) {
        addedQty = change.netChange;
      } else if (change.netChange < 0) {
        removedQty = Math.abs(change.netChange);
      }
    }

    if (addedQty && addedQty > 0) {
      changeLine =
        `➕ ADD: ${itemName}`.padEnd(25) + `+${addedQty}`.padStart(8);
    } else if (removedQty && removedQty > 0) {
      changeLine =
        `➖ REDUCE: ${itemName}`.padEnd(25) + `-${removedQty}`.padStart(8);
    } else {
      changeLine =
        `✨ CHANGE: ${itemName}`.padEnd(25) + `(see details)`.padStart(8);
    }

    printData.push({
      type: 'text',
      value: changeLine,
      style: { fontSize: '14px', fontFamily: 'monospace', fontWeight: 'bold' },
    });

    console.log('🎆 NET CHANGE ITEM:', {
      changeId: change.id,
      itemName,
      addedQuantity: change.addedQuantity,
      removedQuantity: change.removedQuantity,
      finalLine: changeLine,
    });
  });

  printData.push({
    type: 'text',
    value: '═══════════════════════════════════════',
    style: { fontSize: '12px', fontFamily: 'monospace', textAlign: 'center' },
  });

  console.log(
    `✅ NET CHANGE TICKET GENERATED: ${changeDetails.length} changes processed`
  );
  return JSON.stringify(printData);
}
