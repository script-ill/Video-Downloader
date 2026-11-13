import React from 'react';
import { SUPPORTED_PLATFORMS } from '../data/platforms';
import { SocialPlatform } from '../types';
import { 
  Youtube, 
  Instagram, 
  Twitter, 
  Facebook, 
  MessageSquare, 
  Video, 
  Music2,
  Share2
} from 'lucide-react';

interface PlatformPillsProps {
  currentPlatform: SocialPlatform;
  onSelectSample: (url: string) => void;
}

export const PlatformPills: React.FC<PlatformPillsProps> = ({
  currentPlatform,
  onSelectSample,
}) => {
  const getIcon = (id: SocialPlatform) => {
    switch (id) {
      case 'youtube':
        return <Youtube className="w-3.5 h-3.5 text-red-500" />;
      case 'instagram':
        return <Instagram className="w-3.5 h-3.5 text-pink-500" />;
      case 'tiktok':
        return <Music2 className="w-3.5 h-3.5 text-cyan-500" />;
      case 'twitter':
        return <Twitter className="w-3.5 h-3.5 text-zinc-800 dark:text-zinc-200" />;
      case 'facebook':
        return <Facebook className="w-3.5 h-3.5 text-blue-500" />;
      case 'reddit':
        return <MessageSquare className="w-3.5 h-3.5 text-orange-500" />;
      case 'vimeo':
        return <Video className="w-3.5 h-3.5 text-sky-500" />;
      default:
        return <Share2 className="w-3.5 h-3.5 text-zinc-500" />;
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          Supported Social Media Platforms
        </span>
        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
          Auto-detected
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {SUPPORTED_PLATFORMS.map((platform) => {
          const isActive = currentPlatform === platform.id;
          return (
            <button
              key={platform.id}
              id={`platform-pill-${platform.id}`}
              onClick={() => onSelectSample(platform.sampleUrl)}
              className={`group flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition cursor-pointer border ${
                isActive
                  ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white shadow-sm ring-2 ring-indigo-500/30'
                  : 'bg-white dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
              title={`Click to test with sample ${platform.name} link`}
            >
              <span className="shrink-0">{getIcon(platform.id)}</span>
              <span>{platform.name}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
