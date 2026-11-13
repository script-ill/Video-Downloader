import React from 'react';
import { VideoMetadata } from '../types';
import { X, ExternalLink, Download, Play, Music } from 'lucide-react';

interface VideoPreviewModalProps {
  metadata: VideoMetadata;
  onClose: () => void;
  onSelectFormat: () => void;
}

export const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({
  metadata,
  onClose,
  onSelectFormat,
}) => {
  return (
    <div
      id="video-preview-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto"
    >
      <div className="bg-zinc-900 text-white w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl border border-zinc-800 shadow-2xl relative">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-zinc-800 bg-zinc-950/60 gap-2">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-600 text-white uppercase shrink-0">
              {metadata.platform}
            </span>
            <h3 className="text-sm font-bold truncate text-zinc-200">
              {metadata.title}
            </h3>
          </div>

          <button
            id="close-preview-modal-btn"
            type="button"
            onClick={onClose}
            aria-label="Close preview popup"
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player or Interactive Preview Screen */}
        <div className="relative aspect-video bg-black flex items-center justify-center">
          {metadata.previewUrl ? (
            <video
              id="preview-video-player"
              src={metadata.previewUrl}
              controls
              autoPlay
              className="w-full h-full object-contain"
            />
          ) : metadata.thumbnail ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={metadata.thumbnail}
                alt={metadata.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent"></div>
              <div className="absolute flex flex-col items-center justify-center text-center p-6">
                <div className="w-16 h-16 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-xl mb-3">
                  <Play className="w-7 h-7 fill-current ml-1" />
                </div>
                <h4 className="font-bold text-base text-white max-w-md line-clamp-2">
                  {metadata.title}
                </h4>
                <p className="text-xs text-zinc-300 mt-1">
                  Ready to download in Full HD & 4K UHD
                </p>
              </div>
            </div>
          ) : (
            <div className="text-zinc-500 text-sm">Media stream ready for download</div>
          )}
        </div>

        {/* Footer info & action */}
        <div className="p-4 bg-zinc-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-zinc-400 flex items-center space-x-3">
            <span>Duration: <strong className="text-zinc-200">{metadata.durationFormatted}</strong></span>
            <span>Uploader: <strong className="text-zinc-200">{metadata.uploader}</strong></span>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <a
              id="preview-view-original-btn"
              href={metadata.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
            >
              <span>View Source</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              id="preview-choose-format-btn"
              onClick={() => {
                onClose();
                onSelectFormat();
              }}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-bold text-white shadow-sm transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Choose Format & Download</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
