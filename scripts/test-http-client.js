/**
 * Test Script: SupabaseHTTPClient Direct Test
 * Purpose: Verify HTTP client sends correct minimal payload
 * Date: 2026-01-04
 */

const https = require('https');

const SUPABASE_URL = 'https://buivobulqaryifxesvqo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1aXZvYnVscWFyeWlmeGVzdnFvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDcyNDUxNSwiZXhwIjoyMDY2MzAwNTE1fQ.-G0GXB57aRlD9VldrkTeBb_l5lDlkXl385-qYpgdpoE';

class SupabaseHTTPClient {
  constructor(url, apiKey) {
    this.baseUrl = url;
    this.apiKey = apiKey;
  }

  async request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      console.log(`\n🔍 [REQUEST] ${method} ${url.pathname}${url.search}`);

      if (body) {
        console.log(`📦 [PAYLOAD]:`, JSON.stringify(body, null, 2));
      }

      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Prefer': 'return=representation',
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          console.log(`✅ [RESPONSE] Status: ${res.statusCode}`);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = data ? JSON.parse(data) : null;
              console.log(`📥 [DATA]:`, parsed);
              resolve(parsed);
            } catch (e) {
              resolve(data);
            }
          } else {
            console.error(`❌ [ERROR] ${res.statusCode}: ${data}`);
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (e) => {
        console.error(`❌ [REQUEST ERROR]:`, e.message);
        reject(e);
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  from(table) {
    return {
      upsert: async (records, options) => {
        const conflictParam = options?.onConflict ? `?on_conflict=${options.onConflict}` : '';
        console.log(`\n🎯 UPSERT to '${table}' with onConflict: ${options?.onConflict || 'none'}`);
        const data = await this.request('POST', `/rest/v1/${table}${conflictParam}`, records);
        return { data, error: null };
      },
    };
  }
}

async function testCategoryUpsert() {
  console.log('═══════════════════════════════════════════');
  console.log('  Testing Category Upsert with Minimal Payload');
  console.log('═══════════════════════════════════════════\n');

  const client = new SupabaseHTTPClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    // Test 1: Upsert with only name field
    console.log('\n📋 Test 1: Upsert category with ONLY name field');
    console.log('─────────────────────────────────────────');
    const result1 = await client.from('category').upsert({
      name: `Test Category ${Date.now()}`,
    }, { onConflict: 'name' });

    console.log('\n✅ Test 1 PASSED: Category upserted successfully');

    // Test 2: Upsert existing category (update)
    console.log('\n\n📋 Test 2: Update existing category by name');
    console.log('─────────────────────────────────────────');
    const result2 = await client.from('category').upsert({
      name: 'Test Category',  // Assume this exists
    }, { onConflict: 'name' });

    console.log('\n✅ Test 2 PASSED: Category updated successfully');

    console.log('\n\n═══════════════════════════════════════════');
    console.log('  ✅ ALL TESTS PASSED');
    console.log('═══════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n\n❌ TEST FAILED:');
    console.error('Error:', error.message);

    if (error.message.includes('PGRST204')) {
      console.error('\n🔍 PGRST204 Error Detected!');
      console.error('This means PostgREST cannot find a column in the schema cache.');
      console.error('Check the error message for which column is missing.');
    }

    process.exit(1);
  }
}

testCategoryUpsert();
