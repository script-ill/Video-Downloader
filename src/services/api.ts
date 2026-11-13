import { DownloadJob, SearchResultItem, VideoMetadata } from '../types';

export async function checkServerHealth(): Promise<{ status: string; ytdlp: boolean; ffmpeg: boolean }> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('Health check failed');
    return await res.json();
  } catch (err) {
    return { status: 'error', ytdlp: false, ffmpeg: false };
  }
}

export async function extractVideoMetadata(url: string): Promise<VideoMetadata> {
  const res = await fetch('/api/extract', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: url.trim() }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to extract video information. Please check the URL.');
  }

  return data.data;
}

export async function searchVideos(query: string, limit: number = 12): Promise<SearchResultItem[]> {
  const params = new URLSearchParams({
    q: query.trim(),
    limit: limit.toString(),
  });
  const res = await fetch(`/api/search?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Search request failed.');
  }
  return data.results || [];
}

export async function startDownloadJob(
  url: string,
  formatId: string,
  formatLabel: string,
  ext: string,
  title: string
): Promise<DownloadJob> {
  const res = await fetch('/api/jobs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: url.trim(),
      formatId,
      formatLabel,
      ext,
      title,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to start download job.');
  }

  return data.job;
}

export async function pollJobStatus(jobId: string): Promise<DownloadJob> {
  if (!jobId || jobId === 'undefined') {
    throw new Error('Valid Job ID is required for polling.');
  }
  const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to retrieve job status.');
  }
  return data.job;
}

export function buildDirectDownloadUrl(url: string, formatId: string, ext: string, title: string): string {
  const params = new URLSearchParams({
    url: url.trim(),
    format: formatId,
    ext,
    title,
  });
  return `/api/download?${params.toString()}`;
}

export async function getCookiesStatus(): Promise<boolean> {
  try {
    const res = await fetch('/api/cookies');
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.hasCookies);
  } catch {
    return false;
  }
}

export async function saveCookies(cookies: string): Promise<boolean> {
  const res = await fetch('/api/cookies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cookies }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save cookies');
  return Boolean(data.hasCookies);
}
