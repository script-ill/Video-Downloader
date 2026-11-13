import fs from 'fs';
import path from 'path';
import { Innertube, Platform, UniversalCache } from 'youtubei.js';
import { BotGuardClient } from 'bgutils-js/botguard';
import { base64ToU8, u8ToBase64 } from 'bgutils-js/utils';
import { JSDOM, VirtualConsole } from 'jsdom';

// Configure youtubei.js custom JS evaluator for deciphering signatures & n-sig
Platform.shim.eval = async (data: { output: string }) => {
  return new Function(data.output)();
};

export const USER_COOKIES_PATH = path.join('/tmp', 'streamgrab_cookies.txt');

export function hasUserCookies(): boolean {
  try {
    return fs.existsSync(USER_COOKIES_PATH) && fs.statSync(USER_COOKIES_PATH).size > 20;
  } catch {
    return false;
  }
}

export function saveUserCookies(cookiesText: string): void {
  const trimmed = cookiesText.trim();
  cachedSession = null;
  sessionInitPromise = null;
  ytInfoCache.clear();
  if (!trimmed) {
    if (fs.existsSync(USER_COOKIES_PATH)) fs.unlinkSync(USER_COOKIES_PATH);
    return;
  }
  fs.writeFileSync(USER_COOKIES_PATH, trimmed, 'utf-8');
}

export function getYouTubeCookieHeader(): string | undefined {
  if (!hasUserCookies()) return undefined;
  try {
    const raw = fs.readFileSync(USER_COOKIES_PATH, 'utf-8');
    const pairs: string[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split('\t');
      if (parts.length >= 7) {
        const domain = parts[0].toLowerCase();
        if (domain.includes('youtube.com') || domain.includes('google.com')) {
          pairs.push(`${parts[5]}=${parts[6]}`);
        }
      }
    }
    return pairs.length > 0 ? pairs.join('; ') : undefined;
  } catch {
    return undefined;
  }
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return 'Variable size';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0 || isNaN(seconds)) return '00:00';
  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================================================
// YOUTUBE ENGINE (youtubei.js + bgutils-js BotGuard PO Token)
// ============================================================================

interface YouTubeSession {
  yt: Innertube;
  mintCallback: (contentBinding: Uint8Array) => Promise<Uint8Array | undefined>;
  visitorData: string;
  sessionPoToken: string;
  createdAt: number;
}

const YT_SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
let cachedSession: YouTubeSession | null = null;
let sessionInitPromise: Promise<YouTubeSession> | null = null;

interface CachedVideoEntry {
  expiresAt: number;
  info: any;
  pot: string;
  metadata: any;
}
const ytInfoCache = new Map<string, CachedVideoEntry>();

