import React from 'react';
import { 
  Sparkles, 
  Headphones, 
  Zap, 
  ShieldCheck, 
  Layers, 
  Tv, 
  Smartphone,
  Flame
} from 'lucide-react';

export const PlatformFeaturesSection: React.FC = () => {
  const features = [
    {
      icon: <Tv className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
      title: 'True 4K UHD & 1080p 60fps',
      desc: 'Seamlessly merges high-bitrate video streams with pristine studio audio tracks using hardware-accelerated FFmpeg.',
    },
    {
      icon: <Headphones className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
      title: 'Studio MP3 320kbps Extraction',
      desc: 'Extract music, podcasts, and speeches into 320kbps extreme quality MP3 or lossless M4A audio containers.',
    },
    {
      icon: <Smartphone className="w-5 h-5 text-pink-600 dark:text-pink-400" />,
      title: 'Clean Social Media Formats',
      desc: 'Download Instagram Reels, TikTok videos without intrusive watermarks, Twitter/X clips, and Facebook Watch videos.',
    },
    {
      icon: <Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      title: 'Instant Live Progress Tracking',
      desc: 'Real-time download speed meters, remaining time estimates, and automatic browser download delivery.',
    },
  ];

  return (
    <div className="w-full mt-6">
      <div className="text-center mb-6">
        <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          High Quality Media Capabilities
        </h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {features.map((f, i) => (
          <div
            key={i}
            className="bg-white dark:bg-zinc-900/60 rounded-xl p-4 border border-zinc-200/80 dark:border-zinc-800 shadow-xs"
          >
            <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
              {f.icon}
            </div>
            <h5 className="font-bold text-xs text-zinc-900 dark:text-white mb-1">
              {f.title}
            </h5>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {f.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
