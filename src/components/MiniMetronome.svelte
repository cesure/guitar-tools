<script lang="ts">
  /** Kleine Metronom-Leiste auf allen anderen Seiten, solange das Metronom läuft. */
  import { clampBpm, metronome as m } from '../lib/metronome-store.svelte';
  import type { Messages } from '../i18n/ui';

  let { t, href }: { t: Messages['metronome']; href: string } = $props();
  const s = m.s;
</script>

{#if m.running}
  <div class="mini" role="group" aria-label={t.title}>
    <a class="info" {href} title={t.open}>
      <i class:on={m.beat === 0} class:beat={m.beat > 0}></i>
      <strong>{s.bpm}</strong> <span>{t.bpm}</span>
    </a>
    <button class="r" onclick={() => (s.bpm = clampBpm(s.bpm - 1))} aria-label={t.slower}>−</button>
    <button class="r" onclick={() => (s.bpm = clampBpm(s.bpm + 1))} aria-label={t.faster}>+</button>
    <button class="r stop" onclick={() => m.stop()} aria-label={t.stop}>■</button>
  </div>
{/if}

<style>
  .mini {
    position: fixed; right: 20px; bottom: 20px; z-index: 20;
    display: flex; align-items: center; gap: 6px; padding: 6px 6px 6px 14px;
    background: var(--panel); border: 1px solid var(--line); border-radius: 999px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
  }
  .info { display: flex; align-items: center; gap: 6px; color: var(--text); text-decoration: none; margin-right: 4px; font-variant-numeric: tabular-nums; }
  .info span { color: var(--muted); font-size: 12px; }
  .info strong { font-size: 18px; min-width: 3ch; text-align: right; }
  i { width: 10px; height: 10px; border-radius: 50%; background: var(--panel2); border: 1px solid var(--line); }
  i.on { background: var(--accent); border-color: var(--accent); }
  i.beat { background: var(--text); }
  .r { all: unset; cursor: pointer; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; border: 1px solid var(--line); background: var(--bg); font-size: 16px; }
  .r.stop { font-size: 12px; }
  .r:focus-visible { outline: 2px solid var(--accent); }
  @media (max-width: 720px) {
    .mini { right: 12px; bottom: calc(80px + env(safe-area-inset-bottom)); }
  }
</style>
