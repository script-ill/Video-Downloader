import express from 'express';
import path from 'path';
import fs from 'fs';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import { createServer as createViteServer } from 'vite';
import {
  USER_COOKIES_PATH,
  hasUserCookies,
  saveUserCookies,
  formatBytes,
  formatDuration,
  formatViews,
  extractYouTubeVideoId,
  searchYouTube,
  extractYouTubeMetadata,
  resolveYouTubeDownload,
  extractVimeoId,
  extractVimeoData,
  extractTweetParams,
  extractTwitterData,
  searchDailymotion,
} from './server-extractors';

const execFileAsync = promisify(execFile);
const app = express();
const PORT = 3000;

app.use(express.json({ limit: '2mb' }));

// In-memory job store for background downloads with real-time progress
interface ServerJob {
  id: string;
  jobId: string;
  url: string;
  formatId: string;
  formatLabel: string;
  ext: string;
  title: string;
  status: 'queued' | 'downloading' | 'processing' | 'ready' | 'failed';
  progress: number;
  speed: string;
  eta: string;
  totalSize: string;
  filePath?: string;
  error?: string;
  created: number;
}

const jobs = new Map<string, ServerJob>();

// Cleanup jobs older than 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.created > 30 * 60 * 1000) {
      if (job.filePath && fs.existsSync(job.filePath)) {
        try {
          fs.unlinkSync(job.filePath);
          const dir = path.dirname(job.filePath);
          if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
        } catch {
          // ignore cleanup errors
        }
      }
      jobs.delete(id);
    }
  }
}, 5 * 60 * 1000);

const YT_DLP_PATH = path.resolve(process.cwd(), 'yt-dlp');
const FFMPEG_PATH = fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : 'ffmpeg';

if (fs.existsSync(YT_DLP_PATH)) {
  try {
    fs.chmodSync(YT_DLP_PATH, 0o755);
  } catch (err) {
    console.error('Failed to set chmod on yt-dlp:', err);
  }
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('instagram.com') || u.includes('instagr.am')) return 'instagram';
  if (u.includes('tiktok.com') || u.includes('tiktoklite') || u.includes('vm.tiktok') || u.includes('vt.tiktok')) return 'tiktok';
  if (u.includes('twitter.com') || u.includes('x.com') || u.includes('t.co')) return 'twitter';
  if (u.includes('facebook.com') || u.includes('fb.watch') || u.includes('fb.com')) return 'facebook';
  if (u.includes('reddit.com') || u.includes('v.redd.it')) return 'reddit';
  if (u.includes('threads.net')) return 'threads';
  if (u.includes('vimeo.com')) return 'vimeo';
  if (u.includes('pinterest.com') || u.includes('pin.it')) return 'pinterest';
  if (u.includes('twitch.tv')) return 'twitch';
  return 'generic';
}

function isTikTokUrl(input: string): boolean {
  const lower = input.toLowerCase();
  return (
    lower.includes('tiktok.com') ||
    lower.includes('tiktoklite') ||
    lower.includes('vm.tiktok') ||
    lower.includes('vt.tiktok') ||
    lower.includes('t.tiktok')
  );
}

function extractUrlFromText(text: string): string {
  const match = text.match(/https?:\/\/[^\s"'<>]+/i);
  return match ? match[0].trim() : text.trim();
}

function getYtDlpBaseArgs(): string[] {
  const args = [
    '--js-runtimes',
    'node:/usr/local/bin/node',
    '--no-warnings',
    '--no-playlist',
    '--socket-timeout',
    '30',
    '--no-check-certificates',
  ];
  if (hasUserCookies()) {
    args.push('--cookies', USER_COOKIES_PATH);
  }
  return args;
}

async function resolveTikTokCanonicalUrl(inputUrl: string): Promise<string> {
  const clean = extractUrlFromText(inputUrl);
  const idMatch = clean.match(/(\d{15,22})/);
  if (idMatch) {
    return `https://www.tiktok.com/@user/video/${idMatch[1]}`;
  }

  try {
    const res = await fetch(clean, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });
    const finalUrl = res.url || clean;
    const finalId = finalUrl.match(/(\d{15,22})/);
    if (finalId) {
      return `https://www.tiktok.com/@user/video/${finalId[1]}`;
    }
    return finalUrl;
  } catch {
    return clean;
  }
}

async function fetchTikWMData(canonicalUrl: string) {
  const body = new URLSearchParams({ url: canonicalUrl });
  const response = await fetch('https://www.tikwm.com/api/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
    body: body.toString(),
  });
  if (!response.ok) {
    throw new Error(`TikWM returned status ${response.status}`);
  }
  const result = await response.json();
  if (result.code !== 0 || !result.data) {
    throw new Error(result.msg || 'TikWM unable to process URL.');
  }
  return result.data;
}

