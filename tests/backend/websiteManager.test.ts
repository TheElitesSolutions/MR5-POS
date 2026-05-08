/**
 * Smoke tests for WebsiteManagerService.
 * Mocks the HTTPS layer + sharp; asserts the service makes the expected
 * Supabase requests for each public method.
 */

jest.mock('../../main/error-handler', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

jest.mock('../../main/services/supabaseSync', () => ({
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_KEY: 'test-key',
}));

jest.mock('sharp', () => {
  const fakePipeline = {
    rotate: () => fakePipeline,
    resize: () => fakePipeline,
    webp: () => fakePipeline,
    toBuffer: () => Promise.resolve(Buffer.from('webp-bytes')),
  };
  return jest.fn(() => fakePipeline);
});

const recordedRequests: Array<{ method: string; path: string; body: any }> = [];

jest.mock('https', () => {
  return {
    request: (
      options: { method: string; path: string; hostname: string; headers: Record<string, string> },
      onResponse: (res: any) => void,
    ) => {
      const req = {
        on: jest.fn(),
        write: (chunk: any) => {
          try {
            recordedRequests[recordedRequests.length - 1].body = JSON.parse(chunk.toString());
          } catch {
            recordedRequests[recordedRequests.length - 1].body = chunk;
          }
        },
        end: () => {
          // simulate response
          const handlers: Record<string, (data?: any) => void> = {};
          const res = {
            statusCode: 200,
            on: (event: string, handler: (data?: any) => void) => {
              handlers[event] = handler;
            },
          };
          onResponse(res);
          // emit body+end on next tick
          setTimeout(() => {
            handlers.data?.(Buffer.from('[]'));
            handlers.end?.();
          }, 0);
        },
      };
      recordedRequests.push({ method: options.method, path: options.path, body: undefined });
      return req;
    },
  };
});

import { WebsiteManagerService } from '../../main/services/websiteManagerService';

beforeEach(() => {
  recordedRequests.length = 0;
});

describe('WebsiteManagerService', () => {
  test('listItems issues a GET against /rest/v1/item with correct ordering', async () => {
    const svc = new WebsiteManagerService();
    await svc.listItems();
    const get = recordedRequests.find((r) => r.method === 'GET');
    expect(get).toBeDefined();
    expect(get!.path).toContain('/rest/v1/item');
    expect(get!.path).toContain('deleted_at=is.null');
    expect(get!.path).toContain('order=category_id.asc%2Cdisplay_order.asc%2Cid.asc');
  });

  test('reorderItems POSTs to the reorder_items RPC with the full ordered uuid list', async () => {
    const svc = new WebsiteManagerService();
    await svc.reorderItems('cat-uuid', ['a', 'b', 'c'], 'tester');
    const rpcCall = recordedRequests.find((r) => r.path.includes('/rest/v1/rpc/reorder_items'));
    expect(rpcCall).toBeDefined();
    expect(rpcCall!.method).toBe('POST');
    expect(rpcCall!.body).toEqual({ p_category: 'cat-uuid', p_ids: ['a', 'b', 'c'] });
  });

  test('setFeatured PATCHes the item row with is_featured', async () => {
    const svc = new WebsiteManagerService();
    await svc.setFeatured('item-uuid', true, 'tester');
    const patch = recordedRequests.find((r) => r.method === 'PATCH' && r.path.includes('uuid=eq.item-uuid'));
    expect(patch).toBeDefined();
    expect(patch!.body).toEqual({ is_featured: true });
  });

  test('bulkSetVisibility PATCHes with uuid=in.(...) filter', async () => {
    const svc = new WebsiteManagerService();
    await svc.bulkSetVisibility(['a', 'b'], false, 'tester');
    const patch = recordedRequests.find((r) => r.method === 'PATCH' && r.path.includes('uuid=in.'));
    expect(patch).toBeDefined();
    expect(patch!.body).toEqual({ isVisibleOnWebsite: false });
  });

  test('updateSettings PATCHes website_settings id=1', async () => {
    const svc = new WebsiteManagerService();
    await svc.updateSettings({ phone: '+961 70 000 000' }, 'tester');
    const patch = recordedRequests.find((r) => r.method === 'PATCH' && r.path.includes('website_settings'));
    expect(patch).toBeDefined();
    expect(patch!.path).toContain('id=eq.1');
    expect(patch!.body).toEqual({ phone: '+961 70 000 000' });
  });

  test('uploadItemImage PUTs to storage bucket and PATCHes the item row', async () => {
    const svc = new WebsiteManagerService();
    await svc.uploadItemImage('item-uuid', Buffer.from('jpeg-bytes'), 'image/jpeg', 'tester');
    const put = recordedRequests.find((r) => r.method === 'PUT' && r.path.includes('/storage/v1/object/menu-images/items/item-uuid.webp'));
    expect(put).toBeDefined();
    const patch = recordedRequests.find((r) => r.method === 'PATCH' && r.path.includes('uuid=eq.item-uuid'));
    expect(patch).toBeDefined();
    expect((patch!.body as any).image_url).toContain('/storage/v1/object/public/menu-images/items/item-uuid.webp');
    expect((patch!.body as any).image_lqip).toMatch(/^data:image\/webp;base64,/);
  });
});
