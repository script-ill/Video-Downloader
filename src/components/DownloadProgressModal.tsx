import React, { useEffect, useState } from 'react';
import { DownloadJob } from '../types';
import { 
  CheckCircle2, 
  X, 
  Download, 
  Loader2, 
  AlertCircle, 
  Sparkles, 
  HardDrive, 
  Gauge, 
  Clock,
  Zap,
  ArrowRight,
  KeyRound,
  RotateCcw
} from 'lucide-react';
import { pollJobStatus, buildDirectDownloadUrl, saveCookies } from '../services/api';

interface DownloadProgressModalProps {
  job: DownloadJob;
  onClose: () => void;
  onComplete: (completedJob: DownloadJob) => void;
  onRetry?: (job: DownloadJob) => void;
}

export const DownloadProgressModal: React.FC<DownloadProgressModalProps> = ({
  job: initialJob,
  onClose,
  onComplete,
  onRetry,
}) => {
  const [currentJob, setCurrentJob] = useState<DownloadJob>(initialJob);
  const [autoDownloaded, setAutoDownloaded] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showCookiesForm, setShowCookiesForm] = useState(false);
  const [cookiesText, setCookiesText] = useState('');
  const [savingCookies, setSavingCookies] = useState(false);
  const [cookieError, setCookieError] = useState<string | null>(null);

  const targetJobId = initialJob.jobId || (initialJob as any).id;

  useEffect(() => {
    setCurrentJob(initialJob);
    setAutoDownloaded(false);
    setElapsedSeconds(0);
  }, [initialJob.jobId, initialJob.id]);

  // Timer for elapsed seconds
  useEffect(() => {
    if (currentJob.status === 'ready' || currentJob.status === 'failed') return;
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [currentJob.status]);

  useEffect(() => {
    if (!targetJobId) return;

    let timer: any;
    let isMounted = true;

    const poll = async () => {
      try {
        const updated = await pollJobStatus(targetJobId);
        if (!isMounted) return;
        setCurrentJob(updated);

        if (updated.status === 'ready') {
          if (!autoDownloaded && updated.downloadUrl) {
            setAutoDownloaded(true);
            triggerBrowserDownload(updated.downloadUrl, `${updated.title}.${updated.ext}`);
            onComplete(updated);
          }
          return;
        }

        if (updated.status === 'failed') {
          return;
        }

        timer = setTimeout(poll, 700);
      } catch (err: any) {
        if (!isMounted) return;
        timer = setTimeout(poll, 1200);
      }
    };

    poll();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [targetJobId, autoDownloaded, onComplete]);

  const triggerBrowserDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleInstantDirectStream = () => {
    const directUrl = buildDirectDownloadUrl(
      currentJob.url,
      currentJob.formatId || 'fast-direct',
      currentJob.ext || 'mp4',
      currentJob.title
    );
    triggerBrowserDownload(directUrl, `${currentJob.title}.${currentJob.ext || 'mp4'}`);
  };

  const isReady = currentJob.status === 'ready';
  const isFailed = currentJob.status === 'failed';
  const isProcessing = currentJob.status === 'processing';

  return (
    <div
      id="download-progress-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto"
    >
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md max-h-[90dvh] overflow-y-auto overflow-x-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 shadow-2xl relative">
        {/* Close Button */}
        <button
          id="close-progress-modal-btn"
          type="button"
          onClick={onClose}
          aria-label="Close download popup"
          className="absolute top-3.5 right-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start space-x-3 mb-4 pr-9">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              isReady
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                : isFailed
                ? 'bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400'
                : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
            }`}
          >
            {isReady ? (
              <CheckCircle2 className="w-6 h-6 stroke-[2.2]" />
            ) : isFailed ? (
              <AlertCircle className="w-6 h-6 stroke-[2.2]" />
            ) : (
              <Loader2 className="w-6 h-6 animate-spin stroke-[2.2]" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white leading-snug break-words">
              {isReady
                ? 'Download Complete!'
                : isFailed
                ? 'Download Encountered Error'
                : isProcessing
                ? 'Finalizing File (FFmpeg Mux)...'
                : 'Downloading Media Stream'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 break-words mt-0.5">
              {currentJob.formatLabel} • {currentJob.title}
            </p>
          </div>
        </div>

        {/* Progress Bar Container */}
        <div className="mb-4">
          <div className="flex flex-wrap justify-between items-center gap-x-2 gap-y-1 text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
            <span>
              {isReady
                ? '100% Ready'
                : isProcessing
                ? 'Finalizing video & audio...'
                : `${Math.round(currentJob.progress)}% Processed`}
            </span>
            <span className="text-[11px] text-zinc-400">
              Elapsed: {elapsedSeconds}s • {currentJob.totalSize || 'Calculating size'}
            </span>
          </div>

          <div className="w-full h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-zinc-200/50 dark:border-zinc-700/50">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isReady
                  ? 'bg-emerald-500'
                  : isFailed
                  ? 'bg-red-500'
                  : 'bg-gradient-to-r from-indigo-600 to-violet-500'
              }`}
              style={{ width: `${isReady ? 100 : Math.max(currentJob.progress, 5)}%` }}
            ></div>
          </div>
        </div>

        {/* Live Metrics Row (Speed, ETA, Format) */}
        {!isFailed && (
          <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800 text-xs mb-4">
            <div className="flex flex-col min-w-0">
              <span className="text-zinc-400 flex items-center text-[10px]">
                <Gauge className="w-3 h-3 mr-1 shrink-0" />
                Speed
              </span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate mt-0.5">
                {currentJob.speed || 'Active'}
              </span>
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-zinc-400 flex items-center text-[10px]">
                <Clock className="w-3 h-3 mr-1 shrink-0" />
                ETA
              </span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate mt-0.5">
                {currentJob.eta || 'Fast'}
              </span>
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-zinc-400 flex items-center text-[10px]">
                <HardDrive className="w-3 h-3 mr-1 shrink-0" />
                Format
              </span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase truncate mt-0.5">
                {currentJob.ext}
              </span>
            </div>
          </div>
        )}

        {/* Instant Fast Stream Fallback option if user doesn't want to wait */}
        {!isReady && (
          <div className="p-3 mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1 text-amber-800 dark:text-amber-300 font-semibold text-xs">
                <Zap className="w-3.5 h-3.5 fill-current shrink-0" />
                <span>Need it faster?</span>
              </div>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 break-words">
                Stream direct to device without server wait
              </p>
            </div>
            <button
              id="instant-direct-stream-btn"
              type="button"
              onClick={handleInstantDirectStream}
              className="shrink-0 w-full sm:w-auto inline-flex items-center justify-center space-x-1 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              <span>Instant Stream</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Error notice if failed */}
        {isFailed && (
          <div className="p-3.5 sm:p-4 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl text-xs mb-4 border border-red-200 dark:border-red-900/60 space-y-3">
            <div className="min-w-0">
              <p className="font-bold text-sm mb-1">Download Notice</p>
              <p className="opacity-90 break-words leading-relaxed">
                {currentJob.error || 'The platform stream could not be completed via server worker.'}
              </p>
            </div>

            {/bot|cookie|sign in|logged-in|login_required/i.test(currentJob.error || '') && (
              <div className="pt-2 border-t border-red-200/60 dark:border-red-900/50 space-y-2">
                <button
                  type="button"
                  onClick={() => setShowCookiesForm((v) => !v)}
                  className="inline-flex items-center space-x-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 shrink-0" />
                  <span>{showCookiesForm ? 'Hide Cookie Input' : 'Paste Session Cookies (cookies.txt) to Unlock'}</span>
                </button>

                {showCookiesForm && (
                  <div className="space-y-2">
                    <textarea
                      value={cookiesText}
                      onChange={(e) => setCookiesText(e.target.value)}
                      rows={3}
                      placeholder="# Netscape HTTP Cookie File..."
                      className="w-full p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-[11px] font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-indigo-500"
                    />
                    {cookieError && <p className="text-[11px] text-red-600 font-semibold">{cookieError}</p>}
                    <button
                      type="button"
                      disabled={savingCookies || !cookiesText.trim()}
                      onClick={async () => {
                        setSavingCookies(true);
                        setCookieError(null);
                        try {
                          await saveCookies(cookiesText);
                          setShowCookiesForm(false);
                          if (onRetry) onRetry(currentJob);
                        } catch (err: any) {
                          setCookieError(err.message || 'Failed to save cookies.');
                        } finally {
                          setSavingCookies(false);
                        }
                      }}
                      className="w-full min-h-[40px] inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{savingCookies ? 'Saving...' : 'Save Cookies & Retry Download'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 border-t border-red-200/60 dark:border-red-900/50 flex flex-col sm:flex-row gap-2">
              {onRetry && (
                <button
                  type="button"
                  onClick={() => onRetry(currentJob)}
                  className="min-h-[44px] inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs cursor-pointer active:scale-95 touch-manipulation"
                >
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  <span>Retry</span>
                </button>
              )}

              <button
                id="retry-direct-stream-modal-btn"
                type="button"
                onClick={handleInstantDirectStream}
                className="flex-1 min-h-[44px] inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-xs cursor-pointer active:scale-95 touch-manipulation"
              >
                <Zap className="w-4 h-4 fill-current shrink-0" />
                <span>Try Instant Direct Stream</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-xs cursor-pointer active:scale-95 touch-manipulation"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <button
            id="dismiss-progress-modal-btn"
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            {isReady ? 'Close Window' : 'Background'}
          </button>

          {isReady && currentJob.downloadUrl && (
            <button
              id="manual-save-file-btn"
              type="button"
              onClick={() => triggerBrowserDownload(currentJob.downloadUrl!, `${currentJob.title}.${currentJob.ext}`)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save File Again</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
