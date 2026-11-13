import React, { useState } from 'react';
import { 
  Info, 
  Send, 
  Github, 
  Check, 
  Copy, 
  ExternalLink, 
  Sparkles, 
  ShieldCheck, 
  Heart,
  MessageCircle,
  Zap,
  Code2,
  Smartphone
} from 'lucide-react';

export const AboutSection: React.FC = () => {
  const [copiedTelegram, setCopiedTelegram] = useState(false);
  const [copiedGithub, setCopiedGithub] = useState(false);

  const telegramHandle = 'script_ill';
  const telegramUrl = 'https://t.me/script_ill';
  const githubUrl = 'https://github.com/script-ill';
  const githubHandle = 'script-ill';

  const copyToClipboard = (text: string, type: 'tg' | 'gh') => {
    navigator.clipboard.writeText(text);
    if (type === 'tg') {
      setCopiedTelegram(true);
      setTimeout(() => setCopiedTelegram(false), 2000);
    } else {
      setCopiedGithub(true);
      setTimeout(() => setCopiedGithub(false), 2000);
    }
  };

  return (
    <section
      id="about-contact-section"
      className="w-full max-w-xl mx-auto my-8 px-4"
    >
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 shadow-sm overflow-hidden relative">
        {/* Subtle accent backdrop */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-br from-indigo-500/10 to-violet-500/5 rounded-full blur-2xl pointer-events-none" />

        {/* Section Header */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200/50 dark:border-indigo-800/40">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-white">
                About StreamGrab APK
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                v2.4 Active
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Universal High-Speed Media & Social Video Downloader
            </p>
          </div>
        </div>

        {/* Description text */}
        <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300 mb-5">
          StreamGrab is built for ultra-fast, watermark-free media extraction across Instagram, YouTube, TikTok, Facebook, Twitter/X, and Reddit. Featuring accelerated multithreaded downloads, 4K UHD format muxing, and pristine 320kbps MP3 master extractions.
        </p>

        {/* Feature Badges Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
          <div className="flex items-center space-x-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 text-xs">
            <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">Zero Wait Muxing</span>
          </div>
          <div className="flex items-center space-x-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">4K UHD & 1080p</span>
          </div>
          <div className="flex items-center space-x-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 text-xs col-span-2 sm:col-span-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">100% Free & Safe</span>
          </div>
        </div>

        {/* Direct Developer Contact Section */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center space-x-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-indigo-500" />
              <span>Direct Developer Contact</span>
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              Open for Requests & Help
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Telegram Card */}
            <div
              id="developer-telegram-card"
              className="group p-3.5 rounded-xl bg-gradient-to-br from-sky-50 to-blue-50/40 dark:from-sky-950/30 dark:to-zinc-800/40 border border-sky-200/80 dark:border-sky-900/50 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-lg bg-sky-500 text-white flex items-center justify-center shadow-xs shadow-sky-500/30">
                    <Send className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white">
                      Telegram
                    </h3>
                    <p className="text-[11px] text-sky-700 dark:text-sky-300 font-mono font-medium">
                      @{telegramHandle}
                    </p>
                  </div>
                </div>

                <button
                  id="copy-telegram-btn"
                  onClick={() => copyToClipboard(`https://t.me/${telegramHandle}`, 'tg')}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-white/60 dark:hover:bg-zinc-700/60 transition cursor-pointer"
                  title="Copy Telegram Link"
                >
                  {copiedTelegram ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <a
                id="direct-telegram-link"
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <span>Chat on Telegram</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* GitHub Card */}
            <div
              id="developer-github-card"
              className="group p-3.5 rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-800/60 dark:to-zinc-800/30 border border-zinc-200 dark:border-zinc-700/60 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center shadow-xs">
                    <Github className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white">
                      GitHub
                    </h3>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300 font-mono font-medium">
                      @{githubHandle}
                    </p>
                  </div>
                </div>

                <button
                  id="copy-github-btn"
                  onClick={() => copyToClipboard(githubUrl, 'gh')}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-white/60 dark:hover:bg-zinc-700/60 transition cursor-pointer"
                  title="Copy GitHub Link"
                >
                  {copiedGithub ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <a
                id="direct-github-link"
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <span>View GitHub Profile</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
