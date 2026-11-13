import React from 'react';
import { 
  Play, 
  Download, 
  Music, 
  Video, 
  Sparkles, 
  Clock, 
  Eye, 
  ExternalLink, 
  Loader2, 
  SlidersHorizontal,
  Search
} from 'lucide-react';
import { SearchResultItem, VideoFormat } from '../types';

interface SearchResultsListProps {
  query: string;
  results: SearchResultItem[];
  isLoading: boolean;
  onSelectVideo: (url: string, title?: string) => void;
  onQuickDownload: (url: string, title: string, formatId: string, ext: string, label: string) => void;
  onPreview: (url: string, title: string) => void;
  onSearchSuggested: (term: string) => void;
  loadingUrl?: string | null;
}

export const SearchResultsList: React.FC<SearchResultsListProps> = ({
  query,
  results,
  isLoading,
  onSelectVideo,
  onQuickDownload,
  onPreview,
  onSearchSuggested,
  loadingUrl,
}) => {
  const suggestedQueries = [
    'Adele Rolling in the Deep',
    'Lofi hip hop radio beats to relax',
    'NoCopyrightSounds Gaming Mix',
    '4K HDR Nature Wildlife Relax',
    'Top Trends Shorts',
  ];

  if (isLoading) {
    return (
      <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 text-center shadow-xs">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
        <h3 className="text-base font-bold text-zinc-900 dark:text-white">
          Searching media for "{query}"...
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Detecting video streams and parsing download qualities
        </p>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-xs text-center">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
          <Search className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-1">
          {query ? `No results found for "${query}"` : 'Search Any Video or Audio by Name'}
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mb-5">
          Type any song, creator, movie clip, topic, or file name. We detect matching videos ready for instant download in multiple qualities.
        </p>

        <div className="text-left border-t border-zinc-100 dark:border-zinc-800 pt-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center mb-2.5">
            <Sparkles className="w-3 h-3 text-amber-500 mr-1" />
            Popular Searches
          </span>
          <div className="flex flex-wrap gap-1.5">
            {suggestedQueries.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => onSearchSuggested(term)}
                className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
            Found {results.length} results for <span className="text-indigo-600 dark:text-indigo-400">"{query}"</span>
          </span>
        </div>
        <span className="text-[11px] font-medium text-zinc-400">
          Ready for quality extraction
        </span>
      </div>

      <div className="space-y-3">
        {results.map((item, index) => (
          <div
            key={item.id || index}
            className="group bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3 sm:p-3.5 shadow-xs hover:border-indigo-500/50 hover:shadow-md transition flex flex-col sm:flex-row gap-3.5"
          >
            {/* Thumbnail Box */}
            <div className="relative shrink-0 w-full sm:w-40 aspect-video sm:aspect-4/3 rounded-xl overflow-hidden bg-zinc-950">
              <img
                src={item.thumbnail}
                alt={item.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;
                }}
              />
              
              {/* Duration Badge */}
              <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-white flex items-center">
                <Clock className="w-2.5 h-2.5 mr-0.5" />
                <span>{item.durationFormatted}</span>
              </div>

              {/* Source Badge */}
              {item.source && (
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-bold text-white uppercase tracking-wide">
                  {item.source === 'dailymotion' ? 'HD Stream' : 'YouTube'}
                </div>
              )}

              {/* Quick Preview Hover Trigger */}
              <button
                type="button"
                onClick={() => onPreview(item.url, item.title)}
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer text-white"
                title="Preview Video"
              >
                <div className="w-9 h-9 rounded-full bg-white/30 backdrop-blur-xs flex items-center justify-center hover:scale-110 transition">
                  <Play className="w-4 h-4 fill-white ml-0.5" />
                </div>
              </button>
            </div>

            {/* Video Info and Actions */}
            <div className="flex-1 flex flex-col justify-between min-w-0">
              <div>
                <h4
                  onClick={() => onSelectVideo(item.url, item.title)}
                  className="text-sm font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition leading-snug"
                >
                  {item.title}
                </h4>

                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate max-w-[140px]">
                    {item.uploader}
                  </span>
                  {item.viewCountFormatted && (
                    <>
                      <span>•</span>
                      <span className="flex items-center">
                        <Eye className="w-3 h-3 mr-0.5" />
                        {item.viewCountFormatted}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Ready-for-Downloading Action Buttons */}
              <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center gap-1.5">
                {/* 1. Main Action: Choose Quality & Full Matrix */}
                <button
                  id={`choose-quality-btn-${item.id}`}
                  type="button"
                  onClick={() => onSelectVideo(item.url, item.title)}
                  disabled={loadingUrl === item.url}
                  className="flex-1 min-w-[150px] min-h-[44px] inline-flex items-center justify-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-75 disabled:active:scale-100 text-white text-xs font-bold shadow-xs transition cursor-pointer touch-manipulation"
                  title="Choose Quality and Bitrate Options"
                >
                  {loadingUrl === item.url ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Loading Qualities...</span>
                    </>
                  ) : (
                    <>
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Choose Quality (4K/1080p)</span>
                    </>
                  )}
                </button>

                {/* 2. Quick MP3 Button */}
                <button
                  id={`quick-mp3-btn-${item.id}`}
                  type="button"
                  onClick={() => onQuickDownload(item.url, item.title, 'audio-mp3-320', 'mp3', 'MP3 320kbps')}
                  className="min-h-[44px] inline-flex items-center space-x-1 px-3 py-2.5 rounded-xl bg-violet-50 hover:bg-violet-100 dark:bg-violet-950/50 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 text-xs font-bold transition cursor-pointer active:scale-95 touch-manipulation"
                  title="Quick 320kbps MP3 Audio Download"
                >
                  <Music className="w-3.5 h-3.5" />
                  <span>MP3</span>
                </button>

                {/* 3. Quick HD Video Button */}
                <button
                  id={`quick-hd-btn-${item.id}`}
                  type="button"
                  onClick={() => onQuickDownload(item.url, item.title, 'fast-direct', 'mp4', 'HD Video (Fast)')}
                  className="min-h-[44px] inline-flex items-center space-x-1 px-3 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition cursor-pointer active:scale-95 touch-manipulation"
                  title="Quick HD MP4 Video Download"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>HD MP4</span>
                </button>

                {/* 4. Preview */}
                <button
                  id={`preview-btn-${item.id}`}
                  type="button"
                  onClick={() => onPreview(item.url, item.title)}
                  className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer flex items-center justify-center active:scale-95 touch-manipulation"
                  title="Watch Preview"
                >
                  <Play className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
