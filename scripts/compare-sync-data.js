/**
 * Database Comparison Script
 * Compares local SQLite menu data with Supabase PostgreSQL data
 *
 * Usage: node scripts/compare-sync-data.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function compareData() {
  console.log('🔍 Starting database comparison...\n');

  // Connect to local DB
  const dbPath = path.join(process.env.APPDATA, 'mr5-pos', 'mr5-pos.db');
  console.log(`📂 Local DB path: ${dbPath}`);

  let localDb;
  try {
    localDb = new Database(dbPath, { readonly: true });
  } catch (error) {
    console.error('❌ Failed to connect to local database:', error.message);
    console.error('   Make sure the POS app has been run at least once to create the database.');
    return;
  }

  // Connect to Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    console.error('   Required: SUPABASE_URL and SUPABASE_SERVICE_KEY');
    localDb.close();
    return;
  }

  console.log(`🔗 Supabase URL: ${supabaseUrl}\n`);

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // ===== COMPARE CATEGORIES =====
    console.log('=' .repeat(60));
    console.log('📁 CATEGORIES COMPARISON');
    console.log('='.repeat(60));

    const localCategories = localDb.prepare(
      'SELECT name FROM Category WHERE isActive = 1 ORDER BY name'
    ).all();

    const { data: supabaseCategories, error: catError } = await supabase
      .from('category')
      .select('name')
      .order('name');

    if (catError) {
      console.error('❌ Failed to fetch Supabase categories:', catError.message);
    } else {
      console.log(`Local active categories: ${localCategories.length}`);
      console.log(`Supabase categories: ${supabaseCategories?.length || 0}`);

      const localCatNames = new Set(localCategories.map(c => c.name));
      const supabaseCatNames = new Set(supabaseCategories?.map(c => c.name) || []);

      const missingInSupabase = [...localCatNames].filter(n => !supabaseCatNames.has(n));
      const extraInSupabase = [...supabaseCatNames].filter(n => !localCatNames.has(n));

      if (missingInSupabase.length > 0) {
        console.log('\n❌ Missing in Supabase:');
        missingInSupabase.forEach(name => console.log(`   - ${name}`));
      } else {
        console.log('\n✅ All categories synced');
      }

      if (extraInSupabase.length > 0) {
        console.log('\n⚠️  Extra in Supabase (inactive locally?):');
        extraInSupabase.forEach(name => console.log(`   - ${name}`));
      }
    }

    // ===== COMPARE MENU ITEMS =====
    console.log('\n' + '='.repeat(60));
    console.log('🍽️  MENU ITEMS COMPARISON');
    console.log('='.repeat(60));

    const localItems = localDb.prepare(`
      SELECT m.name, c.name as category
      FROM MenuItem m
      JOIN Category c ON m.categoryId = c.id
      WHERE m.isActive = 1 AND c.isActive = 1
      ORDER BY m.name
    `).all();

    const { data: supabaseItems, error: itemError } = await supabase
      .from('item')
      .select('name')
      .order('name');

    if (itemError) {
      console.error('❌ Failed to fetch Supabase items:', itemError.message);
    } else {
      console.log(`Local active items: ${localItems.length}`);
      console.log(`Supabase items: ${supabaseItems?.length || 0}`);

      const localItemNames = new Set(localItems.map(i => i.name));
      const supabaseItemNames = new Set(supabaseItems?.map(i => i.name) || []);

      const missingItems = [...localItemNames].filter(n => !supabaseItemNames.has(n));
      const extraItems = [...supabaseItemNames].filter(n => !localItemNames.has(n));

      if (missingItems.length > 0) {
        console.log('\n❌ Missing in Supabase:');
        missingItems.slice(0, 20).forEach(name => console.log(`   - ${name}`));
        if (missingItems.length > 20) {
          console.log(`   ... and ${missingItems.length - 20} more`);
        }
      } else {
        console.log('\n✅ All items synced');
      }

      if (extraItems.length > 0) {
        console.log('\n⚠️  Extra in Supabase (inactive locally?):');
        extraItems.slice(0, 20).forEach(name => console.log(`   - ${name}`));
        if (extraItems.length > 20) {
          console.log(`   ... and ${extraItems.length - 20} more`);
        }
      }
    }

    // ===== COMPARE ADD-ONS =====
    console.log('\n' + '='.repeat(60));
    console.log('🎨 ADD-ONS COMPARISON');
    console.log('='.repeat(60));

    const localAddons = localDb.prepare(
      'SELECT name FROM Addon WHERE isActive = 1 ORDER BY name'
    ).all();

    const { data: supabaseAddons, error: addonError } = await supabase
      .from('add_on')
      .select('description')
      .order('description');

    if (addonError) {
      console.error('❌ Failed to fetch Supabase add-ons:', addonError.message);
    } else {
      console.log(`Local active add-ons: ${localAddons.length}`);
      console.log(`Supabase add-on records: ${supabaseAddons?.length || 0}`);
      console.log('\n📝 Note: Supabase may have multiple records per add-on');
      console.log('   (one record per category assignment)');

      if (supabaseAddons && supabaseAddons.length > localAddons.length) {
        console.log('\n✅ Add-ons properly distributed across categories');
      }
    }

    // ===== SUMMARY =====
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));

    const syncHealthy =
      missingInSupabase.length === 0 &&
      (missingItems?.length || 0) === 0 &&
      localCategories.length === (supabaseCategories?.length || 0) &&
      localItems.length === (supabaseItems?.length || 0);

    if (syncHealthy) {
      console.log('✅ Sync appears healthy - all local data present in Supabase');
    } else {
      console.log('⚠️  Sync issues detected - discrepancies found');
      console.log('\n   Recommended actions:');
      console.log('   1. Run manual sync from POS app');
      console.log('   2. Check sync logs for errors');
      console.log('   3. Verify Supabase connectivity');
    }

  } catch (error) {
    console.error('\n❌ Comparison failed:', error.message);
  } finally {
    localDb.close();
    console.log('\n✅ Comparison complete\n');
  }
}

// Run comparison
compareData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
