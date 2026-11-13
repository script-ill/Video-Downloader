import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { PlatformPills } from './components/PlatformPills';
import { UrlInputBar } from './components/UrlInputBar';
import { VideoDetailCard } from './components/VideoDetailCard';
import { FormatMatrix } from './components/FormatMatrix';
import { VideoPreviewModal } from './components/VideoPreviewModal';
import { DownloadProgressModal } from './components/DownloadProgressModal';
import { BatchDownloaderModal } from './components/BatchDownloaderModal';
import { DownloadHistorySection } from './components/DownloadHistorySection';
import { PlatformFeaturesSection } from './components/PlatformFeaturesSection';
import { AboutSection } from './components/AboutSection';
import { Footer } from './components/Footer';
import { 
  VideoMetadata, 
  VideoFormat, 
  DownloadJob, 
  DownloadHistoryItem, 
  SocialPlatform 
} from './types';
import { detectPlatformFromUrl } from './utils/formatters';
import { 
  extractVideoMetadata, 
  startDownloadJob, 
  checkServerHealth,
  saveCookies,
  getCookiesStatus
} from './services/api';
import { 
  AlertTriangle, 
  Sparkles, 
  Download, 
  History, 
  Layers, 
  Info, 
  KeyRound,
  CheckCircle2
} from 'lucide-react';