export function extractYouTubeVideoId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl.trim());
    const host = u.hostname.toLowerCase();
    if (host.includes('youtu.be')) {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
      const vParam = u.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) return vParam;
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && ['shorts', 'embed', 'live', 'v'].includes(parts[0])) {
        if (/^[a-zA-Z0-9_-]{11}$/.test(parts[1])) return parts[1];
      }
    }
  } catch {
    // fallback regex
  }
  const m = rawUrl.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function createYouTubeSession(): Promise<YouTubeSession> {
  const virtualConsole = new VirtualConsole();
  // Silence non-fatal JSDOM not-implemented warnings (e.g., canvas.getContext)
  virtualConsole.on('jsdomError', () => {});

  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'https://www.youtube.com',
    pretendToBeVisual: true,
    runScripts: 'dangerously',
    virtualConsole,
  });

  if (dom.window.HTMLCanvasElement) {
    dom.window.HTMLCanvasElement.prototype.getContext = (() => null) as any;
  }

  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
  });

  const cacheDir = '/tmp/yt_cache';
  fs.mkdirSync(cacheDir, { recursive: true });
  const cache = new UniversalCache(true, cacheDir);

  const bootstrapYt = await Innertube.create({ retrieve_player: false, cache });
  const challenge = await bootstrapYt.getAttestationChallenge('ENGAGEMENT_TYPE_UNBOUND');

  if (!challenge.bg_challenge) {
    throw new Error('Could not retrieve BotGuard challenge from YouTube');
  }

  const interpreterUrl =
    challenge.bg_challenge.interpreter_url?.private_do_not_access_or_else_trusted_resource_url_wrapped_value;
  if (!interpreterUrl) {
    throw new Error('Missing BotGuard interpreter URL');
  }

  const fullInterpreterUrl = interpreterUrl.startsWith('//') ? `https:${interpreterUrl}` : interpreterUrl;
  const bgScriptRes = await fetch(fullInterpreterUrl);
  const interpreterJavascript = await bgScriptRes.text();

  const scriptEl = dom.window.document.createElement('script');
  scriptEl.textContent = interpreterJavascript;
  dom.window.document.head.appendChild(scriptEl);

  const botguard = await BotGuardClient.create({
    globalName: challenge.bg_challenge.global_name,
    globalObject: dom.window,
    program: challenge.bg_challenge.program,
  });

  const webPoSignalOutput: any[] = [];
  const botguardResponse = await botguard.snapshot({ webPoSignalOutput });

  const itRes = await fetch('https://jnn-pa.googleapis.com/$rpc/google.internal.waa.v1.Waa/GenerateIT', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json+protobuf',
      'x-goog-api-key': 'AIzaSyDyT5W0Jh49F30Pqqtyfdf7pDLFKLJoAnw',
      'x-user-agent': 'grpc-web-javascript/0.1',
    },
    body: JSON.stringify(['O43z0dpjhgX20SCx4KAo', botguardResponse]),
  });

  const itJson = (await itRes.json()) as any[];
  if (!itJson?.[0] || !webPoSignalOutput[0]) {
    throw new Error('Failed to generate YouTube Integrity Token');
  }

  const mintCallback = await webPoSignalOutput[0](base64ToU8(itJson[0]));
  if (typeof mintCallback !== 'function') {
    throw new Error('BotGuard minter callback unavailable');
  }

  const visitorData =
    bootstrapYt.session.context.client.visitorData || (challenge as any).visitor_data || '';
  const sessionU8 = await mintCallback(new TextEncoder().encode(visitorData));
  if (!sessionU8) {
    throw new Error('Failed to mint session PO token');
  }
  const sessionPoToken = u8ToBase64(new Uint8Array(sessionU8), true);

  const yt = await Innertube.create({
    po_token: sessionPoToken,
    visitor_data: visitorData,
    cookie: getYouTubeCookieHeader(),
    generate_session_locally: true,
    cache,
  });

  const session: YouTubeSession = {
    yt,
    mintCallback,
    visitorData,
    sessionPoToken,
    createdAt: Date.now(),
  };

  cachedSession = session;
  return session;
}

export async function getYouTubeSession(forceRefresh = false): Promise<YouTubeSession> {
  if (!forceRefresh && cachedSession && Date.now() - cachedSession.createdAt < YT_SESSION_TTL_MS) {
    return cachedSession;
  }
  if (!sessionInitPromise || forceRefresh) {
    sessionInitPromise = createYouTubeSession().finally(() => {
      sessionInitPromise = null;
    });
  }
  return sessionInitPromise;
}

async function getYouTubeInfoCached(videoId: string): Promise<CachedVideoEntry & { session: YouTubeSession }> {
  const session = await getYouTubeSession();
  const cached = ytInfoCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached, session };
  }

  let info = await session.yt.getBasicInfo(videoId, { client: 'MWEB' });
  if (info.playability_status?.status !== 'OK' || !info.streaming_data) {
    // Try WEB client fallback once
    const webInfo = await session.yt.getBasicInfo(videoId, { client: 'WEB' });
    if (webInfo.playability_status?.status === 'OK' && webInfo.streaming_data) {
      info = webInfo;
    }
  }

  if (info.playability_status?.status !== 'OK' || !info.streaming_data) {
    throw new Error(
      info.playability_status?.reason ||
        `YouTube video is unavailable (${info.playability_status?.status || 'UNKNOWN'})`
    );
  }

  const potU8 = await session.mintCallback(new TextEncoder().encode(videoId));
  const pot = potU8 ? u8ToBase64(new Uint8Array(potU8), true) : session.sessionPoToken;

  const entry: CachedVideoEntry = {
    expiresAt: Date.now() + 10 * 60 * 1000,
    info,
    pot,
    metadata: null,
  };
  ytInfoCache.set(videoId, entry);
  return { ...entry, session };
}

