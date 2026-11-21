<script lang="ts">
  /** Start/Stopp, Eingangswahl (Mikrofon, Focusrite, Pod Go …), Kanal und Pegelanzeige. */
  import { onDestroy, onMount } from 'svelte';
  import { load, save } from '../lib/storage';
  import { PitchListener, type InputDevice, type MicError } from '../lib/pitch';
  import type { Messages } from '../i18n/ui';

  interface Props {
    listener: PitchListener;
    t: Messages['mic'];
    startLabel: string;
    stopLabel: string;
    running?: boolean;
    onstart?: () => void;
  }
  let { listener, t, startLabel, stopLabel, running = $bindable(false), onstart }: Props = $props();

  const s = $state(load('gt-mic', { deviceId: '', channel: 0 }));
  $effect(() => save('gt-mic', s));

  let devices = $state<InputDevice[]>([]);
  let error = $state<MicError | null>(null);
  let level = $state(0);
  let activeChannel = $state(1);
  let channels = $state(0);
  let quietSince = $state(0);
  let now = $state(0);

  // Pegel in dB → Balkenbreite (−60 dB … 0 dB)
  const db = $derived(level > 0 ? 20 * Math.log10(level) : -100);
  const meter = $derived(Math.max(0, Math.min(1, (db + 60) / 60)));
  const silent = $derived(running && quietSince > 0 && now - quietSince > 2500);

  onMount(() => {
    listener.onLevel = (l, ch) => {
      level = l;
      activeChannel = ch;
      now = performance.now();
      if (l > 0.0015) quietSince = 0;
      else if (!quietSince) quietSince = now;
    };
    void refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices);
  });
  onDestroy(() => {
    listener.stop();
    listener.onLevel = null;
    navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices);
  });

  async function refreshDevices() {
    devices = await PitchListener.inputs().catch(() => []);
  }

  async function start() {
    listener.deviceId = s.deviceId;
    listener.channel = s.channel;
    error = await listener.start();
    running = !error;
    channels = listener.channels;
    s.deviceId = listener.deviceId; // falls auf Standard zurückgefallen
    quietSince = performance.now();
    await refreshDevices(); // nach der Erlaubnis gibt es echte Gerätenamen
    if (running) onstart?.();
  }

  function stop() {
    listener.stop();
    running = false;
    level = 0;
  }

  async function changeDevice() {
    s.channel = 0;
    if (running) {
      stop();
      await start();
    }
  }

  function changeChannel() {
    listener.channel = s.channel;
  }
</script>

<button class="btn mic" class:ghost={running} onclick={() => (running ? stop() : start())}>{running ? stopLabel : startLabel}</button>

{#if error}
  <p class="msg error">{t[error]}</p>
{/if}

{#if running || devices.length > 1}
  <div class="io">
    <label>
      <span>{t.input}</span>
      <select bind:value={s.deviceId} onchange={changeDevice}>
        <option value="">{t.standard}</option>
        {#each devices.filter((d) => d.id) as d (d.id)}
          <option value={d.id}>{d.label}</option>
        {/each}
      </select>
    </label>
    {#if running && channels > 1}
      <label class="ch">
        <span>{t.channel}</span>
        <select bind:value={s.channel} onchange={changeChannel}>
          <option value={0}>{t.auto}{s.channel === 0 ? ` (${activeChannel})` : ''}</option>
          {#each Array(channels) as _, i}<option value={i + 1}>{i + 1}</option>{/each}
        </select>
      </label>
    {/if}
  </div>
{/if}

{#if running}
  <div class="meter" role="meter" aria-label={t.level} aria-valuemin={-60} aria-valuemax={0} aria-valuenow={Math.round(db)}>
    <span>{t.level}</span>
    <div class="bar"><i style:width="{meter * 100}%" class:hot={db > -3}></i></div>
    <span class="db">{db > -100 ? `${Math.round(db)} dB` : '–'}</span>
  </div>
  <p class="msg">{silent ? t.noSignal : t.tip}</p>
{/if}

<style>
  .btn.mic { display: block; width: 100%; }
  .io { display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
  .io label { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; font-size: 12px; color: var(--muted); }
  .io label.ch { flex: 0 0 96px; }
  select { font: inherit; font-size: 14px; color: var(--text); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 7px 8px; width: 100%; min-width: 0; }
  .meter { display: grid; grid-template-columns: auto 1fr 52px; gap: 10px; align-items: center; margin-top: 12px; font-size: 12px; color: var(--muted); }
  .bar { height: 8px; border-radius: 99px; background: var(--panel2); overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--ok); border-radius: 99px; transition: width 0.05s linear; }
  .bar i.hot { background: #d9534f; }
  .db { text-align: right; font-variant-numeric: tabular-nums; }
  .msg { color: var(--muted); font-size: 12.5px; margin: 8px 0 0; }
  .msg.error { color: #c0392b; font-size: 14px; }
</style>