function buildTikTokMetadata(tikwmData: any, originalUrl: string) {
  const duration = tikwmData.duration || 0;
  const durationFormatted = formatDuration(duration);
  const title = tikwmData.title?.trim() || `TikTok Video by ${tikwmData.author?.nickname || 'Creator'}`;
  const formats: any[] = [];

  if (tikwmData.play) {
    formats.push({
      id: 'fast-direct',
      label: 'HD Video (No Watermark MP4)',
      resolution: '1080p HD',
      ext: 'mp4',
      filesize: tikwmData.size || null,
      filesizeFormatted: formatBytes(tikwmData.size || null),
      fps: 30,
      hasAudio: true,
      hasVideo: true,
      isAudioOnly: false,
      quality: '1080p',
      tag: 'No Watermark',
    });
    formats.push({
      id: 'tiktok-hd',
      label: 'Full HD 1080p (Pristine No Watermark)',
      resolution: '1080p',
      ext: 'mp4',
      filesize: tikwmData.size || null,
      filesizeFormatted: formatBytes(tikwmData.size || null),
      fps: 60,
      hasAudio: true,
      hasVideo: true,
      isAudioOnly: false,
      quality: '1080p',
      tag: 'Recommended',
    });
  }

  if (tikwmData.wmplay) {
    formats.push({
      id: 'tiktok-wm',
      label: 'Standard Video (Original Watermark)',
      resolution: '720p',
      ext: 'mp4',
      filesize: tikwmData.wm_size || null,
      filesizeFormatted: formatBytes(tikwmData.wm_size || null),
      fps: 30,
      hasAudio: true,
      hasVideo: true,
      isAudioOnly: false,
      quality: '720p',
      tag: 'Original',
    });
  }

  if (tikwmData.music) {
    const audioBytes = duration > 0 ? Math.round((320 * 1024 * duration) / 8) : 3200000;
    formats.push(
      {
        id: 'audio-mp3-320',
        label: 'Original Soundtrack MP3 (320 kbps Master)',
        resolution: 'Audio Only',
        ext: 'mp3',
        filesize: audioBytes,
        filesizeFormatted: formatBytes(audioBytes),
        hasAudio: true,
        hasVideo: false,
        isAudioOnly: true,
        quality: '320kbps',
        tag: 'Studio Master',
      },
      {
        id: 'audio-m4a',
        label: 'Lossless Audio (AAC/M4A)',
        resolution: 'Audio Only',
        ext: 'm4a',
        filesize: Math.round(audioBytes * 0.6),
        filesizeFormatted: formatBytes(Math.round(audioBytes * 0.6)),
        hasAudio: true,
        hasVideo: false,
        isAudioOnly: true,
        quality: 'Lossless',
        tag: 'Original Sound',
      },
      {
        id: 'audio-mp3-128',
        label: 'Standard MP3 (128 kbps Lightweight)',
        resolution: 'Audio Only',
        ext: 'mp3',
        filesize: Math.round(audioBytes * 0.4),
        filesizeFormatted: formatBytes(Math.round(audioBytes * 0.4)),
        hasAudio: true,
        hasVideo: false,
        isAudioOnly: true,
        quality: '128kbps',
        tag: 'Lightweight',
      }
    );
  }

  return {
    id: tikwmData.id || String(Date.now()),
    url: originalUrl,
    title,
    description: (tikwmData.title || '').slice(0, 350),
    thumbnail: tikwmData.cover || tikwmData.origin_cover || '',
    uploader: tikwmData.author?.nickname || tikwmData.author?.unique_id || 'TikTok Creator',
    uploaderUrl: tikwmData.author?.unique_id ? `https://www.tiktok.com/@${tikwmData.author.unique_id}` : '',
    duration,
    durationFormatted,
    viewCount: tikwmData.play_count,
    likeCount: tikwmData.digg_count,
    uploadDate: tikwmData.create_time
      ? new Date(tikwmData.create_time * 1000).toISOString().slice(0, 10).replace(/-/g, '')
      : undefined,
    platform: 'tiktok',
    formats,
    previewUrl: `/api/preview?url=${encodeURIComponent(originalUrl)}`,
  };
}

async function downloadStreamToPath(
  streamUrl: string,
  outPath: string,
  job?: ServerJob,
  progressStart = 5,
  progressEnd = 95
) {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  };

  // Use 512KB Range chunks for googlevideo.com to bypass YouTube's single-stream ~10KB/s throttle
  if (streamUrl.includes('googlevideo.com')) {
    const probe = await fetch(streamUrl, {
      headers: { ...headers, Range: 'bytes=0-524287' },
    });
    if (probe.status === 206) {
      const contentRange = probe.headers.get('content-range') || '';
      const totalMatch = contentRange.match(/\/(\d+)$/);
      const totalBytes = totalMatch ? parseInt(totalMatch[1], 10) : 0;

      if (job && totalBytes > 0 && (job.totalSize === 'Calculating...' || progressStart <= 15)) {
        job.totalSize = formatBytes(totalBytes);
      }

      const fileStream = fs.createWriteStream(outPath);
      const firstBuf = Buffer.from(await probe.arrayBuffer());
      await new Promise<void>((resolve, reject) => {
        fileStream.write(firstBuf, (err) => (err ? reject(err) : resolve()));
      });

      let downloadedBytes = firstBuf.length;
      const startTime = Date.now();
      const CHUNK_SIZE = 524288; // 512 KB

      while (totalBytes === 0 || downloadedBytes < totalBytes) {
        const start = downloadedBytes;
        const end = totalBytes > 0 ? Math.min(start + CHUNK_SIZE - 1, totalBytes - 1) : start + CHUNK_SIZE - 1;
        const chunkRes = await fetch(streamUrl, {
          headers: { ...headers, Range: `bytes=${start}-${end}` },
        });
        if (!chunkRes.ok && chunkRes.status !== 206) {
          if (chunkRes.status === 416) break;
          throw new Error(`Media CDN returned status ${chunkRes.status}`);
        }
        const buf = Buffer.from(await chunkRes.arrayBuffer());
        if (buf.length === 0) break;

        await new Promise<void>((resolve, reject) => {
          fileStream.write(buf, (err) => (err ? reject(err) : resolve()));
        });
        downloadedBytes += buf.length;

        if (job && totalBytes > 0) {
          const ratio = downloadedBytes / totalBytes;
          job.progress = Math.min(
            Math.max(Math.round(progressStart + ratio * (progressEnd - progressStart)), progressStart),
            progressEnd
          );
          const elapsedSec = Math.max((Date.now() - startTime) / 1000, 0.1);
          const speedBps = downloadedBytes / elapsedSec;
          job.speed = `${formatBytes(speedBps)}/s`;
          const remainingSec = Math.max(Math.round((totalBytes - downloadedBytes) / speedBps), 0);
          job.eta = `00:${remainingSec.toString().padStart(2, '0')}`;
        }

        if (totalBytes === 0 && buf.length < CHUNK_SIZE) break;
      }

      fileStream.end();
      await new Promise<void>((resolve, reject) => {
        fileStream.on('finish', () => resolve());
        fileStream.on('error', reject);
      });
      return;
    }
  }

  const res = await fetch(streamUrl, { headers });
  if (!res.ok || !res.body) {
    throw new Error(`Media CDN returned status ${res.status}`);
  }

  const totalBytes = parseInt(res.headers.get('content-length') || '0', 10);
  if (job && totalBytes > 0 && (job.totalSize === 'Calculating...' || progressStart <= 15)) {
    job.totalSize = formatBytes(totalBytes);
  }

  const fileStream = fs.createWriteStream(outPath);
  let downloadedBytes = 0;
  const startTime = Date.now();
  const reader = res.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      await new Promise<void>((resolve, reject) => {
        const ok = fileStream.write(Buffer.from(value), (err) => {
          if (err) reject(err);
          else resolve();
        });
        if (ok) resolve();
      });
      downloadedBytes += value.length;
      if (job) {
        if (totalBytes > 0) {
          const ratio = downloadedBytes / totalBytes;
          job.progress = Math.min(
            Math.max(Math.round(progressStart + ratio * (progressEnd - progressStart)), progressStart),
            progressEnd
          );
          const elapsedSec = (Date.now() - startTime) / 1000;
          if (elapsedSec > 0.35) {
            const speedBps = downloadedBytes / elapsedSec;
            job.speed = `${formatBytes(speedBps)}/s`;
            const remainingSec = Math.max(Math.round((totalBytes - downloadedBytes) / speedBps), 0);
            job.eta = `00:${remainingSec.toString().padStart(2, '0')}`;
          }
        } else {
          job.progress = Math.round((progressStart + progressEnd) / 2);
        }
      }
    }
  }

  fileStream.end();
  await new Promise<void>((resolve, reject) => {
    fileStream.on('finish', () => resolve());
    fileStream.on('error', reject);
  });
}

