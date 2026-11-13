import React, { useState } from 'react';
import { VideoFormat, VideoMetadata } from '../types';
import { 
  Download, 
  Film, 
  Music, 
  Sparkles, 
  Check, 
  Copy, 
  ExternalLink,
  ShieldAlert,
  SlidersHorizontal,
  Flame
} from 'lucide-react';
import { buildDirectDownloadUrl } from '../services/api';

interface FormatMatrixProps {
  metadata: VideoMetadata;
  onStartDownload: (format: VideoFormat) => void;
  activeDownloadingFormatId?: string;
}

export const FormatMatrix: React.FC<FormatMatrixProps> = ({
  metadata,
  onStartDownload,
  activeDownloadingFormatId,
}) => {
  const [activeTab, setActiveTab] = useState<'video' | 'audio' | 'all'>('video');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const videoFormats = metadata.formats.filter((f) => f.hasVideo && !f.isAudioOnly);
  const audioFormats = metadata.formats.filter((f) => f.isAudioOnly);

  const displayedFormats =
    activeTab === 'video'
      ? videoFormats
      : activeTab === 'audio'
      ? audioFormats
      : metadata.formats;

  const handleCopyLink = (format: VideoFormat, e: React.MouseEvent) => {
    e.stopPropagation();
    const downloadUrl = window.location.origin + buildDirectDownloadUrl(metadata.url, format.id, format.ext, metadata.title);
    navigator.clipboard.writeText(downloadUrl);
    setCopiedId(format.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      id="format-matrix-container"
      className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 shadow-sm"
    >
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center space-x-2">
            <span>Select Quality & Format</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              {metadata.formats.length} Options
            </span>
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Full quality processing with muxed audio, high bitrates, and MP3 conversion.
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex flex-wrap items-center bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl max-w-full self-start sm:self-auto gap-0.5">
          <button
            id="tab-filter-video"
            type="button"
            onClick={() => setActiveTab('video')}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'video'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5 shrink-0" />
            <span>Video (HD/4K)</span>
            <span className="text-[10px] opacity-70">({videoFormats.length})</span>
          </button>

          <button
            id="tab-filter-audio"
            type="button"
            onClick={() => setActiveTab('audio')}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'audio'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Music className="w-3.5 h-3.5 shrink-0" />
            <span>Audio (MP3)</span>
            <span className="text-[10px] opacity-70">({audioFormats.length})</span>
          </button>

          <button
            id="tab-filter-all"
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span>All</span>
          </button>
        </div>
      </div>

      {/* Format Items List / Grid */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {displayedFormats.map((format) => {
          const isDownloading = activeDownloadingFormatId === format.id;
          const is4k = format.quality.includes('2160') || format.label.includes('4K');
          const is1080 = format.quality.includes('1080');
          const isMp3HQ = format.id === 'audio-mp3-320';

          return (
            <div
              key={format.id}
              id={`format-card-${format.id}`}
              className={`relative flex items-center justify-between p-3.5 rounded-xl border transition group ${
                is4k
                  ? 'border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/50 to-violet-50/20 dark:from-indigo-950/20 dark:to-zinc-900 hover:border-indigo-300'
                  : is1080
                  ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/10 hover:border-emerald-300'
                  : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              {/* Left Info */}
              <div className="flex items-center space-x-3 min-w-0 pr-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    format.isAudioOnly
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                      : is4k
                      ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-500/30'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {format.isAudioOnly ? (
                    <Music className="w-5 h-5" />
                  ) : is4k ? (
                    <Sparkles className="w-5 h-5" />
                  ) : (
                    <Film className="w-5 h-5" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                      {format.label}
                    </span>
                    {format.tag && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                          format.tag === 'Ultra HD'
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                            : format.tag === 'Recommended'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {format.tag}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    <span className="uppercase font-semibold text-zinc-700 dark:text-zinc-300">
                      {format.ext}
                    </span>
                    <span>•</span>
                    <span>{format.filesizeFormatted}</span>
                    {format.fps && format.fps > 30 && (
                      <>
                        <span>•</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                          {format.fps}fps
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Action Buttons */}
              <div className="flex items-center space-x-2 shrink-0">
                {/* Copy Direct Link Button */}
                <button
                  type="button"
                  id={`copy-link-${format.id}`}
                  onClick={(e) => handleCopyLink(format, e)}
                  className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition cursor-pointer"
                  title="Copy direct download link"
                >
                  {copiedId === format.id ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>

                {/* Primary Download Button */}
                <button
                  id={`download-btn-${format.id}`}
                  onClick={() => onStartDownload(format)}
                  disabled={isDownloading}
                  className={`inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
                    is4k
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
                      : is1080
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{isDownloading ? 'Processing...' : 'Download'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
