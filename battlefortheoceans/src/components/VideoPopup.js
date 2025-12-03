// src/components/VideoPopup.js v0.1.5
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.5: Fixed looping - set loop=false AFTER metadata loads and on every timeupdate
// v0.1.4: More aggressive anti-looping - set loop={false} in JSX AND via property AND via setAttribute
// v0.1.3: Fixed looping issue - set both loop attribute and property to false
// v0.1.2: Fixed video looping - explicitly set loop={false}
// v0.1.1: Added error handling - gracefully closes if video fails to load
// v0.1.0: Video popup for ship sunk events

import React, { useEffect, useRef } from 'react';

const version = 'v0.1.5';

const VideoPopup = ({ videoSrc, onComplete }) => {
  const videoRef = useRef(null);
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    // Prevent double-play from React strict mode
    if (hasPlayedRef.current) {
      console.log('[VIDEO]', version, 'Already played, skipping');
      return;
    }
    
    console.log('[VIDEO]', version, 'Playing video:', videoSrc);
    
    if (videoRef.current && videoSrc) {
      const video = videoRef.current;
      
      // Set src programmatically to avoid OpaqueResponseBlocking
      video.src = videoSrc;
      
      // Set loop to false
      video.loop = false;
      video.removeAttribute('loop');
      
      console.log('[VIDEO]', version, 'Initial loop property:', video.loop);
      console.log('[VIDEO]', version, 'Video src set to:', videoSrc);
      
      // Listen for metadata loaded to enforce loop=false
      const handleLoadedMetadata = () => {
        video.loop = false;
        console.log('[VIDEO]', version, 'After metadata - loop property:', video.loop);
      };
      
      // Continuously enforce no looping during playback
      const handleTimeUpdate = () => {
        if (video.loop) {
          video.loop = false;
          console.log('[VIDEO]', version, 'Corrected loop property during playback');
        }
      };
      
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('timeupdate', handleTimeUpdate);
      
      // Load the video
      video.load();
      
      hasPlayedRef.current = true;
      
      video.play().catch(error => {
        console.warn('[VIDEO]', version, 'Video play failed:', error);
        onComplete?.();
      });
      
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('timeupdate', handleTimeUpdate);
      };
    }
  }, [videoSrc, onComplete]); // Re-run if videoSrc changes

  const handleVideoEnd = () => {
    console.log('[VIDEO]', version, 'Video ended - closing popup');
    onComplete?.();
  };

  const handleSkip = () => {
    console.log('[VIDEO]', version, 'Video skipped');
    if (videoRef.current) {
      videoRef.current.pause();
    }
    onComplete?.();
  };

  const handleVideoError = (e) => {
    console.warn('[VIDEO]', version, 'Video load error:', e.target.error);
    onComplete?.();
  };

  return (
    <div className="video-popup">
      <div className="video-popup__overlay" onClick={handleSkip}>
        <div className="video-popup__content">
          <video
            ref={videoRef}
            className="video-popup__video"
            onEnded={handleVideoEnd}
            onError={handleVideoError}
            playsInline
            preload="auto"
          />
          <button className="video-popup__skip btn btn--sm" onClick={handleSkip}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoPopup;
// EOF
