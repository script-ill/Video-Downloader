import React, { useState } from 'react';
import { VideoMetadata, VideoFormat } from '../types';
import { 
  X, 
  Film, 
  Music, 
  Download, 
  Zap, 
  SlidersHorizontal, 
  Check, 
  Copy, 
  ExternalLink,
  Loader2,
  AlertCircle,
  Clock,
  User,
  Sparkles
} from 'lucide-react';
import { buildDirectDownloadUrl } from '../services/api';

interface QualityPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: VideoMetadata | null;
  isLoading: boolean;
  error: string | null;
  onStartDownload: (format: VideoFormat) => void;
  onOpenFullStudio?: () => void;
  videoTitle?: string;
  videoUrl?: string;
}

export const QualityPickerModal: React.FC<QualityPickerModalProps> = ({
  isOpen,
  onClose,
  metadata,
  isLoading,
  error,
  onStartDownload,
  onOpenFullStudio,
  videoTitle,
  videoUrl,
}) => {
  const [activeTab, setActiveTab] = useState<'video' | 'audio'>('video');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentTitle = metadata?.title || videoTitle || 'Selected Video';
  const currentUrl = metadata?.url || videoUrl || '';

  const videoFormats = metadata?.formats.filter((f) => f.hasVideo && !f.isAudioOnly) || [];
  const audioFormats = metadata?.formats.filter((f) => f.isAudioOnly) || [];
  const displayedFormats = activeTab === 'video' ? videoFormats : audioFormats;

  const handleCopyLink = (format: VideoFormat, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUrl) return;
    const downloadUrl = window.location.origin + buildDirectDownloadUrl(currentUrl, format.id, format.ext, currentTitle);
    navigator.clipboard.writeText(downloadUrl);
    setCopiedId(format.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInstantStream = () => {
    if (!currentUrl) return;
    const downloadUrl = buildDirectDownloadUrl(
      currentUrl,
      activeTab === 'video' ? 'fast-direct' : 'audio-mp3-320',
      activeTab === 'video' ? 'mp4' : 'mp3',
      currentTitle
    );
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${currentTitle}.${activeTab === 'video' ? 'mp4' : 'mp3'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      id="quality-picker-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        id="quality-picker-modal-card"
        className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] touch-manipulation"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center space-x-2.5 min-w-0 pr-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white truncate">
                Choose Download Quality
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                Select resolution or audio bitrate
              </p>
            </div>
          </div>

          <button
            id="close-quality-picker-modal-btn"
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Preview Snippet */}
        <div className="p-4 sm:p-5 pb-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center space-x-3">
            {metadata?.thumbnail ? (
              <div className="relative w-20 h-14 rounded-lg overflow-hidden bg-zinc-950 shrink-0 shadow-xs">
                <img
                  src={metadata.thumbnail}
                  alt={currentTitle}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                {metadata.durationFormatted && (
                  <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/80 text-[10px] font-bold text-white leading-none">
                    {metadata.durationFormatted}
                  </span>
                )}
              </div>
            ) : null}

            <div className="min-w-0 flex-1">
              <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white line-clamp-2 leading-snug">
                {currentTitle}
              </h4>
              <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {metadata?.uploader && (
                  <span className="flex items-center font-medium truncate max-w-[150px]">
                    <User className="w-3 h-3 mr-1 shrink-0" />
                    {metadata.uploader}
                  </span>
                )}
                {metadata?.platform && (
                  <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                    {metadata.platform}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Format Type Tabs */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl mt-4">
            <button
              id="quality-picker-tab-video"
              type="button"
              onClick={() => setActiveTab('video')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer min-h-[40px] ${
                activeTab === 'video'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Film className="w-4 h-4" />
              <span>Video Qualities ({videoFormats.length})</span>
            </button>

            <button
              id="quality-picker-tab-audio"
              type="button"
              onClick={() => setActiveTab('audio')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer min-h-[40px] ${
                activeTab === 'audio'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Music className="w-4 h-4" />
              <span>Audio Only ({audioFormats.length})</span>
            </button>
          </div>
        </div>

        {/* Formats List Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Extracting high-resolution formats & bitrates...
              </p>
            </div>
          ) : error ? (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300 space-y-3">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="font-semibold">Format Extraction Notice</p>
                  <p className="opacity-90 break-words leading-relaxed">{error}</p>
                </div>
              </div>

              {/* Fallback Direct Download Buttons */}
              <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/60 space-y-2">
                <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Instant Direct Download Alternatives:
                </p>
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onStartDownload({
                        id: 'fast-direct',
                        label: 'Best Available HD MP4',
                        resolution: 'Best MP4',
                        ext: 'mp4',
                        filesize: null,
                        filesizeFormatted: 'Standard',
                        hasAudio: true,
                        hasVideo: true,
                        isAudioOnly: false,
                        quality: 'HD',
                        tag: 'Direct',
                      });
                      onClose();
                    }}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs active:scale-95"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span>Best HD MP4</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onStartDownload({
                        id: 'audio-mp3-320',
                        label: 'Master MP3 Audio',
                        resolution: 'Audio Only',
                        ext: 'mp3',
                        filesize: null,
                        filesizeFormatted: '320kbps',
                        hasAudio: true,
                        hasVideo: false,
                        isAudioOnly: true,
                        quality: '320kbps',
                        tag: 'Master',
                      });
                      onClose();
                    }}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs active:scale-95"
                  >
                    <Music className="w-4 h-4 shrink-0" />
                    <span>MP3 Audio</span>
                  </button>
                </div>
              </div>
            </div>
          ) : displayedFormats.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
              No specific {activeTab} streams detected. Try Instant Stream below.
            </div>
          ) : (
            displayedFormats.map((format) => (
              <div
                key={format.id}
                className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-white dark:bg-zinc-900 transition flex items-center justify-between gap-2.5 shadow-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white truncate">
                      {format.resolution}
                    </span>
                    <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {format.ext}
                    </span>
                    {format.tag && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                        {format.tag}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                    {format.label} • {format.filesizeFormatted}
                  </p>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => handleCopyLink(format, e)}
                    className="p-2.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
                    title="Copy direct download link"
                  >
                    {copiedId === format.id ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onStartDownload(format);
                      onClose();
                    }}
                    className="min-h-[44px] px-3 sm:px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer shadow-xs active:scale-95 touch-manipulation"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            ))
          )}

          {/* Instant Stream Callout */}
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 mt-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5 text-amber-800 dark:text-amber-300 font-bold text-xs">
                <Zap className="w-3.5 h-3.5 fill-current shrink-0" />
                <span>Instant Direct Stream</span>
              </div>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 break-words">
                Direct stream without server background jobs
              </p>
            </div>
            <button
              type="button"
              onClick={handleInstantStream}
              className="shrink-0 w-full sm:w-auto min-h-[44px] px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center justify-center space-x-1 active:scale-95 touch-manipulation"
            >
              <span>Instant Download</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between shrink-0">
          {onOpenFullStudio ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFullStudio();
              }}
              className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition cursor-pointer flex items-center space-x-1"
            >
              <span>Open in Full Studio</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1" />
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