async function downloadDirectStreamToFile(streamUrl: string, outPath: string, job: ServerJob) {
  job.status = 'downloading';
  job.speed = 'High-Speed Direct Stream';
  await downloadStreamToPath(streamUrl, outPath, job, 10, 99);
  job.filePath = outPath;
  job.status = 'ready';
  job.progress = 100;
  job.speed = 'Download Ready';
  job.eta = '00:00';
}

function runFfmpeg(args: string[], job?: ServerJob, durationSec = 0): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_PATH, args);
    let stderr = '';

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (job && durationSec > 0) {
        const m = text.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
        if (m) {
          const secs = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]);
          const pct = Math.min(Math.max(Math.round((secs / durationSec) * 95), 10), 96);
          job.progress = Math.max(job.progress, pct);
        }
      }
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-250)}`));
    });

    proc.on('error', reject);
  });
}

// 1. Health check
app.get('/api/health', (req, res) => {
  const ytdlpExists = fs.existsSync(YT_DLP_PATH);
  res.json({
    status: 'ok',
    ytdlp: ytdlpExists,
    ffmpeg: true,
    hasCookies: hasUserCookies(),
  });
});

// Optional Session Cookies endpoints (for login-gated platforms like Instagram/Facebook/private videos)
app.get('/api/cookies', (_req, res) => {
  res.json({ hasCookies: hasUserCookies() });
});

app.post('/api/cookies', (req, res) => {
  const { cookies } = req.body || {};
  if (typeof cookies !== 'string') {
    return res.status(400).json({ error: 'cookies string is required' });
  }
  saveUserCookies(cookies);
  res.json({ success: true, hasCookies: hasUserCookies() });
});

// 2. Extract metadata & formats
app.post('/api/extract', async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Please enter a valid video link starting with http:// or https://' });
  }

  const cleanUrl = extractUrlFromText(url.trim());
  if (!cleanUrl.startsWith('http')) {
    return res.status(400).json({ error: 'Please enter a valid video link starting with http:// or https://' });
  }

  // A. YouTube specialized BotGuard + InnerTube pipeline
  const ytId = extractYouTubeVideoId(cleanUrl);
  if (ytId) {
    try {
      const metadata = await extractYouTubeMetadata(ytId, cleanUrl);
      return res.json({ success: true, data: metadata });
    } catch (ytErr: any) {
      console.warn('YouTube InnerTube extraction failed, trying yt-dlp fallback:', ytErr.message);
      // Fall through to yt-dlp fallback (useful if user uploaded cookies)
    }
  }

  // B. TikTok specialized bypass (TikWM CDN)
  if (isTikTokUrl(cleanUrl)) {
    try {
      const canonicalUrl = await resolveTikTokCanonicalUrl(cleanUrl);
      const tikwmData = await fetchTikWMData(canonicalUrl);
      const metadata = buildTikTokMetadata(tikwmData, cleanUrl);
      return res.json({ success: true, data: metadata });
    } catch (tikErr: any) {
      console.warn('TikWM extraction failed, falling back to yt-dlp:', tikErr.message);
    }
  }

  // C. Vimeo specialized config API
  const vimeoId = extractVimeoId(cleanUrl);
  if (vimeoId) {
    try {
      const vimeoData = await extractVimeoData(vimeoId, cleanUrl);
      return res.json({ success: true, data: vimeoData.metadata });
    } catch (vimErr: any) {
      console.warn('Vimeo config extraction failed, falling back to yt-dlp:', vimErr.message);
    }
  }

  // D. Twitter / X specialized API
  const tweetParams = extractTweetParams(cleanUrl);
  if (tweetParams) {
    try {
      const twitterData = await extractTwitterData(tweetParams.user, tweetParams.id, cleanUrl);
      return res.json({ success: true, data: twitterData.metadata });
    } catch (twErr: any) {
      console.warn('Twitter fxtwitter extraction failed, falling back to yt-dlp:', twErr.message);
    }
  }

  // E. Generic / Instagram / Facebook / Reddit via yt-dlp
  try {
    const args = [...getYtDlpBaseArgs(), '-J', cleanUrl];
    const { stdout } = await execFileAsync(YT_DLP_PATH, args, { maxBuffer: 15 * 1024 * 1024 });
    const rawData = JSON.parse(stdout);

    const platform = detectPlatform(cleanUrl);
    const duration = rawData.duration || 0;
    const durationFormatted = formatDuration(duration);
    const rawFormats: any[] = rawData.formats || [];
    const formattedList: any[] = [];

    const videoHeights = new Set<number>();
    for (const f of rawFormats) {
      const effectiveHeight = f.height && f.width ? Math.min(f.height, f.width) : f.height || 0;
      if (effectiveHeight > 0) {
        videoHeights.add(effectiveHeight);
      }
    }

    const sortedHeights = Array.from(videoHeights).sort((a, b) => b - a);
    const maxDetectedHeight = sortedHeights.length > 0 ? sortedHeights[0] : rawData.height || 720;

    formattedList.push({
      id: 'fast-direct',
      label: 'Fast Download (Instant MP4)',
      resolution: `${maxDetectedHeight}p HD`,
      ext: 'mp4',
      filesize: rawData.filesize || rawData.filesize_approx || null,
      filesizeFormatted: formatBytes(rawData.filesize || rawData.filesize_approx || null),
      fps: 30,
      hasAudio: true,
      hasVideo: true,
      isAudioOnly: false,
      quality: `${maxDetectedHeight}p`,
      tag: 'Fastest',
    });

    const targetQualities = [
      { height: 2160, minReq: 1900, label: '4K Ultra HD (2160p)', tag: 'Ultra HD' },
      { height: 1440, minReq: 1300, label: '2K Quad HD (1440p)', tag: 'High-Res' },
      { height: 1080, minReq: 900, label: 'Full HD 1080p', tag: 'Recommended' },
      { height: 720, minReq: 600, label: 'HD 720p', tag: 'Standard HD' },
      { height: 480, minReq: 400, label: 'SD 480p', tag: 'Data Saver' },
      { height: 360, minReq: 200, label: '360p Standard', tag: 'Compact' },
    ];

    for (const tier of targetQualities) {
      const isAvailable = sortedHeights.some((h) => h >= tier.minReq);
      if (isAvailable) {
        const sampleFormat = rawFormats.find((f) => {
          const eff = f.height && f.width ? Math.min(f.height, f.width) : f.height || 0;
          return eff >= tier.minReq && eff <= tier.height * 1.2;
        });

        let estSize: number | null = null;
        if (sampleFormat?.filesize) {
          estSize = sampleFormat.filesize;
        } else if (sampleFormat?.filesize_approx) {
          estSize = sampleFormat.filesize_approx;
        } else if (duration > 0) {
          const bitrateKbps =
            tier.height >= 2160 ? 12000 : tier.height >= 1440 ? 6000 : tier.height >= 1080 ? 3500 : tier.height >= 720 ? 1800 : 900;
          estSize = Math.round((bitrateKbps * 1024 * duration) / 8);
        }

        formattedList.push({
          id: `best-${tier.height}`,
          label: tier.label,
          resolution: `${tier.height}p`,
          ext: 'mp4',
          filesize: estSize,
          filesizeFormatted: formatBytes(estSize),
          fps: sampleFormat?.fps || (tier.height >= 1080 ? 60 : 30),
          hasAudio: true,
          hasVideo: true,
          isAudioOnly: false,
          quality: `${tier.height}p`,
          tag: tier.tag,
        });
      }
    }

    const audioSize320 = duration > 0 ? Math.round((320 * 1024 * duration) / 8) : null;
    const audioSizeM4a = duration > 0 ? Math.round((192 * 1024 * duration) / 8) : null;
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

    const metadata = {
      id: rawData.id || String(Date.now()),
      url: cleanUrl,
      title: rawData.title || 'Untitled Social Media Video',
      description: (rawData.description || '').slice(0, 350),
      thumbnail: rawData.thumbnail || '',
      uploader: rawData.uploader || rawData.channel || rawData.creator || 'Creator',
      uploaderUrl: rawData.uploader_url || rawData.channel_url || '',
      duration,
      durationFormatted,
      viewCount: rawData.view_count,
      likeCount: rawData.like_count,
      uploadDate: rawData.upload_date,
      platform,
      formats: formattedList,
      previewUrl: rawData.url || undefined,
    };

    res.json({ success: true, data: metadata });
  } catch (err: any) {
    console.error('Error extracting video info:', err);
    const rawMsg: string = err.stderr || err.message || '';
    const cleanedMsg = rawMsg
      .replace(/Deprecated Feature:[^\n]*\n?/g, '')
      .trim();

    if (cleanedMsg.includes('Sign in to confirm you’re not a bot') || cleanedMsg.includes("Sign in to confirm you're not a bot")) {
      return res.status(500).json({
        error:
          'YouTube requested bot verification for this video on the cloud server. You can paste your YouTube session cookies (cookies.txt) below to unlock it immediately.',
      });
    }

    if (cleanedMsg.includes('logged-in') || cleanedMsg.includes('cookies')) {
      return res.status(500).json({
        error:
          'This platform requires an authenticated session for this link. Paste Netscape cookies.txt using "Add Session Cookies" below to extract it.',
      });
    }

    res.status(500).json({
      error:
        cleanedMsg ||
        'Unable to analyze video. Please ensure the link is public, or add session cookies if the platform requires login.',
    });
  }
});

// 3. Start a download job with progress tracking
app.post('/api/jobs', async (req, res) => {
  const { url, formatId, formatLabel, ext, title } = req.body;

  if (!url || !formatId) {
    return res.status(400).json({ error: 'Missing required parameters (url, formatId).' });
  }

  const cleanUrl = extractUrlFromText(url.trim());
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const cleanTitle = sanitizeFilename(title || 'video');
  const targetExt =
    ext || (formatId.startsWith('audio-mp3') ? 'mp3' : formatId.startsWith('audio-m4a') ? 'm4a' : 'mp4');

  const tmpDir = path.join('/tmp', 'downloader_jobs', jobId);
  fs.mkdirSync(tmpDir, { recursive: true });

  const job: ServerJob = {
    id: jobId,
    jobId,
    url: cleanUrl,
    formatId,
    formatLabel: formatLabel || formatId,
    ext: targetExt,
    title: cleanTitle,
    status: 'queued',
    progress: 5,
    speed: 'Initializing...',
    eta: '--:--',
    totalSize: 'Calculating...',
    created: Date.now(),
  };

  jobs.set(jobId, job);
  res.json({
    success: true,
    job: { ...job, jobId: job.id, id: job.id },
  });

  // A. YouTube job (BotGuard + InnerTube + FFmpeg)
  const ytId = extractYouTubeVideoId(cleanUrl);
  if (ytId) {
    (async () => {
      try {
        job.status = 'downloading';
        job.speed = 'Resolving YouTube stream...';
        job.progress = 8;

        const resolved = await resolveYouTubeDownload(ytId, formatId);
        job.ext = resolved.outExt;
        const finalOut = path.join(tmpDir, `${cleanTitle}.${resolved.outExt}`);

        if (resolved.mode === 'direct' && resolved.videoUrl) {
          await downloadDirectStreamToFile(resolved.videoUrl, finalOut, job);
          return;
        }

        if (resolved.mode === 'audio' && resolved.audioUrl) {
          const rawAudio = path.join(tmpDir, `raw_audio.${resolved.audioExt || 'webm'}`);
          await downloadStreamToPath(resolved.audioUrl, rawAudio, job, 10, 82);

          job.status = 'processing';
          job.progress = 90;
          job.speed = `Encoding ${resolved.outExt.toUpperCase()}...`;
          job.eta = 'Almost ready';

          if (resolved.outExt === 'm4a' && resolved.audioExt === 'm4a') {
            await runFfmpeg(['-y', '-i', rawAudio, '-c:a', 'copy', '-movflags', '+faststart', finalOut]);
          } else if (resolved.outExt === 'm4a') {
            await runFfmpeg(['-y', '-i', rawAudio, '-vn', '-c:a', 'aac', '-b:a', '192k', finalOut]);
          } else {
            await runFfmpeg([
              '-y',
              '-i',
              rawAudio,
              '-vn',
              '-c:a',
              'libmp3lame',
              '-b:a',
              `${resolved.bitrateKbps || 320}k`,
              finalOut,
            ]);
          }

          if (fs.existsSync(rawAudio)) fs.unlinkSync(rawAudio);
          job.filePath = finalOut;
          job.status = 'ready';
          job.progress = 100;
          job.speed = 'Download Ready';
          job.eta = '00:00';
          return;
        }

        if (resolved.mode === 'mux' && resolved.videoUrl && resolved.audioUrl) {
          const rawVideo = path.join(tmpDir, `raw_video.${resolved.videoExt || 'mp4'}`);
          const rawAudio = path.join(tmpDir, `raw_audio.${resolved.audioExt || 'm4a'}`);

          job.speed = 'Downloading HD video stream...';
          await downloadStreamToPath(resolved.videoUrl, rawVideo, job, 10, 74);

          job.speed = 'Downloading audio track...';
          await downloadStreamToPath(resolved.audioUrl, rawAudio, job, 75, 90);

          job.status = 'processing';
          job.progress = 95;
          job.speed = 'Muxing Video + Audio (FFmpeg)...';
          job.eta = 'Almost ready';

          const audioCodec = resolved.audioExt === 'm4a' ? 'copy' : 'aac';
          await runFfmpeg([
            '-y',
            '-i',
            rawVideo,
            '-i',
            rawAudio,
            '-c:v',
            'copy',
            '-c:a',
            audioCodec,
            '-movflags',
            '+faststart',
            finalOut,
          ]);

          if (fs.existsSync(rawVideo)) fs.unlinkSync(rawVideo);
          if (fs.existsSync(rawAudio)) fs.unlinkSync(rawAudio);

          const stat = fs.statSync(finalOut);
          job.totalSize = formatBytes(stat.size);
          job.filePath = finalOut;
          job.status = 'ready';
          job.progress = 100;
          job.speed = 'Download Ready';
          job.eta = '00:00';
          return;
        }

        throw new Error('Unsupported YouTube stream mode.');
      } catch (ytErr: any) {
        console.warn('YouTube InnerTube job failed:', ytErr.message);
        if (hasUserCookies()) {
          runYtDlpJob(cleanUrl, formatId, cleanTitle, tmpDir, job);
          return;
        }
        job.status = 'failed';
        const msg = String(ytErr.message || '');
        job.error =
          msg.includes('bot') || msg.includes('LOGIN_REQUIRED') || msg.includes('Sign in')
            ? 'YouTube requested bot verification for this video on the cloud server. Paste your YouTube session cookies (cookies.txt) below to unlock and retry.'
            : msg || 'YouTube stream could not be downloaded.';
      }
    })();
    return;
  }

  // B. TikTok job (direct high-speed CDN + FFmpeg conversion if audio)
  if (isTikTokUrl(cleanUrl)) {
    (async () => {
      try {
        job.status = 'downloading';
        job.speed = 'Connecting to TikTok high-speed CDN...';
        job.progress = 15;

        const canonical = await resolveTikTokCanonicalUrl(cleanUrl);
        const data = await fetchTikWMData(canonical);

        let mediaUrl = data.play;
        let outExt = 'mp4';

        if (formatId.startsWith('audio-') || targetExt === 'mp3' || targetExt === 'm4a') {
          mediaUrl = data.music || data.play;
          outExt = targetExt === 'm4a' ? 'm4a' : 'mp3';
        } else if (formatId === 'tiktok-wm') {
          mediaUrl = data.wmplay || data.play;
          outExt = 'mp4';
        }

        if (!mediaUrl) {
          throw new Error('TikTok media stream URL not returned from CDN.');
        }

        const targetFile = path.join(tmpDir, `${cleanTitle}.${outExt}`);
        job.ext = outExt;
        await downloadDirectStreamToFile(mediaUrl, targetFile, job);
      } catch (err: any) {
        console.error('TikTok direct download job failed:', err);
        job.status = 'failed';
        job.error = `TikTok processing error: ${err.message || 'Stream blocked'}.`;
      }
    })();
    return;
  }

  // C. Vimeo job (player config + progressive / HLS FFmpeg)
  const vimeoId = extractVimeoId(cleanUrl);
  if (vimeoId) {
    (async () => {
      try {
        job.status = 'downloading';
        job.speed = 'Connecting to Vimeo CDN...';
        job.progress = 12;

        const vimeoData = await extractVimeoData(vimeoId, cleanUrl);
        const finalOut = path.join(tmpDir, `${cleanTitle}.${targetExt}`);

        if (targetExt === 'mp3' || targetExt === 'm4a') {
          const srcUrl = vimeoData.progressive?.[0]?.url || vimeoData.hlsUrl;
          if (!srcUrl) throw new Error('No Vimeo stream available.');
          job.speed = `Extracting ${targetExt.toUpperCase()} audio...`;
          if (targetExt === 'm4a') {
            await runFfmpeg(['-y', '-i', srcUrl, '-vn', '-c:a', 'aac', '-b:a', '192k', finalOut], job, vimeoData.duration);
          } else {
            await runFfmpeg(
              ['-y', '-i', srcUrl, '-vn', '-c:a', 'libmp3lame', '-b:a', formatId === 'audio-mp3-128' ? '128k' : '320k', finalOut],
              job,
              vimeoData.duration
            );
          }
          job.totalSize = formatBytes(fs.statSync(finalOut).size);
          job.filePath = finalOut;
          job.status = 'ready';
          job.progress = 100;
          job.speed = 'Download Ready';
          job.eta = '00:00';
          return;
        }

        // Video MP4
        const targetH = formatId.startsWith('best-') ? parseInt(formatId.replace('best-', ''), 10) : 2160;
        const matchingProg = (vimeoData.progressive || []).find((p: any) => p.height <= targetH);
        if (matchingProg?.url) {
          await downloadDirectStreamToFile(matchingProg.url, finalOut, job);
          return;
        }

        const variant =
          vimeoData.hlsVariants.find((v) => v.height <= targetH) ||
          vimeoData.hlsVariants[0];
        const hlsInput = variant?.url || vimeoData.hlsUrl;
        if (!hlsInput) throw new Error('No Vimeo video stream found.');

        job.speed = 'Streaming & Muxing Vimeo HLS...';
        await runFfmpeg(['-y', '-i', hlsInput, '-c', 'copy', '-movflags', '+faststart', finalOut], job, vimeoData.duration);
        job.totalSize = formatBytes(fs.statSync(finalOut).size);
        job.filePath = finalOut;
        job.status = 'ready';
        job.progress = 100;
        job.speed = 'Download Ready';
        job.eta = '00:00';
      } catch (err: any) {
        console.error('Vimeo download job failed:', err);
        job.status = 'failed';
        job.error = err.message || 'Vimeo stream processing failed.';
      }
    })();
    return;
  }

  // D. Twitter / X job (fxtwitter direct MP4 + FFmpeg audio)
  const tweetParams = extractTweetParams(cleanUrl);
  if (tweetParams) {
    (async () => {
      try {
        job.status = 'downloading';
        job.speed = 'Connecting to X/Twitter CDN...';
        job.progress = 15;

        const twData = await extractTwitterData(tweetParams.user, tweetParams.id, cleanUrl);
        const finalOut = path.join(tmpDir, `${cleanTitle}.${targetExt}`);

        if (targetExt === 'mp3' || targetExt === 'm4a') {
          const srcUrl = twData.bestUrl;
          if (!srcUrl) throw new Error('No Twitter video stream available.');
          const rawVid = path.join(tmpDir, 'raw_tw.mp4');
          await downloadStreamToPath(srcUrl, rawVid, job, 10, 75);
          job.status = 'processing';
          job.progress = 90;
          job.speed = `Extracting ${targetExt.toUpperCase()}...`;
          if (targetExt === 'm4a') {
            await runFfmpeg(['-y', '-i', rawVid, '-vn', '-c:a', 'aac', '-b:a', '192k', finalOut]);
          } else {
            await runFfmpeg(['-y', '-i', rawVid, '-vn', '-c:a', 'libmp3lame', '-b:a', '320k', finalOut]);
          }
          if (fs.existsSync(rawVid)) fs.unlinkSync(rawVid);
          job.totalSize = formatBytes(fs.statSync(finalOut).size);
          job.filePath = finalOut;
          job.status = 'ready';
          job.progress = 100;
          job.speed = 'Download Ready';
          job.eta = '00:00';
          return;
        }

        const matchedFmt = twData.metadata.formats.find((f: any) => f.id === formatId && f.directUrl);
        const videoUrl = matchedFmt?.directUrl || twData.bestUrl;
        if (!videoUrl) throw new Error('No Twitter MP4 stream available.');
        await downloadDirectStreamToFile(videoUrl, finalOut, job);
      } catch (err: any) {
        console.error('Twitter download job failed:', err);
        job.status = 'failed';
        job.error = err.message || 'Twitter/X stream processing failed.';
      }
    })();
    return;
  }

  // E. Fallback yt-dlp pipeline (Dailymotion, Instagram, Facebook, Reddit, Cookie-authenticated YouTube, Generic)
  runYtDlpJob(cleanUrl, formatId, cleanTitle, tmpDir, job);
});

function runYtDlpJob(cleanUrl: string, formatId: string, cleanTitle: string, tmpDir: string, job: ServerJob) {
  const outputFileTemplate = path.join(tmpDir, `${cleanTitle}.%(ext)s`);
  const args: string[] = [
    ...getYtDlpBaseArgs(),
    '--newline',
    '--retries',
    '5',
    '--fragment-retries',
    '5',
    '--progress-template',
    'download-status:%(progress._percent_str)s|%(progress._total_bytes_str|progress._total_bytes_estimate_str)s|%(progress._speed_str)s|%(progress._eta_str)s',
    '--progress-template',
    'post-process:%(progress.status)s',
  ];

  if (formatId === 'audio-mp3-320') {
    args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
  } else if (formatId === 'audio-mp3-128') {
    args.push('-x', '--audio-format', 'mp3', '--audio-quality', '4');
  } else if (formatId === 'audio-m4a') {
    args.push('-x', '--audio-format', 'm4a');
  } else if (formatId === 'fast-direct' || formatId === 'best') {
    args.push('-f', 'b/best');
  } else if (formatId.startsWith('best-')) {
    const height = parseInt(formatId.replace('best-', ''), 10);
    args.push('-f', `b[height<=${height}]/bv*[height<=${height}]+ba/b/best`, '--merge-output-format', 'mp4');
  } else {
    args.push('-f', 'b/best');
  }

  args.push('-o', outputFileTemplate, cleanUrl);

  const child = spawn(YT_DLP_PATH, args);
  job.status = 'downloading';
  job.speed = 'Connecting to media source...';
  job.progress = Math.max(job.progress, 10);

  let stderrLog = '';

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    const lines = text.split(/\r?\n/);

    for (const line of lines) {
      if (line.includes('download-status:')) {
        const payload = line.split('download-status:')[1].trim();
        const parts = payload.split('|');

        if (parts.length >= 4) {
          const rawPct = parseFloat(parts[0].replace('%', '').trim());
          if (!isNaN(rawPct)) {
            job.progress = Math.min(Math.max(Math.round(rawPct), 5), 98);
          }
          if (parts[1] && parts[1] !== 'N/A' && !parts[1].includes('progress.')) {
            job.totalSize = parts[1].trim();
          }
          if (parts[2] && parts[2] !== 'Unknown B/s') {
            job.speed = parts[2].trim();
          }
          if (parts[3] && parts[3] !== 'Unknown' && parts[3] !== 'NA') {
            job.eta = parts[3].trim();
          }
        }
      } else if (
        line.includes('[ExtractAudio]') ||
        line.includes('[Merger]') ||
        line.includes('[Fixup') ||
        line.includes('post-process:')
      ) {
        job.status = 'processing';
        job.progress = 96;
        job.speed = 'Muxing & Finalizing...';
        job.eta = 'Almost ready';
      } else {
        const progressMatch = line.match(/\[download\]\s+([\d\.]+)%\s+of\s+~?([\d\.]+\w+)/);
        if (progressMatch) {
          job.progress = Math.min(Math.max(Math.round(parseFloat(progressMatch[1])), 5), 98);
          job.totalSize = progressMatch[2];
        }
      }
    }
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderrLog += text;
    if (text.includes('[ExtractAudio]') || text.includes('[Merger]') || text.includes('[Fixup')) {
      job.status = 'processing';
      job.progress = 96;
      job.speed = 'Muxing & Finalizing...';
    }
  });

  child.on('close', (code) => {
    if (code === 0) {
      try {
        const files = fs.readdirSync(tmpDir);
        const targetFile = files.find((f) => !f.endsWith('.part') && !f.endsWith('.ytdl') && !f.endsWith('.temp'));
        if (targetFile) {
          const fullPath = path.join(tmpDir, targetFile);
          job.filePath = fullPath;
          job.totalSize = formatBytes(fs.statSync(fullPath).size);
          job.status = 'ready';
          job.progress = 100;
          job.speed = 'Download Ready';
          job.eta = '00:00';
          return;
        }
      } catch {
        // handle below
      }
      job.status = 'failed';
      job.error = 'Downloaded file could not be located in output directory.';
    } else {
      const cleanedErr = stderrLog.replace(/Deprecated Feature:[^\n]*\n?/g, '').trim();
      job.status = 'failed';
      if (cleanedErr.includes('not a bot') || cleanedErr.includes('Sign in')) {
        job.error =
          'YouTube requested bot verification for this video on the cloud server. Paste your YouTube session cookies (cookies.txt) below to unlock and retry.';
      } else {
        job.error =
          cleanedErr && cleanedErr.length < 350
            ? cleanedErr
            : `Download exited with code ${code}. Please try Instant Stream.`;
      }
    }
  });

  child.on('error', (err) => {
    job.status = 'failed';
    job.error = err.message;
  });
}

// 4. Poll job status
app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found or expired.' });
  }

  res.json({
    job: {
      jobId: job.id,
      id: job.id,
      url: job.url,
      title: job.title,
      formatId: job.formatId,
      formatLabel: job.formatLabel,
      ext: job.ext,
      status: job.status,
      progress: job.progress,
      speed: job.speed,
      eta: job.eta,
      totalSize: job.totalSize,
      downloadUrl: job.status === 'ready' ? `/api/jobs/${job.id}/file` : undefined,
      error: job.error,
      timestamp: job.created,
    },
  });
});

// 5. Search videos by filename, title, or keyword (Dailymotion Fast-Stream + YouTube Innertube)
app.get('/api/search', async (req, res) => {
  const query = (req.query.q as string)?.trim();
  if (!query) {
    return res.status(400).json({ error: 'Search query parameter "q" is required.' });
  }

  const limit = Math.min(parseInt((req.query.limit as string) || '12', 10), 25);

  try {
    const [dmSettled, ytSettled] = await Promise.allSettled([
      searchDailymotion(query, Math.min(5, limit)),
      searchYouTube(query, limit),
    ]);

    const dmResults = dmSettled.status === 'fulfilled' ? dmSettled.value : [];
    const ytResults =
      ytSettled.status === 'fulfilled'
        ? ytSettled.value.map((r: any) => ({ ...r, source: 'youtube' }))
        : [];

    // Prioritize cloud-ready Dailymotion streams when cookies aren't configured so 1-click search downloads succeed reliably,
    // while keeping full YouTube search catalog right alongside them.
    const combined = hasUserCookies()
      ? [...ytResults, ...dmResults]
      : [...dmResults.slice(0, 3), ...ytResults, ...dmResults.slice(3)];

    if (combined.length > 0) {
      return res.json({
        success: true,
        query,
        count: combined.slice(0, limit).length,
        results: combined.slice(0, limit),
      });
    }
  } catch (searchErr: any) {
    console.warn('Hybrid search failed, falling back to yt-dlp:', searchErr.message);
  }

  try {
    const args = [
      ...getYtDlpBaseArgs(),
      `ytsearch${limit}:${query}`,
      '-J',
      '--flat-playlist',
    ];

    const { stdout } = await execFileAsync(YT_DLP_PATH, args, { maxBuffer: 10 * 1024 * 1024 });
    const raw = JSON.parse(stdout);
    const rawEntries = raw.entries || [];
    const results = rawEntries.map((entry: any) => {
      let thumb = '';
      if (entry.thumbnails && entry.thumbnails.length > 0) {
        thumb = entry.thumbnails[entry.thumbnails.length - 1]?.url || entry.thumbnails[0]?.url;
      } else if (entry.thumbnail) {
        thumb = entry.thumbnail;
      } else if (entry.id) {
        thumb = `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`;
      }

      const duration = entry.duration || 0;
      return {
        id: entry.id,
        url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
        title: entry.title || 'Untitled Video',
        uploader: entry.channel || entry.uploader || 'Creator',
        duration,
        durationFormatted: formatDuration(duration),
        viewCount: entry.view_count || null,
        viewCountFormatted: formatViews(entry.view_count),
        thumbnail: thumb,
        source: 'youtube',
      };
    });

    res.json({
      success: true,
      query,
      count: results.length,
      results,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Search failed.', message: err.message });
  }
});

// 6. Download ready file
app.get('/api/jobs/:id/file', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.status !== 'ready' || !job.filePath || !fs.existsSync(job.filePath)) {
    return res.status(404).send('File not found, expired, or still processing.');
  }

  const stat = fs.statSync(job.filePath);
  const ext = path.extname(job.filePath).replace('.', '') || job.ext || 'mp4';
  const mime =
    ext === 'mp3' ? 'audio/mpeg' : ext === 'm4a' ? 'audio/mp4' : ext === 'webm' ? 'video/webm' : 'video/mp4';

  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(job.title)}.${ext}"`);

  const fileStream = fs.createReadStream(job.filePath);
  fileStream.pipe(res);
});

