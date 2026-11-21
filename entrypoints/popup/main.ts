import './style.css';
import { cacheStats, clearCache, enabledSetting } from '@/utils/cache';

const enabled = document.querySelector<HTMLInputElement>('#enabled')!;
const stats = document.querySelector<HTMLParagraphElement>('#stats')!;
const clear = document.querySelector<HTMLButtonElement>('#clear')!;
const reloadHint = document.querySelector<HTMLParagraphElement>('#reload-hint')!;

async function refreshStats() {
  const { found, notFound } = await cacheStats();
  stats.textContent = `${found} wines matched, ${notFound} not found (cached)`;
}

enabled.checked = await enabledSetting.getValue();
enabled.addEventListener('change', async () => {
  await enabledSetting.setValue(enabled.checked);
  reloadHint.hidden = false;
});

clear.addEventListener('click', async () => {
  await clearCache();
  await refreshStats();
});

await refreshStats();
