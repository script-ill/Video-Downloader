export type SocialPlatform =
  | 'youtube'
  | 'instagram'
  | 'tiktok'
  | 'twitter'
  | 'facebook'
  | 'reddit'
  | 'threads'
  | 'vimeo'
  | 'pinterest'
  | 'twitch'
  | 'generic';

export interface VideoFormat {
  id: string;
  label: string;
  resolution: string;
  ext: string;
  filesize: number | null;
  filesizeFormatted: string;
  fps?: number;
  hasAudio: boolean;
  hasVideo: boolean;
  isAudioOnly: boolean;
  quality: string;
  tag?: string;
  bitrate?: number;
  vcodec?: string;
  acodec?: string;
  directUrl?: string;
}

export interface VideoMetadata {
  id: string;
  url: string;
  title: string;
  description: string;
  thumbnail: string;
  uploader: string;
  uploaderUrl?: string;
  duration: number;
  durationFormatted: string;
  viewCount?: number;
  likeCount?: number;
  uploadDate?: string;
  platform: SocialPlatform;
  formats: VideoFormat[];
  previewUrl?: string;
}

export interface DownloadJob {
  jobId: string;
  id?: string;
  url: string;
  title: string;
  formatId: string;
  formatLabel: string;
  ext: string;
  status: 'queued' | 'downloading' | 'processing' | 'ready' | 'failed';
  progress: number;
  speed?: string;
  eta?: string;
  totalSize?: string;
  downloadUrl?: string;
  error?: string;
  timestamp: number;
}

export interface SearchResultItem {
  id: string;
  url: string;
  title: string;
  uploader: string;
  duration: number;
  durationFormatted: string;
  viewCount?: number;
  viewCountFormatted?: string;
  thumbnail: string;
  source?: string;
}

export interface DownloadHistoryItem {
  id: string;
  title: string;
  thumbnail: string;
  platform: SocialPlatform;
  formatLabel: string;
  filesizeFormatted: string;
  timestamp: number;
  url: string;
  formatId: string;
}

export interface PlatformConfig {
  id: SocialPlatform;
  name: string;
  domainPattern: RegExp;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  brandColor: string;
  icon: string;
  sampleUrl: string;
  sampleLabel: string;
  description: string;
}
