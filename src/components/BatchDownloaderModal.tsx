import React, { useState } from 'react';
import { X, Layers, Plus, Trash2, ArrowRight, Loader2, CheckCircle2, Download, AlertCircle } from 'lucide-react';
import { extractVideoMetadata, startDownloadJob, buildDirectDownloadUrl } from '../services/api';
import { VideoMetadata } from '../types';

interface BatchDownloaderModalProps {
  onClose: () => void;
  onAddHistory: (item: any) => void;
}

interface BatchItem {
  id: string;
  url: string;
  status: 'idle' | 'analyzing' | 'ready' | 'downloading' | 'completed' | 'error';
  metadata?: VideoMetadata;
  selectedFormatId?: string;
  error?: string;
}

export const BatchDownloaderModal: React.FC<BatchDownloaderModalProps> = ({
  onClose,
  onAddHistory,
}) => {
  const [inputText, setInputText] = useState('');
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isProcessingAll, setIsProcessingAll] = useState(false);

  const handleParseLinks = () => {
    const lines = inputText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('http://') || l.startsWith('https://'));

    if (lines.length === 0) return;

    const newItems: BatchItem[] = lines.map((url) => ({
      id: `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      url,
      status: 'idle',
    }));

    setItems((prev) => [...prev, ...newItems]);
    setInputText('');
  };

  const handleAnalyzeItem = async (item: BatchItem) => {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: 'analyzing', error: undefined } : i))
    );

    try {
      const meta = await extractVideoMetadata(item.url);
      const defaultFormat = meta.formats.find((f) => f.quality.includes('1080')) || meta.formats[0];

      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                status: 'ready',
                metadata: meta,
                selectedFormatId: defaultFormat?.id,
              }
            : i
        )
      );
    } catch (err: any) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: 'error', error: err.message || 'Analysis failed' }
            : i
        )
      );
    }
  };

  const handleAnalyzeAll = async () => {
    setIsProcessingAll(true);
    for (const item of items) {
      if (item.status === 'idle') {
        await handleAnalyzeItem(item);
      }
    }
    setIsProcessingAll(false);
  };

  const handleDownloadItem = async (item: BatchItem) => {
    if (!item.metadata || !item.selectedFormatId) return;

    const format = item.metadata.formats.find((f) => f.id === item.selectedFormatId) || item.metadata.formats[0];

    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: 'downloading' } : i))
    );

    try {
      const job = await startDownloadJob(
        item.url,
        format.id,
        format.label,
        format.ext,
        item.metadata.title
      );

      // Direct trigger
      const directUrl = buildDirectDownloadUrl(item.url, format.id, format.ext, item.metadata.title);
      const a = document.createElement('a');
      a.href = directUrl;
      a.download = `${item.metadata.title}.${format.ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'completed' } : i))
      );

      onAddHistory({
        id: String(Date.now()),
        title: item.metadata.title,
        thumbnail: item.metadata.thumbnail,
        platform: item.metadata.platform,
        formatLabel: format.label,
        filesizeFormatted: format.filesizeFormatted,
        timestamp: Date.now(),
        url: item.url,
        formatId: format.id,
      });
    } catch (err: any) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: 'error', error: err.message || 'Download failed' }
            : i
        )
      );
    }
  };

  const handleRemove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div
      id="batch-downloader-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fade-in overflow-y-auto"
    >
      <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 gap-2">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate">
                Batch URL Queue
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                Paste multiple links to analyze and download in bulk
              </p>
            </div>
          </div>

          <button
            id="close-batch-modal-btn"
            type="button"
            onClick={onClose}
            aria-label="Close batch popup"
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Box */}
        <div className="my-4">
          <textarea
            id="batch-links-textarea"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste video links here (one URL per line)&#10;https://www.youtube.com/watch?v=...&#10;https://www.tiktok.com/...&#10;https://www.instagram.com/reel/..."
            rows={3}
            className="w-full p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />

          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-zinc-400">
              {items.length} link{items.length === 1 ? '' : 's'} in queue
            </span>

            <div className="flex items-center space-x-2">
              <button
                id="add-batch-links-btn"
                onClick={handleParseLinks}
                disabled={!inputText.trim()}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add to Queue</span>
              </button>

              {items.length > 0 && (
                <button
                  id="analyze-all-batch-btn"
                  onClick={handleAnalyzeAll}
                  disabled={isProcessingAll}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 disabled:opacity-50 transition cursor-pointer"
                >
                  {isProcessingAll ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5" />
                  )}
                  <span>Analyze All</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Queued Items List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {items.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-400">
              No links in batch queue. Paste links above and click &quot;Add to Queue&quot;.
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="pt-2 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                    {item.metadata ? item.metadata.title : item.url}
                  </div>
                  {item.error ? (
                    <span className="text-red-500 text-[11px] flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {item.error}
                    </span>
                  ) : item.metadata ? (
                    <div className="flex items-center space-x-2 text-zinc-500 dark:text-zinc-400 mt-0.5">
                      <span className="uppercase font-semibold text-indigo-600 dark:text-indigo-400">
                        {item.metadata.platform}
                      </span>
                      <span>•</span>
                      <span>{item.metadata.durationFormatted}</span>
                      <span>•</span>
                      <select
                        value={item.selectedFormatId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setItems((prev) =>
                            prev.map((i) =>
                              i.id === item.id ? { ...i, selectedFormatId: val } : i
                            )
                          );
                        }}
                        className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded px-1.5 py-0.5 text-[11px] border border-zinc-200 dark:border-zinc-700"
                      >
                        {item.metadata.formats.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label} ({f.filesizeFormatted})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <span className="text-zinc-400 text-[11px]">Ready to analyze</span>
                  )}
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {item.status === 'idle' && (
                    <button
                      onClick={() => handleAnalyzeItem(item)}
                      className="px-2.5 py-1 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 font-semibold hover:bg-indigo-100 cursor-pointer"
                    >
                      Analyze
                    </button>
                  )}

                  {item.status === 'analyzing' && (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  )}

                  {item.status === 'ready' && (
                    <button
                      onClick={() => handleDownloadItem(item)}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-500 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  )}

                  {item.status === 'completed' && (
                    <span className="text-emerald-500 flex items-center font-semibold text-[11px]">
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Saved
                    </span>
                  )}

                  <button
                    onClick={() => handleRemove(item.id)}
                    className="p-1 text-zinc-400 hover:text-red-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