// 7. Range-enabled In-App Video Preview Proxy (handles YouTube, TikTok, Twitter)
app.get('/api/preview', async (req, res) => {
  const rawUrl = (req.query.url as string)?.trim();
  if (!rawUrl) return res.status(400).send('Missing url');

  try {
    let mediaUrl: string | undefined;

    const ytId = extractYouTubeVideoId(rawUrl);
    if (ytId) {
      const resolved = await resolveYouTubeDownload(ytId, 'fast-direct');
      mediaUrl = resolved.videoUrl;
    } else if (isTikTokUrl(rawUrl)) {
      const canonical = await resolveTikTokCanonicalUrl(rawUrl);
      const data = await fetchTikWMData(canonical);
      mediaUrl = data.play;
    } else {
      const tw = extractTweetParams(rawUrl);
      if (tw) {
        const data = await extractTwitterData(tw.user, tw.id, rawUrl);
        mediaUrl = data.bestUrl;
      }
    }

    if (!mediaUrl) {
      return res.status(404).send('Preview stream unavailable');
    }

    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    };
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const upstream = await fetch(mediaUrl, { headers });
    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status).send('Preview upstream failed');
    }

    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) res.setHeader('Content-Range', contentRange);

    if (!upstream.body) return res.end();
    const reader = upstream.body.getReader();
    res.on('close', () => {
      reader.cancel().catch(() => {});
    });
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
    res.end();
  } catch (err: any) {
    console.error('Preview proxy error:', err.message);
    if (!res.headersSent) res.status(500).send('Preview error');
  }
});

