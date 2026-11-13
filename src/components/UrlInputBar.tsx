import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Clipboard, 
  X, 
  ArrowRight, 
  Loader2, 
  Sparkles, 
  CheckCircle2, 
  Link2, 
  FileSearch,
  Music,
  Video
} from 'lucide-react';
import { SocialPlatform } from '../types';
import { detectPlatformFromUrl } from '../utils/formatters';

interface UrlInputBarProps {
  url: string;
  onChangeUrl: (val: string) => void;
  onSubmitUrl: (url: string) => void;
  onSearch: (query: string) => void;
  isLoading: boolean;
  onClear: () => void;
  activeMode: 'url' | 'search';
  onChangeMode: (mode: 'url' | 'search') => void;
}

export function isDirectUrl(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^www\./i.test(trimmed)) return true;
  if (
    /(youtube\.com|youtu\.be|tiktok\.com|instagram\.com|fb\.watch|facebook\.com|twitter\.com|x\.com|reddit\.com|vimeo\.com|threads\.net|twitch\.tv|pinterest\.com)/i.test(
      trimmed
    )
  ) {
    return true;
  }
  if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\/\S+/.test(trimmed)) return true;
  return false;
}

export const UrlInputBar: React.FC<UrlInputBarProps> = ({
  url,
  onChangeUrl,
  onSubmitUrl,
  onSearch,
  isLoading,
  onClear,
  activeMode,
  onChangeMode,
}) => {
  const [detectedPlatform, setDetectedPlatform] = useState<SocialPlatform>('generic');
  const [pasteSuccess, setPasteSuccess] = useState(false);

  // Determine whether current input looks like a URL or a search query
  const inputIsUrl = isDirectUrl(url);

  useEffect(() => {
    if (inputIsUrl) {
      setDetectedPlatform(detectPlatformFromUrl(url));
    } else {
      setDetectedPlatform('generic');
    }
  }, [url, inputIsUrl]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onChangeUrl(text.trim());
        setPasteSuccess(true);
        setTimeout(() => setPasteSuccess(false), 2000);
      }
    } catch (err) {
      console.warn('Clipboard access denied or not available:', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isLoading) return;

    if (activeMode === 'search' || !inputIsUrl) {
      onSearch(url.trim());
    } else {
      let target = url.trim();
      if (!/^https?:\/\//i.test(target)) {
        target = `https://${target}`;
      }
      onSubmitUrl(target);
    }
  };

  const getPlatformLabel = (platform: SocialPlatform) => {
    switch (platform) {
      case 'youtube':
        return { label: 'YouTube', color: 'bg-red-500 text-white' };
      case 'tiktok':
        return { label: 'TikTok', color: 'bg-zinc-900 text-white dark:bg-cyan-500 dark:text-zinc-950' };
      case 'instagram':
        return { label: 'Instagram', color: 'bg-pink-600 text-white' };
      case 'twitter':
        return { label: 'X (Twitter)', color: 'bg-zinc-900 text-white' };
      case 'facebook':
        return { label: 'Facebook', color: 'bg-blue-600 text-white' };
      case 'reddit':
        return { label: 'Reddit', color: 'bg-orange-500 text-white' };
      case 'vimeo':
        return { label: 'Vimeo', color: 'bg-sky-500 text-white' };
      default:
        return null;
    }
  };

  const platformBadge = getPlatformLabel(detectedPlatform);

  return (
    <div className="w-full">
      {/* Mode Switcher Pills */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="inline-flex p-1 bg-zinc-200/80 dark:bg-zinc-800/80 rounded-xl border border-zinc-300/60 dark:border-zinc-700/60 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onChangeMode('url')}
            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg transition cursor-pointer ${
              activeMode === 'url'
                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Paste Link</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeMode('search')}
            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg transition cursor-pointer ${
              activeMode === 'search'
                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search by Name</span>
          </button>
        </div>

        {/* Auto Detection indicator */}
        {url.trim().length > 2 && (
          <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center">
            {inputIsUrl ? (
              <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Direct Link
              </span>
            ) : (
              <span className="inline-flex items-center text-indigo-600 dark:text-indigo-400">
                <FileSearch className="w-3 h-3 mr-1" />
                Keyword Search
              </span>
            )}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex flex-col sm:flex-row items-stretch gap-2 p-2 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-zinc-200/50 dark:shadow-black/40 focus-within:border-indigo-500 dark:focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 transition">
          {/* Main Input Field */}
          <div className="relative flex-1 flex items-center min-h-[52px] pl-3 pr-2">
            {activeMode === 'search' || (!inputIsUrl && url.trim().length > 0) ? (
              <Search className="w-5 h-5 text-indigo-500 shrink-0 mr-3" />
            ) : (
              <Link2 className="w-5 h-5 text-zinc-400 shrink-0 mr-3" />
            )}

            <input
              id="video-url-input"
              type="text"
              value={url}
              onChange={(e) => onChangeUrl(e.target.value)}
              placeholder={
                activeMode === 'search'
                  ? 'Search video, song, creator, or file name...'
                  : 'Paste video link or type search keyword...'
              }
              disabled={isLoading}
              className="w-full bg-transparent text-sm sm:text-base text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none pr-16 disabled:opacity-60"
            />

            {/* Platform Detection Pill */}
            {platformBadge && inputIsUrl && (
              <span
                id="detected-platform-badge"
                className={`absolute right-12 text-[11px] font-bold px-2 py-0.5 rounded-md ${platformBadge.color} shadow-xs hidden sm:inline-block animate-fade-in`}
              >
                {platformBadge.label}
              </span>
            )}

            {/* Clear Input Button */}
            {url && (
              <button
                type="button"
                id="clear-url-input-btn"
                onClick={onClear}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 mr-1 transition cursor-pointer"
                title="Clear input"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Paste Button */}
            <button
              type="button"
              id="paste-clipboard-btn"
              onClick={handlePaste}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition cursor-pointer shrink-0"
              title="Paste from clipboard"
            >
              {pasteSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 font-semibold">Pasted!</span>
                </>
              ) : (
                <>
                  <Clipboard className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Paste</span>
                </>
              )}
            </button>
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            id="fetch-video-btn"
            disabled={!url.trim() || isLoading}
            className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98] shadow-md shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {activeMode === 'search' || !inputIsUrl ? 'Searching...' : 'Extracting Formats...'}
                </span>
              </>
            ) : (
              <>
                <span>
                  {activeMode === 'search' || !inputIsUrl ? 'Search Videos' : 'Fetch Video'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Quick Sample Preset Pills */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-semibold text-zinc-400 dark:text-zinc-500 flex items-center mr-1">
          <Sparkles className="w-3 h-3 text-amber-500 mr-1" />
          Quick Try:
        </span>
        <button
          id="sample-search-adele-btn"
          type="button"
          onClick={() => {
            onChangeMode('search');
            onChangeUrl('Adele Rolling in the Deep');
            onSearch('Adele Rolling in the Deep');
          }}
          className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800/80 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-zinc-700 transition cursor-pointer text-zinc-700 dark:text-zinc-300 font-medium flex items-center"
        >
          <Search className="w-2.5 h-2.5 mr-1 text-indigo-500" />
          <span>Search: Adele (Rolling in the Deep)</span>
        </button>
        <button
          id="sample-search-lofi-btn"
          type="button"
          onClick={() => {
            onChangeMode('search');
            onChangeUrl('Lofi hip hop radio beats');
            onSearch('Lofi hip hop radio beats');
          }}
          className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800/80 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-zinc-700 transition cursor-pointer text-zinc-700 dark:text-zinc-300 font-medium flex items-center"
        >
          <Music className="w-2.5 h-2.5 mr-1 text-violet-500" />
          <span>Search: Lofi Beats</span>
        </button>
        <button
          id="sample-rickroll-btn"
          type="button"
          onClick={() => {
            onChangeMode('url');
            onChangeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
            onSubmitUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
          }}
          className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800/80 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-zinc-700 transition cursor-pointer text-zinc-700 dark:text-zinc-300 font-medium"
        >
          🎬 Direct 4K Link (YouTube)
        </button>
      </div>
    </div>
  );
};
