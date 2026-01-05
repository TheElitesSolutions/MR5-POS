/**
 * Fix supabase upsert to add Prefer: resolution=merge-duplicates header
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'main', 'services', 'supabaseSync.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Fix 1: Add customHeaders parameter to request method signature
content = content.replace(
  'private async request(method: string, path: string, body?: any): Promise<any>',
  'private async request(method: string, path: string, body?: any, customHeaders?: Record<string, string>): Promise<any>'
);

// Fix 2: Merge customHeaders into headers object
content = content.replace(
  `        headers: {
          'apikey': this.apiKey,
          'Authorization': \`Bearer \${this.apiKey}\`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },`,
  `        headers: {
          'apikey': this.apiKey,
          'Authorization': \`Bearer \${this.apiKey}\`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
          ...customHeaders,  // Merge custom headers (can override Prefer)
        },`
);

// Fix 3: Update upsert method to pass Prefer header
content = content.replace(
  `          const data = await this.request('POST', \`/rest/v1/\${table}\${queryString}\`, records);`,
  `          // Add Prefer header for upsert to work correctly (merge on conflict)
          const data = await this.request('POST', \`/rest/v1/\${table}\${queryString}\`, records, {
            'Prefer': 'resolution=merge-duplicates'
          });`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Fixed upsert header in supabaseSync.ts');
