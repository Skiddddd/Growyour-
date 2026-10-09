import React, { useState } from 'react';

// Thumbnail inside a chat bubble; tap to view full screen.
export const ChatImage: React.FC<{ src: string }> = ({ src }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <img
        src={src}
        alt="Attachment"
        onClick={() => setOpen(true)}
        className="rounded-lg max-h-56 w-auto max-w-full cursor-zoom-in mb-1"
      />
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <img src={src} alt="Attachment full size" className="max-w-full max-h-full object-contain rounded-lg" />
          <button
            type="button"
            aria-label="Close image"
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-800/90 text-white flex items-center justify-center"
            onClick={() => setOpen(false)}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}
    </>
  );
};

export default ChatImage;