// 8. 1-Click Direct Download Endpoint
app.get('/api/download', async (req, res) => {
  const { url, format, ext, title } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).send('Missing video URL parameter.');
  }

  const cleanUrl = extractUrlFromText(url);
  let decodedTitle = (title as string) || 'download';
  try {
    decodedTitle = decodeURIComponent(decodedTitle);
  } catch {
    // keep as-is
  }
  const cleanTitle = sanitizeFilename(decodedTitle);
  const formatId = (format as string) || 'fast-direct';
  const targetExt =
    (ext as string) ||
    (formatId.startsWith('audio-mp3') ? 'mp3' : formatId.startsWith('audio-m4a') ? 'm4a' : 'mp4');

  // A. YouTube direct stream
  const ytId = extractYouTubeVideoId(cleanUrl);
  if (ytId) {
    try {
      const resolved = await resolveYouTubeDownload(
        ytId,
        formatId.startsWith('audio-') ? formatId : 'fast-direct'
      );

      if (resolved.mode === 'direct' && resolved.videoUrl) {
        const response = await fetch(resolved.videoUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          },
        });
        if (!response.ok || !response.body) {
          throw new Error(`YouTube CDN returned ${response.status}`);
        }
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(cleanTitle)}.mp4"`);
        res.setHeader('Content-Type', 'video/mp4');
        const len = response.headers.get('content-length');
        if (len) res.setHeader('Content-Length', len);

        const reader = response.body.getReader();
        res.on('close', () => reader.cancel().catch(() => {}));
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) res.write(Buffer.from(value));
        }
        return res.end();
      }

      if (resolved.mode === 'audio' && resolved.audioUrl) {
        const audioRes = await fetch(resolved.audioUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          },
        });
        if (!audioRes.ok || !audioRes.body) {
          throw new Error(`YouTube audio CDN returned ${audioRes.status}`);
        }

        if (resolved.outExt === 'm4a' && resolved.audioExt === 'm4a') {
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(cleanTitle)}.m4a"`);
          res.setHeader('Content-Type', 'audio/mp4');
          const len = audioRes.headers.get('content-length');
          if (len) res.setHeader('Content-Length', len);
          const reader = audioRes.body.getReader();
          res.on('close', () => reader.cancel().catch(() => {}));
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) res.write(Buffer.from(value));
          }
          return res.end();
        }

        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${encodeURIComponent(cleanTitle)}.${resolved.outExt}"`
        );
        res.setHeader('Content-Type', resolved.outExt === 'm4a' ? 'audio/mp4' : 'audio/mpeg');

        const ffArgs =
          resolved.outExt === 'm4a'
            ? ['-i', 'pipe:0', '-vn', '-c:a', 'aac', '-b:a', '192k', '-f', 'adts', 'pipe:1']
            : ['-i', 'pipe:0', '-vn', '-c:a', 'libmp3lame', '-b:a', `${resolved.bitrateKbps || 320}k`, '-f', 'mp3', 'pipe:1'];
        const ff = spawn(FFMPEG_PATH, ffArgs);
        ff.stdout.pipe(res);
        res.on('close', () => ff.kill('SIGKILL'));

        const reader = audioRes.body.getReader();
        (async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) ff.stdin.write(Buffer.from(value));
            }
            ff.stdin.end();
          } catch {
            ff.kill('SIGKILL');
          }
        })();
        return;
      }
    } catch (ytErr: any) {
      console.warn('Direct YouTube stream error:', ytErr.message);
      if (!hasUserCookies()) {
        if (!res.headersSent) return res.status(500).send(ytErr.message || 'YouTube stream failed.');
        return;
      }
      // Fall through to yt-dlp with session cookies when available
    }
  }

  // B. TikTok specialized direct stream pipeline
  if (isTikTokUrl(cleanUrl)) {
    try {
      const canonical = await resolveTikTokCanonicalUrl(cleanUrl);
      const data = await fetchTikWMData(canonical);

      let mediaUrl = data.play;
      let finalExt = 'mp4';

      if (formatId.startsWith('audio-') || targetExt === 'mp3' || targetExt === 'm4a') {
        mediaUrl = data.music || data.play;
        finalExt = targetExt === 'm4a' ? 'm4a' : 'mp3';
      } else if (formatId === 'tiktok-wm') {
        mediaUrl = data.wmplay || data.play;
        finalExt = 'mp4';
      }

      if (!mediaUrl) throw new Error('TikTok media stream URL not available.');

      const response = await fetch(mediaUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok || !response.body) {
        throw new Error(`Upstream returned ${response.status}`);
      }

      const mime = finalExt === 'mp3' ? 'audio/mpeg' : finalExt === 'm4a' ? 'audio/mp4' : 'video/mp4';
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(cleanTitle)}.${finalExt}"`);
      res.setHeader('Content-Type', mime);
      const len = response.headers.get('content-length');
      if (len) res.setHeader('Content-Length', len);

      const reader = response.body.getReader();
      res.on('close', () => reader.cancel().catch(() => {}));
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          res.write(Buffer.from(value));
        }
      }
      return res.end();
    } catch (tikErr: any) {
      console.warn('Direct TikTok stream fallback to yt-dlp:', tikErr.message);
    }
  }

  // C. Twitter / X direct stream
  const tweetParams = extractTweetParams(cleanUrl);
  if (tweetParams && targetExt === 'mp4') {
    try {
      const tw = await extractTwitterData(tweetParams.user, tweetParams.id, cleanUrl);
      if (tw.bestUrl) {
        const response = await fetch(tw.bestUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (response.ok && response.body) {
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(cleanTitle)}.mp4"`);
          res.setHeader('Content-Type', 'video/mp4');
          const len = response.headers.get('content-length');
          if (len) res.setHeader('Content-Length', len);
          const reader = response.body.getReader();
          res.on('close', () => reader.cancel().catch(() => {}));
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) res.write(Buffer.from(value));
          }
          return res.end();
        }
      }
    } catch {
      // fall through
    }
  }

  // D. Generic yt-dlp stream fallback (supports both video and FFmpeg stdout audio transcoding)
  const mime = targetExt === 'mp3' ? 'audio/mpeg' : targetExt === 'm4a' ? 'audio/mp4' : 'video/mp4';
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(cleanTitle)}.${targetExt}"`);
  res.setHeader('Content-Type', mime);

  if (targetExt === 'mp3' || targetExt === 'm4a') {
    const args: string[] = [...getYtDlpBaseArgs(), '-f', 'ba/b/best', '-o', '-', cleanUrl];
    const ytdlpProc = spawn(YT_DLP_PATH, args);
    const ffArgs =
      targetExt === 'm4a'
        ? ['-i', 'pipe:0', '-vn', '-c:a', 'aac', '-b:a', '192k', '-f', 'adts', 'pipe:1']
        : [
            '-i',
            'pipe:0',
            '-vn',
            '-c:a',
            'libmp3lame',
            '-b:a',
            formatId === 'audio-mp3-128' ? '128k' : '320k',
            '-f',
            'mp3',
            'pipe:1',
          ];
    const ffProc = spawn(FFMPEG_PATH, ffArgs);
    ytdlpProc.stdout.pipe(ffProc.stdin);
    ffProc.stdout.pipe(res);

    ytdlpProc.on('error', (err) => {
      console.error('Direct yt-dlp audio error:', err);
      ffProc.kill('SIGKILL');
      if (!res.headersSent) res.status(500).send('Failed to stream audio.');
    });
    ffProc.on('error', (err) => {
      console.error('Direct ffmpeg audio error:', err);
      ytdlpProc.kill('SIGKILL');
      if (!res.headersSent) res.status(500).send('Failed to encode audio.');
    });
    res.on('close', () => {
      ytdlpProc.kill('SIGKILL');
      ffProc.kill('SIGKILL');
    });
    return;
  }

  const args: string[] = [...getYtDlpBaseArgs(), '-o', '-'];
  if (formatId === 'fast-direct' || formatId === 'best') {
    args.push('-f', 'b/best');
  } else if (formatId.startsWith('best-')) {
    const height = parseInt(formatId.replace('best-', ''), 10);
    args.push('-f', `b[height<=${height}]/b/best`);
  } else {
    args.push('-f', 'b/best');
  }
  args.push(cleanUrl);

  const child = spawn(YT_DLP_PATH, args);
  child.stdout.pipe(res);

  child.on('error', (err) => {
    console.error('Direct download error:', err);
    if (!res.headersSent) {
      res.status(500).send('Failed to stream download.');
    }
  });

  res.on('close', () => {
    child.kill('SIGKILL');
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Downloader server running on port ${PORT}`);
  });
}

startServer();
