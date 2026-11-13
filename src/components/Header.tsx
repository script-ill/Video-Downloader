import React from 'react';
import { Download, Sparkles, Layers, History, Info, Send, Github } from 'lucide-react';

interface HeaderProps {
  onOpenBatch: () => void;
  onScrollToHistory: () => void;
  onScrollToAbout: () => void;
  historyCount: number;
  serverStatus: { ytdlp: boolean; ffmpeg: boolean };
}

export const Header: React.FC<HeaderProps> = ({
  onOpenBatch,
  onScrollToHistory,
  onScrollToAbout,
  historyCount,
  serverStatus,
}) => {
  return (
    <header className="w-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800 sticky top-0 z-30 transition-colors">
      <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-xs shadow-indigo-500/30">
            <Download className="w-4.5 h-4.5 stroke-[2.4]" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-zinc-900 dark:text-white text-base sm:text-lg tracking-tight">
                StreamGrab
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.2 rounded-md border border-indigo-200/60 dark:border-indigo-800/40">
                APK
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 hidden xs:block">
              Fast 4K & MP3 Downloader
            </p>
          </div>
        </div>

        {/* Action Buttons (Icon Only) */}
        <div className="flex items-center space-x-1.5">
          {/* History Button */}
          <button
            id="header-history-btn"
            type="button"
            onClick={onScrollToHistory}
            title="Download History"
            aria-label="Download History"
            className="relative w-10 h-10 rounded-xl flex items-center justify-center text-zinc-700 dark:text-zinc-200 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition cursor-pointer active:scale-95"
          >
            <History className="w-4.5 h-4.5 text-zinc-600 dark:text-zinc-300" />
            {historyCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                {historyCount}
              </span>
            )}
          </button>

          {/* Batch Mode Button */}
          <button
            id="header-batch-btn"
            type="button"
            onClick={onOpenBatch}
            title="Batch Downloader"
            aria-label="Batch Downloader"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-700 dark:text-zinc-200 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition cursor-pointer active:scale-95"
          >
            <Layers className="w-4.5 h-4.5 text-zinc-600 dark:text-zinc-300" />
          </button>

          {/* About & Contact */}
          <button
            id="header-about-btn"
            type="button"
            onClick={onScrollToAbout}
            title="About & Contact"
            aria-label="About & Contact"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 transition cursor-pointer active:scale-95"
          >
            <Info className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
