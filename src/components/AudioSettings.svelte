<script lang="ts">
  /** Einstellungsseite: Audio-Eingang (Mikrofon, Focusrite, Pod Go …) wählen und testen. */
  import { onDestroy, onMount } from 'svelte';
  import { load, save } from '../lib/storage';
  import { GATE, PitchListener, type InputDevice, type MicError, type Pitch } from '../lib/pitch';
  import { NOTE_NAMES } from '../lib/music';
  import type { Lang, Messages } from '../i18n/ui';

  let { t, lang }: { t: Messages['mic']; lang: Lang } = $props();

  const s = $state(load('gt-mic', { deviceId: '', channel: 1, channels: 2 }));
  if (!(s.channel >= 1)) s.channel = 1;
  $effect(() => save('gt-mic', s));

  let pitch = $state<Pitch | null>(null);
  const listener = new PitchListener((p) => (pitch = p));

  let devices = $state<InputDevice[]>([]);
  let testing = $state(false);
  let error = $state<MicError | null>(null);
  let level = $state(0);
  let suggest = $state(0);
  let suggestSince = 0;
  let quietSince = $state(0);
  let now = $state(0);

  const db = $derived(level > 0 ? 20 * Math.log10(level) : -100);
  const meter = $derived(Math.max(0, Math.min(1, (db + 60) / 60)));
  const silent = $derived(testing && quietSince > 0 && now - quietSince > 2500);
  const names = $derived(NOTE_NAMES[lang]);

  onMount(() => {
    listener.onLevel = (levels) => {
      const ch = Math.min(s.channel, levels.length) - 1;
      level = levels[ch];
      now = performance.now();
      if (level > GATE) quietSince = 0;
      else if (!quietSince) quietSince = now;
      // Gewählter Kanal still, ein anderer hat Signal → nach 1 s Umschalten vorschlagen
      const other = levels.reduce((b, l, i) => (i !== ch && l > (b < 0 ? 0 : levels[b]) ? i : b), -1);
      if (level < GATE && other >= 0 && levels[other] > GATE * 3) {
        if (!suggestSince) suggestSince = now;
        if (now - suggestSince > 1000) suggest = other + 1;
      } else {
        suggestSince = 0;
        suggest = 0;
      }
    };
    void refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices);
  });
  onDestroy(() => {
    listener.stop();
    navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices);
  });

  async function refreshDevices() {
    devices = await PitchListener.inputs().catch(() => []);
  }

  async function startTest() {
    listener.deviceId = s.deviceId;
    listener.channel = s.channel;
    error = await listener.start();
    testing = !error;
    if (testing) {
      s.channels = listener.channels;
      if (s.channel > s.channels) s.channel = 1;
    }
    s.deviceId = listener.deviceId;
    quietSince = performance.now();
    await refreshDevices(); // nach der Erlaubnis gibt es echte Gerätenamen
  }

  function stopTest() {
    listener.stop();
    testing = false;
    level = 0;
    pitch = null;
    suggest = 0;
  }

  async function changeDevice() {
    s.channel = 1;
    if (testing) {
      stopTest();
      await startTest();
    }
  }

  function setChannel(ch: number) {
    s.channel = ch;
    listener.channel = ch;
    suggest = 0;
    suggestSince = 0;
  }
</script>

<div class="field">
  <label for="audio-in">{t.input}</label>
  <select id="audio-in" bind:value={s.deviceId} onchange={changeDevice}>
    <option value="">{t.standard}</option>
    {#each devices.filter((d) => d.id) as d (d.id)}
      <option value={d.id}>{d.label}</option>
    {/each}
  </select>
</div>
<div class="field">
  <span>{t.channel}</span>
  <div class="seg small" role="radiogroup" aria-label={t.channel}>
    {#each Array(Math.max(1, s.channels)) as _, i}
      <button type="button" role="radio" aria-checked={s.channel === i + 1} class:active={s.channel === i + 1} onclick={() => setChannel(i + 1)}>{i + 1}</button>
    {/each}
  </div>
</div>
<p class="msg">{t.channelHint}</p>

<button class="btn" class:ghost={testing} onclick={() => (testing ? stopTest() : startTest())}>{testing ? t.testStop : t.test}</button>
{#if error}<p class="msg error">{t[error]}</p>{/if}

{#if testing}
  <div class="meter" role="meter" aria-label={t.level} aria-valuemin={-60} aria-valuemax={0} aria-valuenow={Math.round(db)}>
    <span>{t.level}</span>
    <div class="bar"><i style:width="{meter * 100}%" class:hot={db > -3}></i></div>
    <span class="db">{db > -100 ? `${Math.round(db)} dB` : '–'}</span>
  </div>
  <p class="heard">{t.detected}: <b>{pitch ? `${names[pitch.midi % 12]}${Math.floor(pitch.midi / 12) - 1}` : '–'}</b></p>
  {#if suggest}
    <button class="btn ghost switch" onclick={() => setChannel(suggest)}>{t.switchTo.replace('{n}', String(suggest))}</button>
  {:else}
    <p class="msg">{silent ? t.noSignal : t.tip}</p>
  {/if}
{/if}

<style>
  select { font: inherit; font-size: 14px; color: var(--text); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 7px 8px; max-width: 260px; width: 100%; min-width: 0; }
  .btn { margin-top: 12px; }
  .meter { display: grid; grid-template-columns: auto 1fr 52px; gap: 10px; align-items: center; margin-top: 14px; font-size: 12px; color: var(--muted); }
  .bar { height: 8px; border-radius: 99px; background: var(--panel2); overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--ok); border-radius: 99px; transition: width 0.05s linear; }
  .bar i.hot { background: #d9534f; }
  .db { text-align: right; font-variant-numeric: tabular-nums; }
  .heard { margin: 10px 0 0; color: var(--muted); }
  .heard b { color: var(--text); font-size: 18px; }
  .btn.switch { display: block; width: 100%; font-size: 14px; padding: 9px; border-color: var(--accent); color: var(--accent); }
  .msg { color: var(--muted); font-size: 12.5px; margin: 8px 0 0; }
  .msg.error { color: #c0392b; font-size: 14px; }
</style>