export async function extractYouTubeMetadata(videoId: string, originalUrl: string) {
  const entry = await getYouTubeInfoCached(videoId);
  if (entry.metadata) {
    return entry.metadata;
  }

  const { info } = entry;
  const basic = info.basic_info || {};
  const duration = basic.duration || 0;
  const durationFormatted = formatDuration(duration);

  const muxedFormats: any[] = info.streaming_data?.formats || [];
  const adaptiveFormats: any[] = info.streaming_data?.adaptive_formats || [];
  const allVideoFormats = [...muxedFormats, ...adaptiveFormats].filter(
    (f) => f.has_video && (f.url || f.signature_cipher || f.cipher)
  );
  const audioOnlyFormats = adaptiveFormats.filter(
    (f) => f.has_audio && !f.has_video && (f.url || f.signature_cipher || f.cipher)
  );

  const heights = new Set<number>();
  for (const f of allVideoFormats) {
    const eff = f.height && f.width ? Math.min(f.height, f.width) : f.height || 0;
    if (eff > 0) heights.add(eff);
  }
  const sortedHeights = Array.from(heights).sort((a, b) => b - a);

  const formattedList: any[] = [];

  // 1. Instant Fast Download (pre-muxed MP4)
  const bestMuxed = muxedFormats[muxedFormats.length - 1] || muxedFormats[0];
  const muxedSize = bestMuxed?.content_length || (duration > 0 ? Math.round((850 * 1024 * duration) / 8) : null);
  const muxedHeight = bestMuxed?.height || sortedHeights[sortedHeights.length - 1] || 360;

  formattedList.push({
    id: 'fast-direct',
    label: 'Fast Download (Instant MP4)',
    resolution: `${muxedHeight}p Instant`,
    ext: 'mp4',
    filesize: muxedSize,
    filesizeFormatted: formatBytes(muxedSize),
    fps: bestMuxed?.fps || 30,
    hasAudio: true,
    hasVideo: true,
    isAudioOnly: false,
    quality: `${muxedHeight}p`,
    tag: 'Fastest',
  });

  // 2. Real Adaptive Video Quality Tiers
  const targetQualities = [
    { height: 2160, minReq: 1900, label: '4K Ultra HD (2160p)', tag: 'Ultra HD' },
    { height: 1440, minReq: 1300, label: '2K Quad HD (1440p)', tag: 'High-Res' },
    { height: 1080, minReq: 900, label: 'Full HD 1080p', tag: 'Recommended' },
    { height: 720, minReq: 600, label: 'HD 720p', tag: 'Standard HD' },
    { height: 480, minReq: 400, label: 'SD 480p', tag: 'Data Saver' },
    { height: 360, minReq: 250, label: '360p Standard', tag: 'Compact' },
  ];

  const bestAudio = audioOnlyFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
  const audioBytes = bestAudio?.content_length || (duration > 0 ? Math.round((160 * 1024 * duration) / 8) : 0);

  for (const tier of targetQualities) {
    const matching = allVideoFormats
      .filter((f) => {
        const eff = f.height && f.width ? Math.min(f.height, f.width) : f.height || 0;
        return eff >= tier.minReq && eff <= tier.height * 1.15;
      })
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    if (matching.length > 0) {
      const preferred =
        matching.find((f) => String(f.mime_type || '').includes('mp4')) || matching[0];
      let estSize: number | null = preferred.content_length ? preferred.content_length + audioBytes : null;
      if (!estSize && duration > 0) {
        const bps = preferred.bitrate || (tier.height >= 2160 ? 12_000_000 : tier.height >= 1440 ? 6_000_000 : tier.height >= 1080 ? 3_500_000 : tier.height >= 720 ? 1_800_000 : 900_000);
        estSize = Math.round((bps * duration) / 8) + audioBytes;
      }

      formattedList.push({
        id: `best-${tier.height}`,
        label: tier.label,
        resolution: `${tier.height}p`,
        ext: 'mp4',
        filesize: estSize,
        filesizeFormatted: formatBytes(estSize),
        fps: preferred.fps || 30,
        hasAudio: true,
        hasVideo: true,
        isAudioOnly: false,
        quality: `${tier.height}p`,
        tag: tier.tag,
      });
    }
  }

  // 3. Audio Extractions
  const audioSize320 = duration > 0 ? Math.round((320 * 1024 * duration) / 8) : null;
  const audioSizeM4a = bestAudio?.content_length || (duration > 0 ? Math.round((192 * 1024 * duration) / 8) : null);
  const audioSize128 = duration > 0 ? Math.round((128 * 1024 * duration) / 8) : null;

  formattedList.push(
    {
      id: 'audio-mp3-320',
      label: 'MP3 Audio (320 kbps Extreme HQ)',
      resolution: 'Audio Only',
      ext: 'mp3',
      filesize: audioSize320,
      filesizeFormatted: formatBytes(audioSize320),
      hasAudio: true,
      hasVideo: false,
      isAudioOnly: true,
      quality: '320kbps',
      tag: 'Studio Master',
    },
    {
      id: 'audio-m4a',
      label: 'M4A / AAC Audio (Original Lossless)',
      resolution: 'Audio Only',
      ext: 'm4a',
      filesize: audioSizeM4a,
      filesizeFormatted: formatBytes(audioSizeM4a),
      hasAudio: true,
      hasVideo: false,
      isAudioOnly: true,
      quality: 'Lossless',
      tag: 'Apple Compatible',
    },
    {
      id: 'audio-mp3-128',
      label: 'MP3 Audio (128 kbps Standard)',
      resolution: 'Audio Only',
      ext: 'mp3',
      filesize: audioSize128,
      filesizeFormatted: formatBytes(audioSize128),
      hasAudio: true,
      hasVideo: false,
      isAudioOnly: true,
      quality: '128kbps',
      tag: 'Lightweight',
    }
  );

  const thumbList = basic.thumbnail || [];
  const bestThumb =
    thumbList[0]?.url ||
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

  const metadata = {
    id: videoId,
    url: originalUrl,
    title: basic.title || 'YouTube Video',
    description: (basic.short_description || '').slice(0, 350),
    thumbnail: bestThumb,
    uploader: basic.author || basic.channel?.name || 'YouTube Creator',
    uploaderUrl: basic.channel_id ? `https://www.youtube.com/channel/${basic.channel_id}` : '',
    duration,
    durationFormatted,
    viewCount: basic.view_count,
    likeCount: basic.like_count,
    platform: 'youtube',
    formats: formattedList,
    previewUrl: `/api/preview?url=${encodeURIComponent(originalUrl)}`,
  };

  entry.metadata = metadata;
  return metadata;
}

