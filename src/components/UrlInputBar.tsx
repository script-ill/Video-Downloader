import React, { useState, useEffect } from 'react';
import {
  Clipboard,
  X,
  ArrowRight,
  Loader2,
  Sparkles,
  CheckCircle2,
  Link2,
} from 'lucide-react';
import { SocialPlatform } from '../types';
import { detectPlatformFromUrl } from '../utils/formatters';

interface UrlInputBarProps {
  url: string;
  onChangeUrl: (val: string) => void;
  onSubmitUrl: (url: string) => void;
  isLoading: boolean;
  onClear: () => void;
}

export const UrlInputBar: React.FC<UrlInputBarProps> = ({
  url,
  onChangeUrl,
  onSubmitUrl,
  isLoading,
  onClear,
}) => {
  const [detectedPlatform, setDetectedPlatform] = useState<SocialPlatform>('generic');
  const [pasteSuccess, setPasteSuccess] = useState(false);

  const hasText = url.trim().length > 0;

  useEffect(() => {
    if (hasText) {
      setDetectedPlatform(detectPlatformFromUrl(url));
    } else {
      setDetectedPlatform('generic');
    }
  }, [url, hasText]);

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

    let target = url.trim();
    if (!/^https?:\/\//i.test(target)) {
      target = `https://${target}`;
    }
    onSubmitUrl(target);
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
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex flex-col sm:flex-row items-stretch gap-2 p-2 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-zinc-200/50 dark:shadow-black/40 focus-within:border-indigo-500 dark:focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 transition">
          {/* Main Input Field */}
          <div className="relative flex-1 flex items-center min-h-[52px] pl-3 pr-2">
            <Link2 className="w-5 h-5 text-zinc-400 shrink-0 mr-3" />

            <input
              id="video-url-input"
              type="text"
              value={url}
              onChange={(e) => onChangeUrl(e.target.value)}
              placeholder="Paste video link (YouTube, TikTok, Instagram, X, Vimeo)..."
              disabled={isLoading}
              className="w-full bg-transparent text-sm sm:text-base text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none pr-16 disabled:opacity-60"
            />

            {/* Platform Detection Pill */}
            {platformBadge && hasText && (
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
                <span>Extracting Formats...</span>
              </>
            ) : (
              <>
                <span>Fetch Video</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Quick Sample Link Preset */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-semibold text-zinc-400 dark:text-zinc-500 flex items-center mr-1">
          <Sparkles className="w-3 h-3 text-amber-500 mr-1" />
          Quick Try:
        </span>
        <button
          id="sample-rickroll-btn"
          type="button"
          onClick={() => {
            const sample = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
            onChangeUrl(sample);
            onSubmitUrl(sample);
          }}
          className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800/80 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-zinc-700 transition cursor-pointer text-zinc-700 dark:text-zinc-300 font-medium"
        >
          YouTube 4K Sample
        </button>
      </div>
    </div>
  );
};
