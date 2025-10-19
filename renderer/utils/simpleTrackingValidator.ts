/**
 * Simple Tracking Validator
 *
 * Quick validation utility to test simple tracking logic
 * Can be run independently of React components for unit testing
 */

import type {
  SimpleOrderTracking,
  SimpleOrderChange,
} from '@/hooks/useSimpleOrderTracking';

export class SimpleTrackingValidator {
  private tracking: SimpleOrderTracking = {
    newItems: [],
    netChanges: {},
    removedItems: [],
  };

  // Reset tracking state
  clear() {
    this.tracking = {
      newItems: [],
      netChanges: {},
      removedItems: [],
    };
  }

  // Track new item addition
  trackNewItem(
    itemId: string,
    name: string,
    menuItemId: string,
    quantity: number
  ) {
    // Remove from any existing tracking arrays (in case of duplicates)
    this.tracking.newItems = this.tracking.newItems.filter(
      item => item.id !== itemId
    );
    delete this.tracking.netChanges[itemId];
    this.tracking.removedItems = this.tracking.removedItems.filter(
      item => item.id !== itemId
    );

    // Add to new items
    this.tracking.newItems.push({ id: itemId, name, menuItemId, quantity });
  }

  // Track quantity change
  trackQuantityChange(
    itemId: string,
    name: string,
    menuItemId: string,
    oldQuantity: number,
    newQuantity: number
  ) {
    // Check if this is a newly added item
    const isNewItem = this.tracking.newItems.some(item => item.id === itemId);

    if (isNewItem) {
      // Update the new item quantity directly
      this.tracking.newItems = this.tracking.newItems.map(item =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      );
    } else {
      // Track net change for existing items
      const existingChange = this.tracking.netChanges[itemId];
      const originalQty = existingChange?.originalQty ?? oldQuantity;

      this.tracking.netChanges[itemId] = {
        itemId,
        name,
        menuItemId,
        originalQty,
        currentQty: newQuantity,
      };
    }
  }

  // Track item removal
  trackItemRemoval(
    itemId: string,
    name: string,
    menuItemId: string,
    quantity: number
  ) {
    // Check if this was a newly added item
    const wasNewItem = this.tracking.newItems.some(item => item.id === itemId);

    if (wasNewItem) {
      // Just remove from new items (no net change needed)
      this.tracking.newItems = this.tracking.newItems.filter(
        item => item.id !== itemId
      );
    } else {
      // Track as removed item
      delete this.tracking.netChanges[itemId];
      this.tracking.removedItems = this.tracking.removedItems.filter(
        item => item.id !== itemId
      );
      this.tracking.removedItems.push({
        id: itemId,
        name,
        menuItemId,
        quantity,
      });
    }
  }

  // Get kitchen changes
  getKitchenChanges(): {
    hasChanges: boolean;
    changesSummary: SimpleOrderChange[];
    newItemsCount: number;
    updatedItemsCount: number;
    removedItemsCount: number;
  } {
    const changes: SimpleOrderChange[] = [];

    // Add new items
    this.tracking.newItems.forEach(item => {
      changes.push({
        itemId: item.id,
        name: item.name,
        menuItemId: item.menuItemId,
        originalQuantity: 0,
        currentQuantity: item.quantity,
        netChange: item.quantity,
        changeType: 'NEW',
      });
    });

    // Add net quantity changes (only non-zero changes)
    Object.values(this.tracking.netChanges).forEach(change => {
      const netChange = change.currentQty - change.originalQty;
      if (netChange !== 0) {
        changes.push({
          itemId: change.itemId,
          name: change.name,
          menuItemId: change.menuItemId,
          originalQuantity: change.originalQty,
          currentQuantity: change.currentQty,
          netChange,
          changeType: 'UPDATE',
        });
      }
    });

    // Add removed items
    this.tracking.removedItems.forEach(item => {
      changes.push({
        itemId: item.id,
        name: item.name,
        menuItemId: item.menuItemId,
        originalQuantity: item.quantity,
        currentQuantity: 0,
        netChange: -item.quantity,
        changeType: 'REMOVE',
      });
    });

    return {
      hasChanges: changes.length > 0,
      changesSummary: changes,
      newItemsCount: this.tracking.newItems.length,
      updatedItemsCount: Object.values(this.tracking.netChanges).filter(
        c => c.currentQty !== c.originalQty
      ).length,
      removedItemsCount: this.tracking.removedItems.length,
    };
  }