export interface ResolvedYouTubeDownload {
  mode: 'direct' | 'mux' | 'audio';
  videoUrl?: string;
  audioUrl?: string;
  videoExt?: string;
  audioExt?: string;
  outExt: 'mp4' | 'mp3' | 'm4a';
  bitrateKbps?: number;
}

export async function resolveYouTubeDownload(
  videoId: string,
  formatId: string
): Promise<ResolvedYouTubeDownload> {
  const { info, pot, session } = await getYouTubeInfoCached(videoId);
  const player = session.yt.session.player;

  const attachPot = (rawUrl: string) => {
    const u = new URL(rawUrl);
    u.searchParams.set('pot', pot);
    return u.toString();
  };

  const muxedFormats: any[] = (info.streaming_data?.formats || []).filter(
    (f: any) => f.url || f.signature_cipher || f.cipher
  );
  const adaptiveFormats: any[] = (info.streaming_data?.adaptive_formats || []).filter(
    (f: any) => f.url || f.signature_cipher || f.cipher
  );

  const audioCandidates = adaptiveFormats
    .filter((f) => f.has_audio && !f.has_video)
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

  const m4aAudio =
    audioCandidates.find((f) => String(f.mime_type || '').includes('mp4')) ||
    audioCandidates[0];

  if (formatId === 'audio-mp3-320' || formatId === 'audio-mp3-128' || formatId === 'audio-m4a') {
    const chosenAudio = formatId === 'audio-m4a' ? m4aAudio : audioCandidates[0];
    if (!chosenAudio) {
      throw new Error('No audio stream available for this YouTube video.');
    }
    const deciphered = await chosenAudio.decipher(player);
    const isMp4Audio = String(chosenAudio.mime_type || '').includes('mp4');
    return {
      mode: 'audio',
      audioUrl: attachPot(deciphered),
      audioExt: isMp4Audio ? 'm4a' : 'webm',
      outExt: formatId === 'audio-m4a' ? 'm4a' : 'mp3',
      bitrateKbps: formatId === 'audio-mp3-128' ? 128 : 320,
    };
  }

  if (formatId === 'fast-direct' || formatId === 'best') {
    const bestMuxed = muxedFormats[muxedFormats.length - 1] || muxedFormats[0];
    if (bestMuxed) {
      const deciphered = await bestMuxed.decipher(player);
      return {
        mode: 'direct',
        videoUrl: attachPot(deciphered),
        outExt: 'mp4',
      };
    }
  }

  // Specific height target (e.g., best-2160, best-1080, best-720, etc.)
  const targetHeight = formatId.startsWith('best-')
    ? parseInt(formatId.replace('best-', ''), 10) || 1080
    : 1080;

  // Check if a muxed format satisfies >= targetHeight (rare above 360p, but fast if 360p requested)
  const matchingMuxed = muxedFormats
    .filter((f) => (f.height || 0) <= targetHeight && (f.height || 0) >= targetHeight * 0.85)
    .pop();
  if (matchingMuxed && targetHeight <= 480) {
    const deciphered = await matchingMuxed.decipher(player);
    return {
      mode: 'direct',
      videoUrl: attachPot(deciphered),
      outExt: 'mp4',
    };
  }

  const videoCandidates = adaptiveFormats
    .filter((f) => {
      if (!f.has_video || f.has_audio) return false;
      const eff = f.height && f.width ? Math.min(f.height, f.width) : f.height || 0;
      return eff > 0 && eff <= targetHeight * 1.05;
    })
    .sort((a, b) => {
      const ah = a.height || 0;
      const bh = b.height || 0;
      if (bh !== ah) return bh - ah;
      const aMp4 = String(a.mime_type || '').includes('mp4') ? 1 : 0;
      const bMp4 = String(b.mime_type || '').includes('mp4') ? 1 : 0;
      if (bMp4 !== aMp4) return bMp4 - aMp4;
      return (b.bitrate || 0) - (a.bitrate || 0);
    });

  const chosenVideo = videoCandidates[0];
  if (chosenVideo && m4aAudio) {
    const [vUrl, aUrl] = await Promise.all([
      chosenVideo.decipher(player),
      m4aAudio.decipher(player),
    ]);
    const vIsMp4 = String(chosenVideo.mime_type || '').includes('mp4');
    const aIsMp4 = String(m4aAudio.mime_type || '').includes('mp4');
    return {
      mode: 'mux',
      videoUrl: attachPot(vUrl),
      audioUrl: attachPot(aUrl),
      videoExt: vIsMp4 ? 'mp4' : 'webm',
      audioExt: aIsMp4 ? 'm4a' : 'webm',
      outExt: 'mp4',
    };
  }

  // Fallback to best muxed if adaptive failed
  const fallbackMuxed = muxedFormats[muxedFormats.length - 1] || muxedFormats[0];
  if (fallbackMuxed) {
    return {
      mode: 'direct',
      videoUrl: attachPot(await fallbackMuxed.decipher(player)),
      outExt: 'mp4',
    };
  }

  throw new Error('No playable stream formats found for this video.');
}

