/**
 * Add-On Enhanced Kitchen Ticket Generator
 *
 * Extended kitchen ticket generation with comprehensive add-on support
 * Integrates with existing kitchen ticket generation while adding add-on display
 */
/**
 * Enhanced kitchen ticket generation with add-on support
 *
 * This function extends the existing kitchen ticket functionality
 * to include detailed add-on information for each order item
 */
export class AddonKitchenTicketGenerator {
    constructor(addonService) {
        this.addonService = addonService;
    }
    /**
     * Generate enhanced kitchen ticket with add-on details
     */
    async generateKitchenTicketWithAddons(order, onlyUnprinted = false, cancelledItems = [], updatedItemIds = [], changeDetails = []) {
        console.log('🍽️ GENERATING KITCHEN TICKET WITH ADD-ONS:', {
            orderId: order?.id,
            orderNumber: order?.orderNumber,
            itemCount: order?.items?.length || 0,
            onlyUnprinted,
        });
        // First, enrich order items with add-on data
        const enrichedOrder = await this.enrichOrderItemsWithAddons(order);
        // Then generate the enhanced ticket using existing logic but with add-on data
        if (cancelledItems && cancelledItems.length > 0) {
            return this.generateAddonRemovalTicket(enrichedOrder, cancelledItems);
        }
        else if (updatedItemIds && updatedItemIds.length > 0) {
            return this.generateAddonUpdateTicket(enrichedOrder, onlyUnprinted, updatedItemIds, changeDetails);
        }
        else {
            return this.generateAddonStandardTicket(enrichedOrder, onlyUnprinted);
        }
    }
    /**
     * Enrich order items with add-on data
     */
    async enrichOrderItemsWithAddons(order) {
        if (!order?.items) {
            return order;
        }
        const enrichedItems = await Promise.all(order.items.map(async (item) => {
            try {
                // Get add-ons for this order item
                const addonResult = await this.addonService.getOrderItemAddons(item.id);
                const addons = addonResult.success ? addonResult.data : [];
                return {
                    ...item,
                    addons: addons,
                    hasAddons: addons.length > 0,
                };
            }
            catch (error) {
                console.warn(`Failed to get add-ons for item ${item.id}:`, error);
                return {
                    ...item,
                    addons: [],
                    hasAddons: false,
                };
            }
        }));
        return {
            ...order,
            items: enrichedItems,
        };
    }
    /**
     * Generate standard kitchen ticket with add-ons
     */
    generateAddonStandardTicket(order, onlyUnprinted) {
        const printData = [];
        let itemsToProcess = order?.items || [];
        // Apply unprinted filter if requested
        if (onlyUnprinted) {
            itemsToProcess = itemsToProcess.filter((item) => item.printed !== true);
        }
        // ✅ FIX: Filter out items marked as not printable in kitchen
        console.log('🔍 [generateAddonStandardTicket] Filtering items before printing, count BEFORE filter:', itemsToProcess.length);
        itemsToProcess = itemsToProcess.filter((item) => {
            const isPrintable = this.isItemPrintable(item);
            console.log('🔍 [generateAddonStandardTicket] Item:', {
                id: item.id,
                menuItemId: item.menuItemId,
                name: item.menuItem?.name || item.name,
                isPrintable,
                'item.menuItem?.isPrintableInKitchen': item.menuItem?.isPrintableInKitchen,
                'item.isPrintableInKitchen': item.isPrintableInKitchen,
            });
            return isPrintable;
        });
        console.log('🔍 [generateAddonStandardTicket] Items AFTER filter:', itemsToProcess.length);
        // Generate clean header (same as original)
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
        // Header section
        printData.push({
            type: 'text',
            value: 'KITCHEN TICKET',
            style: {
                fontSize: '24px',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold',
                textAlign: 'center',
            },
        }, {
            type: 'text',
            value: '',
            style: { fontSize: '12px' },
        }, {
            type: 'text',
            value: `Order #${order?.orderNumber || 'N/A'}`,
            style: {
                fontSize: '20px',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold',
                textAlign: 'center',
            },
        }, {
            type: 'text',
            value: `${dateString} - ${timeString}`,
            style: {
                fontSize: '16px',
                fontFamily: 'Arial, sans-serif',
                textAlign: 'center',
            },
        });
        // Add location/customer information based on order type
        const orderType = order?.type || 'DINE_IN';
        if (orderType === 'DINE_IN') {
            // Show table for dine-in orders
            printData.push({
                type: 'text',
                value: `Table: ${order?.table?.name || order?.tableName || 'N/A'}`,
                style: {
                    fontSize: '18px',
                    fontFamily: 'Arial, sans-serif',
                    fontWeight: 'bold',
                    textAlign: 'center',
                },
            });
        }
        else if (orderType === 'TAKEOUT') {
            // Show customer name for takeaway orders
            printData.push({
                type: 'text',
                value: `Customer: ${order?.customerName || 'N/A'}`,
                style: {
                    fontSize: '18px',
                    fontFamily: 'Arial, sans-serif',
                    fontWeight: 'bold',
                    textAlign: 'center',
                },
            });
            printData.push({
                type: 'text',
                value: `Order Type: TAKEAWAY`,
                style: {
                    fontSize: '16px',
                    fontFamily: 'Arial, sans-serif',
                    fontWeight: 'bold',
                    textAlign: 'center',
                },
            });
        }
        else if (orderType === 'DELIVERY') {
            // Show customer name for delivery orders
            printData.push({
                type: 'text',
                value: `Customer: ${order?.customerName || 'N/A'}`,
                style: {
                    fontSize: '18px',
                    fontFamily: 'Arial, sans-serif',
                    fontWeight: 'bold',
                    textAlign: 'center',
                },
            });
            printData.push({
                type: 'text',
                value: `Order Type: DELIVERY`,
                style: {
                    fontSize: '16px',
                    fontFamily: 'Arial, sans-serif',
                    fontWeight: 'bold',
                    textAlign: 'center',
                },
            });
        }
        // Items separator
        printData.push({
            type: 'text',
            value: '',
            style: { fontSize: '16px' },
        }, {
            type: 'text',
            value: '================================',
            style: {
                fontSize: '16px',
                fontFamily: 'monospace',
                textAlign: 'center',
            },
        }, {
            type: 'text',
            value: '',
            style: { fontSize: '10px' },
        });
        // Filter items to only include those that should be printed in kitchen
        const printableItems = itemsToProcess.filter((item) => this.isItemPrintable(item));
        // Process each item with add-ons
        printableItems.forEach((item, index) => {
            const itemName = this.getItemName(item);
            const quantity = item.quantity || 0;
            // Add spacing between items (except first)
            if (index > 0) {
                printData.push({
                    type: 'text',
                    value: '',
                    style: { fontSize: '16px' },
                });
            }
            // Main item display
            printData.push({
                type: 'text',
                value: `${quantity}x  ${itemName}`,
                style: {
                    fontSize: '18px',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                },
            });
            // Add-ons display - filter to only show printable addons
            const printableAddons = this.filterPrintableAddons(item.addons);
            if (item.hasAddons && printableAddons.length > 0) {
                printData.push({
                    type: 'text',
                    value: '',
                    style: { fontSize: '8px' },
                });
                // Group add-ons by addon group for better organization
                const addonsByGroup = this.groupAddonsByGroup(printableAddons);
                Object.entries(addonsByGroup).forEach(([groupName, addons]) => {
                    // Display group name if more than one group
                    if (Object.keys(addonsByGroup).length > 1) {
                        printData.push({
                            type: 'text',
                            value: `       ${groupName}:`,
                            style: {
                                fontSize: '16px',
                                fontFamily: 'Arial, sans-serif',
                                fontWeight: 'bold',
                                fontStyle: 'italic',
                            },
                        });
                    }
                    // Display each add-on in the group
                    addons.forEach((addon) => {
                        const prefix = Object.keys(addonsByGroup).length > 1 ? '         ' : '       ';
                        const perItemQty = addon.quantity || 1;
                        // ✅ FIX: Show total addon quantity (per-item qty × item qty)
                        const totalAddonQty = perItemQty * quantity;
                        const addonDisplay = `${prefix}+ ${totalAddonQty}x ${addon.addon.name}`;
                        printData.push({
                            type: 'text',
                            value: addonDisplay,
                            style: {
                                fontSize: '16px',
                                fontFamily: 'Arial, sans-serif',
                                fontWeight: 'normal',
                            },
                        });
                    });
                });
            }
            // Original notes display (unchanged)
            if (item.notes) {
                const { regularNotes, removedIngredients, otherCustomizations } = this.parseNotesForCustomizations(item.notes);
                // Add small spacing before customizations
                printData.push({
                    type: 'text',
                    value: '',
                    style: { fontSize: '10px' },
                });
                // Display regular notes
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
                // Display removed ingredients
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
                // Display other customizations
                if (otherCustomizations.length > 0) {
                    printData.push({
                        type: 'text',
                        value: `       Special: ${otherCustomizations.join(', ')}`,
                        style: {
                            fontSize: '16px',
                            fontFamily: 'Arial, sans-serif',
                            fontStyle: 'italic',
                        },
                    });
                }
            }
        });
        // Footer
        printData.push({
            type: 'text',
            value: '',
            style: { fontSize: '16px' },
        }, {
            type: 'text',
            value: '================================',
            style: {
                fontSize: '16px',
                fontFamily: 'monospace',
                textAlign: 'center',
            },
        }, {
            type: 'text',
            value: `Items: ${printableItems.length}`,
            style: {
                fontSize: '16px',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold',
                textAlign: 'center',
            },
        });
        // Add special instructions if present
        if (order?.notes || order?.specialInstructions) {
            printData.push({
                type: 'text',
                value: '',
                style: { fontSize: '12px' },
            }, {
                type: 'text',
                value: 'SPECIAL INSTRUCTIONS:',
                style: {
                    fontSize: '18px',
                    fontFamily: 'Arial, sans-serif',
                    fontWeight: 'bold',
                    textAlign: 'center',
                },
            }, {
                type: 'text',
                value: order?.notes || order?.specialInstructions,
                style: {
                    fontSize: '16px',
                    fontFamily: 'Arial, sans-serif',
                    textAlign: 'center',
                    fontStyle: 'italic',
                },
            });
        }
        // Convert to JSON string for printer
        const result = JSON.stringify(printData, null, 0);
        console.log('✅ Kitchen ticket with add-ons generated successfully');
        return result;
    }
    /**
     * Generate removal ticket with add-on cleanup
     */
    generateAddonRemovalTicket(order, cancelledItems) {
        // This would handle add-on cleanup for cancelled items
        // For now, delegate to original implementation and add add-on notes
        return this.generateAddonStandardTicket(order, false);
    }
    /**
     * Generate update ticket with add-on changes
     */
    generateAddonUpdateTicket(order, onlyUnprinted, updatedItemIds, changeDetails) {
        // This would handle add-on updates and changes
        // For now, delegate to standard implementation
        return this.generateAddonStandardTicket(order, onlyUnprinted);
    }
    /**
     * Check if an item should be printed in kitchen tickets
     * Returns true if isPrintableInKitchen is true or undefined (backward compatibility)
     */
    isItemPrintable(item) {
        // Check item.menuItem.isPrintableInKitchen first (joined data)
        if (item.menuItem?.isPrintableInKitchen !== undefined) {
            return item.menuItem.isPrintableInKitchen === true || item.menuItem.isPrintableInKitchen === 1;
        }
        // Check item.isPrintableInKitchen (direct property)
        if (item.isPrintableInKitchen !== undefined) {
            return item.isPrintableInKitchen === true || item.isPrintableInKitchen === 1;
        }
        // Default to true for backward compatibility (existing items without this field)
        return true;
    }
    /**
     * Filter addons - addons always follow the parent menu item's printability
     */
    filterPrintableAddons(addons) {
        if (!addons || !Array.isArray(addons)) {
            return [];
        }
        // ✅ FIX: Addons always follow the parent item - no separate filtering needed
        return addons;
    }
    /**
     * Group add-ons by their addon group for better organization
     */
    groupAddonsByGroup(addons) {
        const grouped = {};
        addons.forEach(addon => {
            const groupName = addon.addon?.addonGroup?.name || 'Add-ons';
            if (!grouped[groupName]) {
                grouped[groupName] = [];
            }
            grouped[groupName].push(addon);
        });
        return grouped;
    }
    /**
     * Get item name (same as original implementation)
     */
    getItemName(item) {
        return (item.name ||
            item.menuItemName ||
            item.menuItem?.name ||
            `Item ${item.menuItemId?.slice(-4) || 'Unknown'}`);
    }
    /**
     * Parse notes for customizations (same as original implementation)
     */
    parseNotesForCustomizations(notes) {
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
        let regularNotes = [];
        let removedIngredients = [];
        let otherCustomizations = [];
        lines.forEach(line => {
            // Check for removed ingredients: "remove: ingredient1 - ingredient2"
            if (line.toLowerCase().startsWith('remove:')) {
                const ingredients = line.substring(7).trim();
                if (ingredients) {
                    const ingredientList = ingredients
                        .split(' - ')
                        .map(ing => ing.trim())
                        .filter(ing => ing.length > 0);
                    removedIngredients.push(...ingredientList);
                }
            }
            // Check if line contains customizations (comma-separated without "remove:")
            else if (line.includes(',') &&
                !line.toLowerCase().includes('remove') &&
                !line.toLowerCase().includes('note:')) {
                const customizations = line
                    .split(',')
                    .map(custom => custom.trim())
                    .filter(custom => custom.length > 0);
                otherCustomizations.push(...customizations);
            }
            // Regular notes
            else {
                regularNotes.push(line);
            }
        });
        return {
            regularNotes: regularNotes.join(' '),
            removedIngredients,
            otherCustomizations,
        };
    }
}