  // Generate kitchen ticket text
  generateKitchenTicket(): string[] {
    const changes = this.getKitchenChanges();
    const tickets: string[] = [];

    changes.changesSummary.forEach(change => {
      switch (change.changeType) {
        case 'NEW':
          tickets.push(`${change.netChange}x ${change.name.toUpperCase()}`);
          break;
        case 'UPDATE':
          if (change.netChange > 0) {
            tickets.push(`${change.name.toUpperCase()} +${change.netChange}`);
          } else {
            tickets.push(`${change.name.toUpperCase()} ${change.netChange}`);
          }
          break;
        case 'REMOVE':
          tickets.push(
            `❌ REMOVE: ${change.name.toUpperCase()} x${Math.abs(change.netChange)}`
          );
          break;
      }
    });

    return tickets;
  }
}

// Test runner function
export function runSimpleTrackingTests(): {
  passed: number;
  total: number;
  results: any[];
} {
  const validator = new SimpleTrackingValidator();
  const results: any[] = [];

  // Test 1: Simple Item Addition
  validator.clear();
  validator.trackNewItem('item-1', 'Burger', 'menu-1', 1);
  validator.trackNewItem('item-2', 'Fries', 'menu-2', 1);

  const test1 = validator.generateKitchenTicket();
  const test1Pass = test1.includes('1x BURGER') && test1.includes('1x FRIES');
  results.push({
    name: 'Simple Item Addition',
    passed: test1Pass,
    expected: ['1x BURGER', '1x FRIES'],
    actual: test1,
  });

  // Test 2: Quantity Updates
  validator.clear();
  validator.trackQuantityChange('existing-1', 'Burger', 'menu-1', 1, 3);
  validator.trackQuantityChange('existing-2', 'Fries', 'menu-2', 1, 2);

  const test2 = validator.generateKitchenTicket();
  const test2Pass = test2.includes('BURGER +2') && test2.includes('FRIES +1');
  results.push({
    name: 'Quantity Updates',
    passed: test2Pass,
    expected: ['BURGER +2', 'FRIES +1'],
    actual: test2,
  });

  // Test 3: Item Removal
  validator.clear();
  validator.trackItemRemoval('existing-1', 'Burger', 'menu-1', 3);

  const test3 = validator.generateKitchenTicket();
  const test3Pass = test3.includes('❌ REMOVE: BURGER x3');
  results.push({
    name: 'Item Removal',
    passed: test3Pass,
    expected: ['❌ REMOVE: BURGER x3'],
    actual: test3,
  });

  // Test 4: Net Zero Changes
  validator.clear();
  validator.trackQuantityChange('existing-1', 'Burger', 'menu-1', 2, 5);
  validator.trackQuantityChange('existing-1', 'Burger', 'menu-1', 5, 2);

  const test4 = validator.generateKitchenTicket();
  const test4Pass = test4.length === 0;
  results.push({
    name: 'Net Zero Changes',
    passed: test4Pass,
    expected: [],
    actual: test4,
  });

  // Test 5: Mixed Operations
  validator.clear();
  validator.trackNewItem('item-1', 'Drink', 'menu-3', 1);
  validator.trackQuantityChange('existing-1', 'Burger', 'menu-1', 2, 4);

  const test5 = validator.generateKitchenTicket();
  const test5Pass = test5.includes('1x DRINK') && test5.includes('BURGER +2');
  results.push({
    name: 'Mixed Operations',
    passed: test5Pass,
    expected: ['1x DRINK', 'BURGER +2'],
    actual: test5,
  });

  const passed = results.filter(r => r.passed).length;
  return { passed, total: results.length, results };
}

// Console test runner
export function logTestResults() {
  console.log('🧪 Running Simple Tracking Validation Tests...');
  const testResults = runSimpleTrackingTests();

  console.log(
    `\n📊 TEST RESULTS: ${testResults.passed}/${testResults.total} PASSED\n`
  );

  testResults.results.forEach((result, index) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${index + 1}. ${result.name}: ${status}`);
    console.log(`   Expected: ${JSON.stringify(result.expected)}`);
    console.log(`   Actual:   ${JSON.stringify(result.actual)}`);
    console.log('');
  });

  if (testResults.passed === testResults.total) {
    console.log(
      '🎉 ALL TESTS PASSED! Simple tracking system is working correctly.'
    );
  } else {
    console.log('⚠️  Some tests failed. Check implementation.');
  }

  return testResults;
}
