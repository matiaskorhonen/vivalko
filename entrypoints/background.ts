import { createService } from '@/utils/service';
import type { Message } from '@/utils/types';

export default defineBackground(() => {
  const service = createService();

  /** Every reply has the same shape: `{ ok: true, result }` or `{ ok: false, error }`. */
  function respond<T>(p: Promise<T>) {
    return p.then(
      (result) => ({ ok: true as const, result }),
      (err: unknown) => ({ ok: false as const, error: String(err) }),
    );
  }

  /**
   * Shows the red icon in one tab. Tab-specific icons are cleared when the tab navigates,
   * so leaving Alko.fi reverts to the grey default.
   */
  function markActive(tabId: number) {
    // Firefox MV2 only has `browserAction`.
    const action = browser.action ?? browser.browserAction;
    action
      .setIcon({ tabId, path: { 16: '/icon/16.png', 32: '/icon/32.png' } })
      // The tab may have closed in the meantime.
      .catch(() => {});
  }

  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    const msg = message as Message;
    switch (msg?.type) {
      case 'vivalko:active':
        if (sender.tab?.id !== undefined) markActive(sender.tab.id);
        return undefined;
      case 'vivalko:lookup':
        return respond(service.lookup(msg.product));
      case 'vivalko:image':
        return respond(service.image(msg.url));
      case 'vivalko:grapes':
        return respond(service.grapes(msg.ids));
      default:
        return undefined;
    }
  });
});
