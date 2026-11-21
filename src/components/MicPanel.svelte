<script lang="ts">
  /**
   * Mikrofon an/aus für Stimmgerät und Tonfinder – kompakt.
   * Eingang und Kanal werden in den Einstellungen gewählt (gespeichert unter „gt-mic“).
   */
  import { onDestroy, onMount } from 'svelte';
  import { load, save } from '../lib/storage';
  import { GATE, PitchListener, type MicError } from '../lib/pitch';
  import type { Messages } from '../i18n/ui';

  interface Props {
    listener: PitchListener;
    t: Messages['mic'];
    startLabel: string;
    stopLabel: string;
    settingsHref: string;
    running?: boolean;
    onstart?: () => void;
  }
  let { listener, t, startLabel, stopLabel, settingsHref, running = $bindable(false), onstart }: Props = $props();

  let error = $state<MicError | null>(null);
  let level = $state(0);
  let label = $state('');
  let channel = $state(1);
  let suggest = $state(0);
  let suggestSince = 0;
  let quietSince = $state(0);
  let now = $state(0);
  const silent = $derived(running && quietSince > 0 && now - quietSince > 2500);
  const db = $derived(level > 0 ? 20 * Math.log10(level) : -100);

  onMount(() => {
    listener.onLevel = (levels) => {
      const ch = Math.min(channel, levels.length) - 1;
      level = levels[ch];
      now = performance.now();
      if (level > GATE) quietSince = 0;
      else if (!quietSince) quietSince = now;
      const other = levels.reduce((b, l, i) => (i !== ch && l > (b < 0 ? 0 : levels[b]) ? i : b), -1);
      if (level < GATE && other >= 0 && levels[other] > GATE * 3) {
        if (!suggestSince) suggestSince = now;
        if (now - suggestSince > 1000) suggest = other + 1;
      } else {
        suggestSince = 0;
        suggest = 0;
      }
    };
  });
  onDestroy(() => {
    listener.stop();
    listener.onLevel = null;
  });

  async function start() {
    // Immer frisch lesen – die Einstellungen können sich auf der Einstellungsseite geändert haben
    const cfg = load('gt-mic', { deviceId: '', channel: 1, channels: 2 });
    channel = cfg.channel >= 1 ? cfg.channel : 1;
    listener.deviceId = cfg.deviceId;
    listener.channel = channel;
    error = await listener.start();
    running = !error;
    if (running) {
      label = listener.deviceLabel;
      save('gt-mic', { ...cfg, deviceId: listener.deviceId, channel, channels: listener.channels });
      quietSince = performance.now();
      onstart?.();
    }
  }

  function stop() {
    listener.stop();
    running = false;
    level = 0;
    suggest = 0;
  }

  function switchTo(ch: number) {
    channel = ch;
    listener.channel = ch;
    suggest = 0;
    suggestSince = 0;
    const cfg = load('gt-mic', { deviceId: '', channel: 1, channels: 2 });
    save('gt-mic', { ...cfg, channel: ch });
  }
</script>

<button class="btn mic" class:ghost={running} onclick={() => (running ? stop() : start())}>{running ? stopLabel : startLabel}</button>

{#if error}
  <p class="msg error">{t[error]} <a href={settingsHref}>{t.change}</a></p>
{:else if running}
  <p class="status">
    <i class="dot" class:on={db > -55} style:opacity={0.35 + Math.max(0, Math.min(1, (db + 60) / 50)) * 0.65}></i>
    <span class="name">{label || t.standard}{listener.channels > 1 ? ` · ${t.channel} ${channel}` : ''}</span>
    <a href={settingsHref}>{t.change}</a>
  </p>
  {#if suggest}
    <button class="btn ghost switch" onclick={() => switchTo(suggest)}>{t.switchTo.replace('{n}', String(suggest))}</button>
  {:else if silent}
    <p class="msg">{t.noSignal}</p>
  {/if}
{/if}

<style>
  .btn.mic { display: block; width: 100%; }
  .status { display: flex; align-items: center; gap: 8px; margin: 10px 0 0; font-size: 13px; color: var(--muted); min-width: 0; }
  .status .name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .status a { color: var(--accent); white-space: nowrap; font-size: 12.5px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--line); flex-shrink: 0; transition: opacity 0.05s; }
  .dot.on { background: var(--ok); }
  .btn.switch { display: block; width: 100%; margin-top: 10px; font-size: 14px; padding: 9px; border-color: var(--accent); color: var(--accent); }
  .msg { color: var(--muted); font-size: 12.5px; margin: 8px 0 0; }
  .msg.error { color: #c0392b; font-size: 14px; }
  .msg a { color: var(--accent); }
</style>
