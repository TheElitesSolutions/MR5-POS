/**
 * Database Verification Script for Menu Items
 *
 * This script verifies the integrity of menu items in the database:
 * - Checks that all menu items have valid isActive boolean values
 * - Verifies category associations are correct
 * - Reports any data inconsistencies
 * - Optionally fixes common issues
 *
 * Usage:
 *   node scripts/verify-menu-items.js [--fix]
 *
 * Note: This script requires the main process Prisma client
 */

const path = require('path');
const fs = require('fs');

// Load Prisma from the main process
const mainPath = path.join(__dirname, '../main/db/prisma-wrapper');
const { prisma } = require(mainPath);

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}═══ ${msg} ═══${colors.reset}\n`),
};

async function verifyMenuItems(shouldFix = false) {
  const issues = [];

  try {
    log.section('Starting Menu Items Verification');

    // 1. Check all menu items
    log.info('Fetching all menu items...');
    const allMenuItems = await prisma.menuItem.findMany({
      include: {
        category: true,
      },
    });

    log.success(`Found ${allMenuItems.length} menu items`);

    // 2. Verify isActive field
    log.section('Verifying isActive Field');
    const nullIsActiveItems = allMenuItems.filter(item => item.isActive === null || item.isActive === undefined);

    if (nullIsActiveItems.length > 0) {
      log.error(`Found ${nullIsActiveItems.length} items with null/undefined isActive field`);
      nullIsActiveItems.forEach(item => {
        log.warning(`  - ${item.name} (ID: ${item.id})`);
        issues.push({
          type: 'NULL_IS_ACTIVE',
          itemId: item.id,
          itemName: item.name,
          fix: async () => {
            await prisma.menuItem.update({
              where: { id: item.id },
              data: { isActive: true },
            });
          },
        });
      });
    } else {
      log.success('All items have valid isActive values');
    }

    // 3. Verify category associations
    log.section('Verifying Category Associations');
    const orphanedItems = allMenuItems.filter(item => !item.category);

    if (orphanedItems.length > 0) {
      log.error(`Found ${orphanedItems.length} items without valid category association`);
      orphanedItems.forEach(item => {
        log.warning(`  - ${item.name} (ID: ${item.id}, categoryId: ${item.categoryId})`);
        issues.push({
          type: 'ORPHANED_CATEGORY',
          itemId: item.id,
          itemName: item.name,
          categoryId: item.categoryId,
        });
      });
    } else {
      log.success('All items have valid category associations');
    }

    // 4. Check for inactive categories with active items
    log.section('Verifying Category Status Consistency');
    const categories = await prisma.category.findMany({
      include: {
        items: true,
      },
    });

    const inactiveCategoriesWithActiveItems = categories.filter(
      cat => cat.isActive === false && cat.items.some(item => item.isActive === true)
    );

    if (inactiveCategoriesWithActiveItems.length > 0) {
      log.warning(`Found ${inactiveCategoriesWithActiveItems.length} inactive categories with active items`);
      inactiveCategoriesWithActiveItems.forEach(cat => {
        const activeItemCount = cat.items.filter(item => item.isActive).length;
        log.warning(`  - ${cat.name}: ${activeItemCount} active items in inactive category`);
        issues.push({
          type: 'INACTIVE_CATEGORY_WITH_ACTIVE_ITEMS',
          categoryId: cat.id,
          categoryName: cat.name,
          activeItemCount,
        });
      });
    } else {
      log.success('Category status is consistent with item status');
    }

    // 5. Report category statistics
    log.section('Category Statistics');
    for (const category of categories) {
      const totalItems = category.items.length;
      const activeItems = category.items.filter(item => item.isActive).length;
      const status = category.isActive ? colors.green + 'Active' + colors.reset : colors.red + 'Inactive' + colors.reset;

      log.info(`${category.name} (${status}): ${activeItems}/${totalItems} active items`);
    }

    // 6. Check for duplicate menu item names in same category
    log.section('Checking for Duplicate Names');
    const duplicates = [];
    categories.forEach(cat => {
      const names = cat.items.map(item => item.name.toLowerCase());
      const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
      if (duplicateNames.length > 0) {
        duplicates.push({
          category: cat.name,
          duplicates: [...new Set(duplicateNames)],
        });
      }
    });

    if (duplicates.length > 0) {
      log.warning('Found duplicate menu item names within categories:');
      duplicates.forEach(dup => {
        log.warning(`  - ${dup.category}: ${dup.duplicates.join(', ')}`);
      });
    } else {
      log.success('No duplicate menu item names within categories');
    }

    // 7. Apply fixes if requested
    if (shouldFix && issues.length > 0) {
      log.section('Applying Fixes');

      const fixableIssues = issues.filter(issue => issue.fix);
      if (fixableIssues.length > 0) {
        log.info(`Fixing ${fixableIssues.length} issues...`);

        for (const issue of fixableIssues) {
          try {
            await issue.fix();
            log.success(`Fixed: ${issue.type} for ${issue.itemName}`);
          } catch (error) {
            log.error(`Failed to fix ${issue.type} for ${issue.itemName}: ${error.message}`);
          }
        }
      } else {
        log.warning('No auto-fixable issues found');
      }
    }

    // 8. Summary
    log.section('Verification Summary');
    log.info(`Total menu items: ${allMenuItems.length}`);
    log.info(`Active items: ${allMenuItems.filter(item => item.isActive).length}`);
    log.info(`Inactive items: ${allMenuItems.filter(item => !item.isActive).length}`);
    log.info(`Categories: ${categories.length}`);
    log.info(`Active categories: ${categories.filter(cat => cat.isActive).length}`);

    if (issues.length === 0) {
      log.success('\n✨ Database is in good shape! No issues found.');
    } else {
      log.warning(`\n⚠ Found ${issues.length} issues that may need attention`);
      if (!shouldFix) {
        log.info('Run with --fix flag to automatically fix some issues');
      }
    }

  } catch (error) {
    log.error(`Verification failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const shouldFix = process.argv.includes('--fix');

// Run verification
verifyMenuItems(shouldFix)
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
