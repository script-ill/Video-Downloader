import React from 'react';
import { Download, ShieldCheck, Heart, Send, Github, ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full mt-12 py-8 border-t border-zinc-200/80 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50">
      <div className="max-w-xl mx-auto px-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
        <div className="flex items-center justify-center space-x-2 mb-3">
          <Download className="w-4 h-4 text-indigo-600" />
          <span className="font-bold text-zinc-700 dark:text-zinc-300">
            StreamGrab 4K UHD Downloader
          </span>
        </div>

        {/* Social Media direct contact bar */}
        <div className="flex items-center justify-center space-x-4 mb-4 text-xs font-semibold">
          <a
            id="footer-telegram-link"
            href="https://t.me/script_ill"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 fill-current" />
            <span>Telegram (@script_ill)</span>
          </a>

          <span className="text-zinc-300 dark:text-zinc-700">•</span>

          <a
            id="footer-github-link"
            href="https://github.com/script-ill"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 text-zinc-800 dark:text-zinc-200 hover:underline cursor-pointer"
          >
            <Github className="w-3.5 h-3.5" />
            <span>GitHub (script-ill)</span>
          </a>
        </div>

        <p className="max-w-md mx-auto text-[11px] text-zinc-400 leading-normal">
          For educational and personal archiving purposes. Please respect content creators and copyright terms of service across all social platforms.
        </p>
      </div>
    </footer>
  );
};
