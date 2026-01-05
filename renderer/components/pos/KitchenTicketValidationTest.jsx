/**
 * Kitchen Ticket Validation Test
 *
 * Tests the exact scenarios from KITCHEN_TICKET_TEST_SCENARIOS.md
 * Validates that simple tracking produces correct kitchen notifications
 */
import React, { useState } from 'react';
import { orderLogger } from '@/utils/logger';
import { useSimpleOrderTracking } from '@/hooks/useSimpleOrderTracking';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
export function KitchenTicketValidationTest() {
    const [testOrderId] = useState('kitchen-test-order');
    const [currentTest, setCurrentTest] = useState(null);
    const [allTests, setAllTests] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const { trackNewItem, trackQuantityChange, trackItemRemoval, clearTracking, hasChanges, changesSummary, newItemsCount, updatedItemsCount, removedItemsCount, } = useSimpleOrderTracking(testOrderId);
    // Helper function to generate kitchen ticket text from changes
    const generateKitchenTickets = () => {
        if (!changesSummary || changesSummary.length === 0)
            return [];
        const tickets = [];
        changesSummary.forEach(change => {
            switch (change.changeType) {
                case 'NEW':
                    tickets.push(`${change.netChange}x ${change.name.toUpperCase()}`);
                    break;
                case 'UPDATE':
                    if (change.netChange > 0) {
                        tickets.push(`${change.name.toUpperCase()} +${change.netChange}`);
                    }
                    else {
                        tickets.push(`${change.name.toUpperCase()} ${change.netChange}`);
                    }
                    break;
                case 'REMOVE':
                    tickets.push(`❌ REMOVE: ${change.name.toUpperCase()} x${Math.abs(change.netChange)}`);
                    break;
            }
        });
        return tickets;
    };
    // Scenario 1: Simple Item Addition
    const runScenario1 = () => {
        orderLogger.debug('Testing Scenario 1: Simple Item Addition');
        clearTracking();
        const steps = [
            '1. Create new table order',
            '2. Add 1x Burger from menu',
            '3. Add 1x Fries from menu',
            '4. Press "Done Adding Items"',
        ];
        // Execute steps
        trackNewItem('item-1', 'Burger', 'menu-1', 1);
        trackNewItem('item-2', 'Fries', 'menu-2', 1);
        const expectedTickets = ['1x BURGER', '1x FRIES'];
        const actualTickets = generateKitchenTickets();
        const passed = actualTickets.length === 2 &&
            actualTickets.includes('1x BURGER') &&
            actualTickets.includes('1x FRIES');
        return {
            scenarioName: 'Scenario 1: Simple Item Addition',
            steps,
            expectedTickets,
            actualTickets,
            passed,
            details: `Expected 2 new items, got ${newItemsCount}. Kitchen should print basic order.`,
        };
    };
    // Scenario 2: Quantity Updates
    const runScenario2 = () => {
        orderLogger.debug('Testing Scenario 2: Quantity Updates');
        clearTracking();
        const steps = [
            '1. Start with existing order (1x Burger, 1x Fries)',
            '2. Change Burger from 1→3 (+2)',
            '3. Change Fries from 1→2 (+1)',
            '4. Press "Done Adding Items"',
        ];
        // Simulate existing items being updated (not new items)
        trackQuantityChange('existing-burger', 'Burger', 'menu-1', 1, 3);
        trackQuantityChange('existing-fries', 'Fries', 'menu-2', 1, 2);
        const expectedTickets = ['BURGER +2', 'FRIES +1'];
        const actualTickets = generateKitchenTickets();
        const passed = actualTickets.length === 2 &&
            actualTickets.includes('BURGER +2') &&
            actualTickets.includes('FRIES +1') &&
            updatedItemsCount === 2 &&
            newItemsCount === 0;
        return {
            scenarioName: 'Scenario 2: Quantity Updates',
            steps,
            expectedTickets,
            actualTickets,
            passed,
            details: `Expected net changes only. Updates: ${updatedItemsCount}, New: ${newItemsCount}`,
        };
    };
    // Scenario 3: Item Removal
    const runScenario3 = () => {
        orderLogger.debug('Testing Scenario 3: Item Removal');
        clearTracking();
        const steps = [
            '1. Start with order (3x Burger, 2x Fries)',
            '2. Click trash icon on Burger item',
            '3. Confirm removal',
            'Expected: IMMEDIATE removal notification',
        ];
        // Simulate removal of existing item
        trackItemRemoval('existing-burger', 'Burger', 'menu-1', 3);
        const expectedTickets = ['❌ REMOVE: BURGER x3'];
        const actualTickets = generateKitchenTickets();
        const passed = actualTickets.length === 1 &&
            actualTickets.includes('❌ REMOVE: BURGER x3') &&
            removedItemsCount === 1;
        return {
            scenarioName: 'Scenario 3: Item Removal',
            steps,
            expectedTickets,
            actualTickets,
            passed,
            details: `Expected immediate removal notification. Removals: ${removedItemsCount}`,
        };
    };
    // Scenario 4: Mixed Operations - Part A (Initial Order)
    const runScenario4A = () => {
        orderLogger.debug('Testing Scenario 4A: Mixed Operations - Initial Order');
        clearTracking();
        const steps = [
            '1. Start fresh order',
            '2. Add 2x Burger, 1x Fries',
            '3. Press "Done Adding Items"',
            'Expected: Print initial items',
        ];
        trackNewItem('item-1', 'Burger', 'menu-1', 2);
        trackNewItem('item-2', 'Fries', 'menu-2', 1);
        const expectedTickets = ['2x BURGER', '1x FRIES'];
        const actualTickets = generateKitchenTickets();
        const passed = actualTickets.length === 2 &&
            actualTickets.includes('2x BURGER') &&
            actualTickets.includes('1x FRIES');
        return {
            scenarioName: 'Scenario 4A: Mixed Operations - Initial',
            steps,
            expectedTickets,
            actualTickets,
            passed,
            details: 'Initial order items should print normally',
        };
    };
    // Scenario 4: Mixed Operations - Part B (Changes Only)
    const runScenario4B = () => {
        orderLogger.debug('Testing Scenario 4B: Mixed Operations - Changes Only');
        clearTracking();
        const steps = [
            '4. Add 1x Drink',
            '5. Change Burger from 2→4 (existing item)',
            '6. Remove Fries (handled separately)',
            '7. Press "Done Adding Items"',
            'Expected: Only new/changed items',
        ];
        // Add new drink
        trackNewItem('item-3', 'Drink', 'menu-3', 1);
        // Update existing burger
        trackQuantityChange('existing-burger', 'Burger', 'menu-1', 2, 4);
        const expectedTickets = ['1x DRINK', 'BURGER +2'];
        const actualTickets = generateKitchenTickets();
        const passed = actualTickets.length === 2 &&
            actualTickets.includes('1x DRINK') &&
            actualTickets.includes('BURGER +2') &&
            newItemsCount === 1 &&
            updatedItemsCount === 1;
        return {
            scenarioName: 'Scenario 4B: Mixed Operations - Changes',
            steps,
            expectedTickets,
            actualTickets,
            passed,
            details: `Only changes should print. New: ${newItemsCount}, Updates: ${updatedItemsCount}`,
        };
    };
    // Scenario 5: Net Zero Changes
    const runScenario5 = () => {
        orderLogger.debug('Testing Scenario 5: Net Zero Changes');
        clearTracking();
        const steps = [
            '1. Existing item: 2x Burger',
            '2. Change to 5x Burger (+3)',
            '3. Change back to 2x Burger (-3)',
            '4. Press "Done Adding Items"',
            'Expected: No kitchen notification (net 0)',
        ];
        // Simulate quantity changes that net to zero
        trackQuantityChange('existing-burger', 'Burger', 'menu-1', 2, 5);
        trackQuantityChange('existing-burger', 'Burger', 'menu-1', 5, 2);
        const expectedTickets = []; // No changes should be printed
        const actualTickets = generateKitchenTickets();
        const passed = actualTickets.length === 0 && !hasChanges;
        return {
            scenarioName: 'Scenario 5: Net Zero Changes',
            steps,
            expectedTickets,
            actualTickets,
            passed,
            details: `Net zero changes should not print. hasChanges: ${hasChanges}`,
        };
    };
    const runAllKitchenTests = async () => {
        setIsRunning(true);
        const tests = [];
        const scenarios = [
            runScenario1,
            runScenario2,
            runScenario3,
            runScenario4A,
            runScenario4B,
            runScenario5,
        ];
        for (const scenario of scenarios) {
            const result = scenario();
            tests.push(result);
            setCurrentTest(result);
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        setAllTests(tests);
        setIsRunning(false);
        const passedCount = tests.filter(t => t.passed).length;
        orderLogger.debug(`🎯 KITCHEN VALIDATION COMPLETE: ${passedCount}/${tests.length} scenarios passed`);
    };
    const passedTests = allTests.filter(t => t.passed).length;
    const totalTests = allTests.length;
    return (<Card className='mx-auto max-w-5xl p-6'>
      <h2 className='mb-4 text-center text-2xl font-bold'>
        🍽️ Kitchen Ticket Validation Test
      </h2>

      <div className='mb-6 text-center text-sm text-gray-600'>
        Tests exact scenarios from KITCHEN_TICKET_TEST_SCENARIOS.md to ensure
        <br />
        kitchen receives correct, actionable notifications.
      </div>

      <div className='mb-6 flex justify-center space-x-4'>
        <Button onClick={runAllKitchenTests} disabled={isRunning} size='lg'>
          {isRunning ? 'Running Kitchen Tests...' : '🧪 Run Kitchen Validation'}
        </Button>
        <Button onClick={clearTracking} variant='outline'>
          Clear State
        </Button>
      </div>

      {totalTests > 0 && (<div className='mb-6 text-center'>
          <Badge variant={passedTests === totalTests ? 'default' : 'destructive'} className='px-6 py-3 text-xl'>
            Kitchen Tests: {passedTests}/{totalTests} PASSED
            {passedTests === totalTests ? ' ✅' : ' ❌'}
          </Badge>
        </div>)}

      {/* Current Test Display */}
      {currentTest && isRunning && (<Card className='mb-6 border-blue-500 bg-blue-50 p-4'>
          <h3 className='font-semibold text-blue-800'>Currently Testing:</h3>
          <div className='text-blue-700'>{currentTest.scenarioName}</div>
        </Card>)}

      {/* Test Results */}
      {allTests.length > 0 && (<div className='space-y-4'>
          <h3 className='text-lg font-semibold'>Detailed Results:</h3>

          {allTests.map((test, index) => (<Card key={index} className={`p-4 ${test.passed ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
              <div className='mb-3 flex items-center justify-between'>
                <h4 className='font-semibold'>{test.scenarioName}</h4>
                <Badge variant={test.passed ? 'default' : 'destructive'}>
                  {test.passed ? '✅ PASS' : '❌ FAIL'}
                </Badge>
              </div>

              <div className='grid gap-4 text-sm md:grid-cols-2'>
                <div>
                  <strong>Test Steps:</strong>
                  <ul className='mt-1 list-inside list-disc text-gray-700'>
                    {test.steps.map((step, i) => (<li key={i}>{step}</li>))}
                  </ul>
                </div>

                <div>
                  <strong>Kitchen Ticket Expected:</strong>
                  <div className='mt-1 rounded bg-gray-100 p-2 font-mono text-xs text-gray-800'>
                    {test.expectedTickets.length > 0 ? (test.expectedTickets.map((ticket, i) => (<div key={i}>📄 {ticket}</div>))) : (<div className='text-gray-500'>No ticket expected</div>)}
                  </div>

                  <strong className='mt-2 block'>Kitchen Ticket Actual:</strong>
                  <div className={`mt-1 rounded p-2 font-mono text-xs ${test.passed
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'}`}>
                    {test.actualTickets.length > 0 ? (test.actualTickets.map((ticket, i) => (<div key={i}>📄 {ticket}</div>))) : (<div className='text-gray-500'>No ticket generated</div>)}
                  </div>
                </div>
              </div>

              <div className='mt-3 text-sm text-gray-600'>
                <strong>Analysis:</strong> {test.details}
              </div>
            </Card>))}
        </div>)}

      {/* Summary */}
      {allTests.length > 0 && (<Card className='mt-6 bg-gray-50 p-4'>
          <h3 className='mb-2 font-semibold'>Test Summary</h3>
          <div className='space-y-1 text-sm'>
            <div>
              ✅ <strong>Simple Item Addition:</strong>{' '}
              {allTests[0]?.passed ? 'WORKING' : 'BROKEN'}
            </div>
            <div>
              ✅ <strong>Quantity Updates:</strong>{' '}
              {allTests[1]?.passed ? 'WORKING' : 'BROKEN'}
            </div>
            <div>
              ✅ <strong>Item Removal:</strong>{' '}
              {allTests[2]?.passed ? 'WORKING' : 'BROKEN'}
            </div>
            <div>
              ✅ <strong>Mixed Operations:</strong>{' '}
              {allTests[3]?.passed && allTests[4]?.passed
                ? 'WORKING'
                : 'BROKEN'}
            </div>
            <div>
              ✅ <strong>Net Zero Handling:</strong>{' '}
              {allTests[5]?.passed ? 'WORKING' : 'BROKEN'}
            </div>
          </div>

          {passedTests === totalTests && (<div className='mt-4 rounded border border-green-500 bg-green-100 p-3 text-green-800'>
              🎉 <strong>ALL KITCHEN SCENARIOS PASSED!</strong>
              <br />
              Simple tracking system correctly handles all kitchen notification
              requirements.
            </div>)}
        </Card>)}
    </Card>);
}
export default KitchenTicketValidationTest;