// ============================================================================
// VIMEO ENGINE (player.vimeo.com/video/<id>/config + oEmbed)
// ============================================================================

export function extractVimeoId(rawUrl: string): string | null {
  const m = rawUrl.match(/vimeo\.com\/(?:channels\/[^/]+\/|groups\/[^/]+\/videos\/|video\/)?(\d{5,12})/i);
  return m ? m[1] : null;
}

export async function extractVimeoData(videoId: string, originalUrl: string) {
  const [configRes, oembedRes] = await Promise.all([
    fetch(`https://player.vimeo.com/video/${videoId}/config`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: 'https://vimeo.com/',
      },
    }),
    fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(originalUrl)}`).catch(() => null),
  ]);

  if (!configRes.ok) {
    throw new Error(`Vimeo config returned status ${configRes.status}`);
  }

  const config = await configRes.json();
  const oembed = oembedRes && oembedRes.ok ? await oembedRes.json().catch(() => null) : null;

  const duration = config.video?.duration || oembed?.duration || 0;
  const title = config.video?.title || oembed?.title || `Vimeo Video ${videoId}`;
  const uploader = config.video?.owner?.name || oembed?.author_name || 'Vimeo Creator';
  const uploaderUrl = config.video?.owner?.url || oembed?.author_url || '';
  const thumbnail =
    oembed?.thumbnail_url ||
    config.video?.thumbs?.['1280'] ||
    config.video?.thumbs?.['640'] ||
    config.video?.thumbs?.base ||
    '';

  const progressive: any[] = config.request?.files?.progressive || [];
  const defaultCdn = config.request?.files?.hls?.default_cdn;
  const hlsUrl: string | undefined =
    config.request?.files?.hls?.cdns?.[defaultCdn]?.url ||
    (Object.values(config.request?.files?.hls?.cdns || {})[0] as any)?.url;

  const formats: any[] = [];
  const hlsVariants: { height: number; url: string; bandwidth?: number }[] = [];

  if (hlsUrl) {
    try {
      const m3u8Res = await fetch(hlsUrl);
      if (m3u8Res.ok) {
        const text = await m3u8Res.text();
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.startsWith('#EXT-X-STREAM-INF:')) {
            const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/);
            const bwMatch = line.match(/BANDWIDTH=(\d+)/);
            const nextLine = lines[i + 1]?.trim();
            if (nextLine && !nextLine.startsWith('#')) {
              const absUrl = new URL(nextLine, hlsUrl).toString();
              const height = resMatch ? Math.min(parseInt(resMatch[1], 10), parseInt(resMatch[2], 10)) : 720;
              hlsVariants.push({
                height,
                url: absUrl,
                bandwidth: bwMatch ? parseInt(bwMatch[1], 10) : undefined,
              });
            }
          }
        }
      }
    } catch {
      // ignore playlist parse issues
    }
  }

  // Fast progressive MP4 if available, or master HLS
  if (progressive.length > 0) {
    const sortedProg = [...progressive].sort((a, b) => (b.height || 0) - (a.height || 0));
    const bestProg = sortedProg[0];
    formats.push({
      id: 'fast-direct',
      label: `Fast Download (${bestProg.quality || `${bestProg.height}p`} MP4)`,
      resolution: `${bestProg.height || 720}p`,
      ext: 'mp4',
      filesize: duration > 0 ? Math.round((2500 * 1024 * duration) / 8) : null,
      filesizeFormatted: formatBytes(duration > 0 ? Math.round((2500 * 1024 * duration) / 8) : null),
      fps: bestProg.fps || 30,
      hasAudio: true,
      hasVideo: true,
      isAudioOnly: false,
      quality: `${bestProg.height || 720}p`,
      tag: 'Fastest',
      directUrl: bestProg.url,
    });
    for (const p of sortedProg) {
      formats.push({
        id: `best-${p.height}`,
        label: `MP4 Video (${p.quality || `${p.height}p`})`,
        resolution: `${p.height}p`,
        ext: 'mp4',
        filesize: duration > 0 ? Math.round(((p.height >= 1080 ? 4000 : 1800) * 1024 * duration) / 8) : null,
        filesizeFormatted: formatBytes(duration > 0 ? Math.round(((p.height >= 1080 ? 4000 : 1800) * 1024 * duration) / 8) : null),
        fps: p.fps || 30,
        hasAudio: true,
        hasVideo: true,
        isAudioOnly: false,
        quality: `${p.height}p`,
        tag: p.height >= 1080 ? 'Recommended' : 'Standard HD',
        directUrl: p.url,
      });
    }
  } else if (hlsUrl) {
    const maxH = hlsVariants.length > 0 ? Math.max(...hlsVariants.map((v) => v.height)) : 1080;
    formats.push({
      id: 'fast-direct',
      label: `Fast Download (${maxH}p HD MP4)`,
      resolution: `${maxH}p HD`,
      ext: 'mp4',
      filesize: duration > 0 ? Math.round((3000 * 1024 * duration) / 8) : null,
      filesizeFormatted: formatBytes(duration > 0 ? Math.round((3000 * 1024 * duration) / 8) : null),
      fps: 30,
      hasAudio: true,
      hasVideo: true,
      isAudioOnly: false,
      quality: `${maxH}p`,
      tag: 'Fastest',
    });

    const seenHeights = new Set<number>();
    const sortedVariants = [...hlsVariants].sort((a, b) => b.height - a.height);
    for (const v of sortedVariants) {
      if (seenHeights.has(v.height)) continue;
      seenHeights.add(v.height);
      const estSize = v.bandwidth && duration > 0 ? Math.round((v.bandwidth * duration) / 8) : null;
      formats.push({
        id: `best-${v.height}`,
        label: v.height >= 2160 ? '4K Ultra HD (2160p)' : v.height >= 1080 ? 'Full HD 1080p' : v.height >= 720 ? 'HD 720p' : `${v.height}p Standard`,
        resolution: `${v.height}p`,
        ext: 'mp4',
        filesize: estSize,
        filesizeFormatted: formatBytes(estSize),
        fps: 30,
        hasAudio: true,
        hasVideo: true,
        isAudioOnly: false,
        quality: `${v.height}p`,
        tag: v.height >= 1080 ? 'Recommended' : 'Standard HD',
      });
    }
  }

  const audio320 = duration > 0 ? Math.round((320 * 1024 * duration) / 8) : null;
  const audioM4a = duration > 0 ? Math.round((192 * 1024 * duration) / 8) : null;
  const audio128 = duration > 0 ? Math.round((128 * 1024 * duration) / 8) : null;

  formats.push(
    {
      id: 'audio-mp3-320',
      label: 'MP3 Audio (320 kbps Extreme HQ)',
      resolution: 'Audio Only',
      ext: 'mp3',
      filesize: audio320,
      filesizeFormatted: formatBytes(audio320),
      hasAudio: true,
      hasVideo: false,
      isAudioOnly: true,
      quality: '320kbps',
      tag: 'Studio Master',
    },
    {
      id: 'audio-m4a',
      label: 'M4A / AAC Audio (Original Lossless)',
      resolution: 'Audio Only',
      ext: 'm4a',
      filesize: audioM4a,
      filesizeFormatted: formatBytes(audioM4a),
      hasAudio: true,
      hasVideo: false,
      isAudioOnly: true,
      quality: 'Lossless',
      tag: 'Apple Compatible',
    },
    {
      id: 'audio-mp3-128',
      label: 'MP3 Audio (128 kbps Standard)',
      resolution: 'Audio Only',
      ext: 'mp3',
      filesize: audio128,
      filesizeFormatted: formatBytes(audio128),
      hasAudio: true,
      hasVideo: false,
      isAudioOnly: true,
      quality: '128kbps',
      tag: 'Lightweight',
    }
  );

  return {
    metadata: {
      id: videoId,
      url: originalUrl,
      title,
      description: (oembed?.description || '').slice(0, 350),
      thumbnail,
      uploader,
      uploaderUrl,
      duration,
      durationFormatted: formatDuration(duration),
      platform: 'vimeo',
      formats,
      previewUrl: progressive[0]?.url || undefined,
    },
    progressive,
    hlsUrl,
    hlsVariants,
    duration,
  };
}

// ============================================================================
// TWITTER / X ENGINE (api.fxtwitter.com)
// ============================================================================

export function extractTweetParams(rawUrl: string): { user: string; id: string } | null {
  const m = rawUrl.match(/(?:twitter\.com|x\.com)\/([^/]+)\/status\/(\d+)/i);
  return m ? { user: m[1], id: m[2] } : null;
}

export async function extractTwitterData(user: string, id: string, originalUrl: string) {
  const res = await fetch(`https://api.fxtwitter.com/${encodeURIComponent(user)}/status/${id}`, {
    headers: { 'User-Agent': 'StreamGrabDownloader/1.0' },
  });
  if (!res.ok) {
    throw new Error(`Twitter API returned status ${res.status}`);
  }
  const data = await res.json();
  const tweet = data.tweet;
  const videos: any[] = tweet?.media?.videos || [];
  if (!tweet || videos.length === 0) {
    throw new Error('No video found in this tweet.');
  }

  const primary = videos[0];
  const duration = primary.duration || 0;
  const variants: any[] = (primary.variants || [])
    .filter((v: any) => v.url && (!v.content_type || v.content_type.includes('mp4')))
    .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));

  const bestUrl = primary.url || variants[0]?.url;
  const formats: any[] = [];

  if (bestUrl) {
    formats.push({
      id: 'fast-direct',
      label: 'Fast Download (HD MP4)',
      resolution: `${primary.height || 720}p HD`,
      ext: 'mp4',
      filesize: null,
      filesizeFormatted: 'Variable size',
      fps: 30,
      hasAudio: true,
      hasVideo: true,
      isAudioOnly: false,
      quality: `${primary.height || 720}p`,
      tag: 'Fastest',
      directUrl: bestUrl,
    });
  }

  const seen = new Set<string>();
  for (const v of variants) {
    const resMatch = v.url.match(/\/(\d+)x(\d+)\//);
    const height = resMatch ? Math.min(parseInt(resMatch[1], 10), parseInt(resMatch[2], 10)) : primary.height || 720;
    const key = String(height);
    if (seen.has(key)) continue;
    seen.add(key);
    const estSize = v.bitrate && duration > 0 ? Math.round((v.bitrate * duration) / 8) : null;
    formats.push({
      id: `best-${height}`,
      label: height >= 1080 ? 'Full HD 1080p' : height >= 720 ? 'HD 720p' : `${height}p Standard`,
      resolution: `${height}p`,
      ext: 'mp4',
      filesize: estSize,
      filesizeFormatted: formatBytes(estSize),
      fps: 30,
      hasAudio: true,
      hasVideo: true,
      isAudioOnly: false,
      quality: `${height}p`,
      tag: height >= 1080 ? 'Recommended' : 'Standard HD',
      directUrl: v.url,
    });
  }

  formats.push(
    {
      id: 'audio-mp3-320',
      label: 'MP3 Audio (320 kbps Extreme HQ)',
      resolution: 'Audio Only',
      ext: 'mp3',
      filesize: duration > 0 ? Math.round((320 * 1024 * duration) / 8) : null,
      filesizeFormatted: formatBytes(duration > 0 ? Math.round((320 * 1024 * duration) / 8) : null),
      hasAudio: true,
      hasVideo: false,
      isAudioOnly: true,
      quality: '320kbps',
      tag: 'Studio Master',
    },
    {
      id: 'audio-m4a',
      label: 'M4A / AAC Audio (Original Lossless)',
      resolution: 'Audio Only',
      ext: 'm4a',
      filesize: duration > 0 ? Math.round((192 * 1024 * duration) / 8) : null,
      filesizeFormatted: formatBytes(duration > 0 ? Math.round((192 * 1024 * duration) / 8) : null),
      hasAudio: true,
      hasVideo: false,
      isAudioOnly: true,
      quality: 'Lossless',
      tag: 'Apple Compatible',
    }
  );

  return {
    metadata: {
      id,
      url: originalUrl,
      title: tweet.text?.trim()?.slice(0, 120) || `X Video by @${tweet.author?.screen_name || user}`,
      description: (tweet.text || '').slice(0, 350),
      thumbnail: primary.thumbnail_url || tweet.author?.avatar_url || '',
      uploader: tweet.author?.name || `@${user}`,
      uploaderUrl: `https://x.com/${tweet.author?.screen_name || user}`,
      duration,
      durationFormatted: formatDuration(duration),
      viewCount: tweet.views,
      likeCount: tweet.likes,
      platform: 'twitter',
      formats,
      previewUrl: `/api/preview?url=${encodeURIComponent(originalUrl)}`,
    },
    bestUrl,
    variants,
  };
}

