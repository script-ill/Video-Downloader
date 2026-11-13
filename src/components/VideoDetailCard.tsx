import React from 'react';
import { VideoMetadata } from '../types';
import { formatViews } from '../utils/formatters';
import { 
  Play, 
  ExternalLink, 
  User, 
  Clock, 
  Eye, 
  CheckCircle2, 
  Share2 
} from 'lucide-react';

interface VideoDetailCardProps {
  metadata: VideoMetadata;
  onOpenPreview: () => void;
}

export const VideoDetailCard: React.FC<VideoDetailCardProps> = ({
  metadata,
  onOpenPreview,
}) => {
  return (
    <div
      id="video-detail-card"
      className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 shadow-sm transition"
    >
      <div className="flex flex-col md:flex-row gap-5 items-start">
        {/* Thumbnail with overlay duration & preview button */}
        <div className="relative group w-full md:w-72 sm:min-w-[280px] aspect-video rounded-xl overflow-hidden bg-zinc-950 shrink-0 shadow-inner">
          {metadata.thumbnail ? (
            <img
              src={metadata.thumbnail}
              alt={metadata.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">
              No Preview Image
            </div>
          )}

          {/* Duration Badge */}
          {metadata.durationFormatted && (
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-xs text-[11px] font-bold text-white tracking-wider">
              {metadata.durationFormatted}
            </div>
          )}

          {/* Quick Play Trigger Overlay */}
          <button
            id="open-preview-player-btn"
            onClick={onOpenPreview}
            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer"
            title="Preview video"
          >
            <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition">
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </div>
          </button>
        </div>

        {/* Video Info Details */}
        <div className="flex-1 flex flex-col justify-between w-full">
          <div>
            <div className="flex items-center space-x-2 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                {metadata.platform.toUpperCase()}
              </span>
              <span className="inline-flex items-center text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Stream Ready
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white leading-snug line-clamp-2 mb-2">
              {metadata.title}
            </h2>

            {/* Creator / Channel & Meta Stats */}
            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-zinc-500 dark:text-zinc-400 mb-3">
              {metadata.uploader && (
                <div className="flex items-center space-x-1 font-medium text-zinc-700 dark:text-zinc-300">
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{metadata.uploader}</span>
                </div>
              )}

              {metadata.duration > 0 && (
                <div className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{metadata.durationFormatted}</span>
                </div>
              )}

              {metadata.viewCount !== undefined && metadata.viewCount > 0 && (
                <div className="flex items-center space-x-1">
                  <Eye className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{formatViews(metadata.viewCount)}</span>
                </div>
              )}
            </div>

            {/* Short snippet of description */}
            {metadata.description && (
              <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-3 bg-zinc-50 dark:bg-zinc-800/40 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800">
                {metadata.description}
              </p>
            )}
          </div>

          {/* Action Row */}
          <div className="flex items-center space-x-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              id="detail-card-preview-btn"
              onClick={onOpenPreview}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 transition cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Watch Preview</span>
            </button>

            <a
              id="detail-card-original-link"
              href={metadata.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
            >
              <span>Original Post</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
