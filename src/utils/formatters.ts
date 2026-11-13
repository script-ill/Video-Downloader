import { SocialPlatform } from '../types';

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return 'Unknown size';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
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

export function formatViews(views: number | null | undefined): string {
  if (views === null || views === undefined || isNaN(views)) return '';
  if (views >= 1_000_000_000) {
    return `${(views / 1_000_000_000).toFixed(1)}B views`;
  }
  if (views >= 1_000_000) {
    return `${(views / 1_000_000).toFixed(1)}M views`;
  }
  if (views >= 1_000) {
    return `${(views / 1_000).toFixed(1)}K views`;
  }
  return `${views.toLocaleString()} views`;
}

export function detectPlatformFromUrl(rawUrl: string): SocialPlatform {
  if (!rawUrl) return 'generic';
  const url = rawUrl.toLowerCase().trim();

  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('instagram.com') || url.includes('instagr.am')) return 'instagram';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('twitter.com') || url.includes('x.com') || url.includes('t.co')) return 'twitter';
  if (url.includes('facebook.com') || url.includes('fb.watch') || url.includes('fb.com')) return 'facebook';
  if (url.includes('reddit.com') || url.includes('v.redd.it')) return 'reddit';
  if (url.includes('threads.net')) return 'threads';
  if (url.includes('vimeo.com')) return 'vimeo';
  if (url.includes('pinterest.com') || url.includes('pin.it')) return 'pinterest';
  if (url.includes('twitch.tv')) return 'twitch';

  return 'generic';
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}