export default function App() {
  const [url, setUrl] = useState('');
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active tab state: 'downloader' | 'history' | 'about'
  const [currentTab, setCurrentTab] = useState<'downloader' | 'history' | 'about'>('downloader');

  const [activeJob, setActiveJob] = useState<DownloadJob | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);

  const [history, setHistory] = useState<DownloadHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('streamgrab_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [serverStatus, setServerStatus] = useState({ ytdlp: true, ffmpeg: true });
  const [showCookieBox, setShowCookieBox] = useState(false);
  const [cookieInput, setCookieInput] = useState('');
  const [hasCookies, setHasCookies] = useState(false);
  const [cookieSavedMsg, setCookieSavedMsg] = useState<string | null>(null);

  const resultRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);

  // Check server health & cookie status on load
  useEffect(() => {
    checkServerHealth().then((res) => {
      setServerStatus({ ytdlp: res.ytdlp, ffmpeg: res.ffmpeg });
    });
    getCookiesStatus().then(setHasCookies);
  }, []);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('streamgrab_history', JSON.stringify(history));
    } catch (e) {
      console.warn('Failed to persist history:', e);
    }
  }, [history]);

  const handleFetchVideo = async (targetUrl: string) => {
    if (!targetUrl.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await extractVideoMetadata(targetUrl.trim());
      setMetadata(data);
      setCurrentTab('downloader');
      // Smooth scroll to results
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: any) {
      setError(
        err.message ||
          'Failed to extract media information. Please ensure the link is public and valid.'
      );
      setMetadata(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryJob = async (
    videoUrl: string,
    videoTitle: string,
    formatId: string,
    ext: string,
    formatLabel: string
  ) => {
    try {
      const job = await startDownloadJob(videoUrl, formatId, formatLabel, ext, videoTitle);
      setActiveJob(job);
    } catch (err: any) {
      setError(`Could not start download: ${err.message}`);
    }
  };

  const handleStartDownload = async (format: VideoFormat) => {
    if (!metadata) return;

    try {
      const job = await startDownloadJob(
        metadata.url,
        format.id,
        format.label,
        format.ext,
        metadata.title
      );
      setActiveJob(job);
    } catch (err: any) {
      setError(`Could not initiate download: ${err.message}`);
    }
  };

  const handleSaveCookies = async () => {
    try {
      const saved = await saveCookies(cookieInput);
      setHasCookies(saved);
      setCookieSavedMsg(saved ? 'Session cookies saved. Retry your link now!' : 'Cookies cleared.');
      setShowCookieBox(false);
    } catch (err: any) {
      setCookieSavedMsg(err.message || 'Failed to save cookies.');
    }
  };

  const handleDownloadCompleted = (completedJob: DownloadJob) => {
    const newItem: DownloadHistoryItem = {
      id: String(Date.now()),
      title: completedJob.title || metadata?.title || 'Downloaded Media',
      thumbnail: metadata?.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80',
      platform: metadata?.platform || 'youtube',
      formatLabel: completedJob.formatLabel,
      filesizeFormatted: completedJob.totalSize || 'Complete',
      timestamp: Date.now(),
      url: completedJob.url || metadata?.url || '',
      formatId: completedJob.formatId,
    };

    setHistory((prev) => [newItem, ...prev.filter((i) => i.url !== newItem.url)].slice(0, 25));
  };

  const handleAddBatchHistory = (item: DownloadHistoryItem) => {
    setHistory((prev) => [item, ...prev].slice(0, 25));
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  const currentPlatform: SocialPlatform = detectPlatformFromUrl(url);

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-100/70 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] selection:bg-indigo-500 selection:text-white">
      {/* Navigation Header */}
      <Header
        onOpenBatch={() => setIsBatchOpen(true)}
        onScrollToHistory={() => {
          setCurrentTab('history');
          historyRef.current?.scrollIntoView({ behavior: 'smooth' });
        }}
        onScrollToAbout={() => {
          setCurrentTab('about');
          aboutRef.current?.scrollIntoView({ behavior: 'smooth' });
        }}
        historyCount={history.length}
        serverStatus={serverStatus}
      />

      {/* Main Centered APK Container */}
      <main className="flex-1 w-full max-w-xl mx-auto px-3 sm:px-4 py-4 sm:py-6 flex flex-col items-center">
        {/* Centered APK App Header Banner */}
        <div className="text-center w-full mb-4">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold mb-2.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>StreamGrab APK • Universal 4K Downloader</span>
          </div>

          <h1 className="text-xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight leading-snug">
            Universal Social Media{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-500 bg-clip-text text-transparent">
              Video &amp; MP3
            </span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
            Paste video links from YouTube, TikTok, Instagram, Twitter, Vimeo, and Reddit.
          </p>
        </div>

        {/* Centered Icon-Only Segmented Navigation Bar */}
        <div className="w-full bg-white dark:bg-zinc-900 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs mb-5 grid grid-cols-4 gap-1">
          {/* 1. Downloader Tab */}
          <button
            id="menu-tab-downloader"
            type="button"
            title="Download by URL"
            aria-label="Download by URL"
            onClick={() => setCurrentTab('downloader')}
            className={`relative flex items-center justify-center h-10 rounded-xl transition cursor-pointer ${
              currentTab === 'downloader'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
            }`}
          >
            <Download className="w-4.5 h-4.5" />
          </button>

          {/* 2. History Tab */}
          <button
            id="menu-tab-history"
            type="button"
            title="Download History"
            aria-label="Download History"
            onClick={() => setCurrentTab('history')}
            className={`relative flex items-center justify-center h-10 rounded-xl transition cursor-pointer ${
              currentTab === 'history'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
            }`}
          >
            <History className="w-4.5 h-4.5" />
            {history.length > 0 && (
              <span
                className={`absolute top-1 right-2 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center ${
                  currentTab === 'history'
                    ? 'bg-white text-indigo-600'
                    : 'bg-indigo-600 text-white'
                }`}
              >
                {history.length}
              </span>
            )}
          </button>

          {/* 4. Batch Queue */}
          <button
            id="menu-tab-batch"
            type="button"
            title="Batch Downloader"
            aria-label="Batch Downloader"
            onClick={() => setIsBatchOpen(true)}
            className="relative flex items-center justify-center h-10 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition cursor-pointer"
          >
            <Layers className="w-4.5 h-4.5" />
          </button>

          {/* 5. About */}
          <button
            id="menu-tab-about"
            type="button"
            title="About & Developer Contact"
            aria-label="About & Developer Contact"
            onClick={() => {
              setCurrentTab('about');
              aboutRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`relative flex items-center justify-center h-10 rounded-xl transition cursor-pointer ${
              currentTab === 'about'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
            }`}
          >
            <Info className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Direct Link Input Bar */}
        <div className="w-full mb-5">
          <UrlInputBar
            url={url}
            onChangeUrl={(val) => {
              setUrl(val);
              if (error) setError(null);
            }}
            onSubmitUrl={handleFetchVideo}
            isLoading={isLoading}
            onClear={() => {
              setUrl('');
              setMetadata(null);
              setError(null);
            }}
          />

          {/* URL Extraction Error Box */}
          {error && (
            <div
              id="error-alert-box"
              className="mt-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs space-y-2"
            >
              <div className="flex items-start space-x-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">Extraction Error</p>
                  <p className="mt-0.5 text-red-600 dark:text-red-400 text-xs leading-relaxed">
                    {error}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Tip: Ensure the video is public and copied directly from the browser URL bar.
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCookieBox((v) => !v)}
                      className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-800 text-[11px] font-bold text-red-700 dark:text-red-300 hover:bg-red-100/60 cursor-pointer"
                    >
                      <KeyRound className="w-3 h-3" />
                      <span>{hasCookies ? 'Update Session Cookies' : 'Add Session Cookies (Optional)'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {showCookieBox && (
                <div className="pt-2 border-t border-red-200/60 dark:border-red-900/50 space-y-2">
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                    For login-gated posts (Instagram Reels, private Facebook, or restricted clips), paste Netscape-format cookies.txt content:
                  </p>
                  <textarea
                    value={cookieInput}
                    onChange={(e) => setCookieInput(e.target.value)}
                    rows={3}
                    placeholder="# Netscape HTTP Cookie File..."
                    className="w-full p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-[11px] font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCookieBox(false)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-zinc-500 hover:bg-zinc-200/60 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCookies}
                      className="px-3 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                    >
                      Save Cookies
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {cookieSavedMsg && (
            <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between">
              <span className="flex items-center space-x-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{cookieSavedMsg}</span>
              </span>
              <button
                type="button"
                onClick={() => setCookieSavedMsg(null)}
                className="text-[11px] font-bold hover:underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: Centered Downloader View */}
        {currentTab === 'downloader' && (
          <div className="w-full space-y-5">
            {/* Platform Pills */}
            <div className="w-full">
              <PlatformPills
                currentPlatform={currentPlatform}
                onSelectSample={(sampleUrl) => {
                  setUrl(sampleUrl);
                  handleFetchVideo(sampleUrl);
                }}
              />
            </div>

            {/* Extracted Video Information & Format Selector */}
            {metadata && (
              <div ref={resultRef} className="w-full space-y-4 animate-fade-in">
                <VideoDetailCard
                  metadata={metadata}
                  onOpenPreview={() => setIsPreviewOpen(true)}
                />

                <FormatMatrix
                  metadata={metadata}
                  onStartDownload={handleStartDownload}
                  activeDownloadingFormatId={activeJob?.formatId}
                />
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Centered History Section */}
        <div
          ref={historyRef}
          className={`w-full mt-6 ${
            currentTab === 'history' || currentTab === 'downloader' ? 'block' : 'hidden'
          }`}
        >
          <DownloadHistorySection
            history={history}
            onClearHistory={handleClearHistory}
            onSelectUrl={(prevUrl) => {
              setUrl(prevUrl);
              setCurrentTab('downloader');
              handleFetchVideo(prevUrl);
            }}
          />
        </div>

        {/* Supported Features & Capabilities Overview */}
        <div className="w-full mt-6">
          <PlatformFeaturesSection />
        </div>

        {/* About Section - Placed Under All Menu in the Top of Footer */}
        <div ref={aboutRef} className="w-full mt-6">
          <AboutSection />
        </div>
      </main>

      {/* Centered Footer */}
      <Footer />

      {/* Video Preview Player Modal */}
      {isPreviewOpen && metadata && (
        <VideoPreviewModal
          metadata={metadata}
          onClose={() => setIsPreviewOpen(false)}
          onSelectFormat={() => {
            setIsPreviewOpen(false);
            resultRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      )}

      {/* Live Download Progress Modal */}
      {activeJob && (
        <DownloadProgressModal
          job={activeJob}
          onClose={() => setActiveJob(null)}
          onComplete={handleDownloadCompleted}
          onRetry={(failedJob) => {
            setHasCookies(true);
            handleRetryJob(
              failedJob.url,
              failedJob.title,
              failedJob.formatId,
              failedJob.ext,
              failedJob.formatLabel
            );
          }}
        />
      )}

      {/* Batch Downloader Modal */}
      {isBatchOpen && (
        <BatchDownloaderModal
          onClose={() => setIsBatchOpen(false)}
          onAddHistory={handleAddBatchHistory}
        />
      )}
    </div>
  );
}
