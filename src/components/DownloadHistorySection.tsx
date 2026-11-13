import React, { useState } from 'react';
import { DownloadHistoryItem } from '../types';
import { History, Download, Trash2, ExternalLink, Film, Clock } from 'lucide-react';
import { buildDirectDownloadUrl } from '../services/api';

interface DownloadHistorySectionProps {
  history: DownloadHistoryItem[];
  onClearHistory: () => void;
  onSelectUrl: (url: string) => void;
}

export const DownloadHistorySection: React.FC<DownloadHistorySectionProps> = ({
  history,
  onClearHistory,
  onSelectUrl,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);
  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      id="download-history-section"
      className="w-full max-w-xl mx-auto bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 shadow-sm transition"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <History className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Download History
              </h3>
              <span className="text-[11px] px-2 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold">
                {history.length}
              </span>
            </div>
          </div>
        </div>

        {history.length > 0 && (
          confirmClear ? (
            <div className="flex items-center space-x-1.5">
              <button
                id="confirm-clear-history-btn"
                onClick={() => {
                  onClearHistory();
                  setConfirmClear(false);
                }}
                className="text-xs font-bold text-white bg-red-600 hover:bg-red-500 px-2.5 py-1 rounded-lg transition cursor-pointer"
              >
                Confirm Clear
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-2 py-1 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              id="clear-all-history-btn"
              onClick={() => setConfirmClear(true)}
              className="inline-flex items-center space-x-1 text-xs text-zinc-400 hover:text-red-600 transition cursor-pointer px-2 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )
        )}
      </div>

      {/* Empty State */}
      {history.length === 0 ? (
        <div className="text-center py-8 px-4">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 text-zinc-400 mx-auto flex items-center justify-center mb-2.5">
            <Clock className="w-6 h-6 stroke-[1.8]" />
          </div>
          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1">
            No Recent Downloads
          </p>
          <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">
            Videos and MP3s downloaded will be safely recorded here for fast re-access.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {history.map((item) => (
            <div
              key={item.id}
              className="py-3 flex items-center justify-between gap-2.5 text-xs group"
            >
              <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-14 h-10 rounded-lg object-cover shrink-0 bg-zinc-900 shadow-inner"
                  />
                ) : (
                  <div className="w-14 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                    <Film className="w-4 h-4 text-zinc-400" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onSelectUrl(item.url)}
                    className="font-bold text-zinc-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 truncate text-left block w-full transition cursor-pointer"
                    title={item.title}
                  >
                    {item.title}
                  </button>
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-zinc-400 text-[11px] mt-0.5">
                    <span className="uppercase font-bold text-zinc-600 dark:text-zinc-400 shrink-0">
                      {item.platform}
                    </span>
                    <span>•</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium truncate max-w-[140px]">
                      {item.formatLabel}
                    </span>
                    <span>•</span>
                    <span className="shrink-0">{formatDate(item.timestamp)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-1 shrink-0">
                <a
                  href={buildDirectDownloadUrl(
                    item.url,
                    item.formatId,
                    item.formatId.startsWith('audio-m4a')
                      ? 'm4a'
                      : item.formatId.startsWith('audio-')
                      ? 'mp3'
                      : 'mp4',
                    item.title
                  )}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 font-bold text-indigo-600 dark:text-indigo-400 transition"
                  title="Download again"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Save</span>
                </a>

                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition"
                  title="Open original link"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
