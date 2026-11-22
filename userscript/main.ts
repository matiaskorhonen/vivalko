import { decorate } from '@/utils/decorate';
import { createService } from '@/utils/service';
import { gmFetch } from './gm-fetch';

// A userscript has no background worker: the page runs the lookups itself and reaches
// Vivino through the userscript manager. It lives as long as the page does.
decorate({
  service: createService(gmFetch),
  isValid: () => true,
  onInvalidated: () => {},
});
