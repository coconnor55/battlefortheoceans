// src/components/VideoPopup.js v0.1.6
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.6: Video interruption - new videos stop currently playing videos
//         - Removed hasPlayedRef (was preventing video changes)
//         - Added currentVideoRef to track playing video
//         - Pause and reset current video when new video starts
//         - Enables victory/defeat videos to interrupt ship sunk videos
// v0.1.5: Fixed looping - set loop=false AFTER metadata loads and on every timeupdate
// v0.1.4: More aggressive anti-looping - set loop={false} in JSX AND via property AND via setAttribute
// v0.1.3: Fixed looping issue - set both loop attribute and property to false
// v0.1.2: Fixed video looping - explicitly set loop={false}
// v0.1.1: Added error handling - gracefully closes if video fails to load
// v0.1.0: Video popup for ship sunk events

import React, { useEffect, useRef } from 'react';

const version = 'v0.1.6';

const VideoPopup = ({ videoSrc, onComplete, priority = 'normal' }) => {
  const videoRef = useRef(null);
  const currentVideoRef = useRef(null);

  useEffect(() => {
    console.log('[VIDEO]', version, 'Playing video:', videoSrc, 'priority:', priority);
    
    if (videoRef.current && videoSrc) {
      const video = videoRef.current;
      
      // If a video is currently playing, stop it (especially for high-priority videos)
      if (currentVideoRef.current && currentVideoRef.current !== videoSrc) {
        console.log('[VIDEO]', version, 'Stopping previous video:', currentVideoRef.current);
        video.pause();
        video.currentTime = 0;
      }
      
      // Track current video
      currentVideoRef.current = videoSrc;
      
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
      
      video.play().catch(error => {
        console.warn('[VIDEO]', version, 'Video play failed:', error);
        
        // Collect video errors for analysis
        import('../utils/ErrorCollector').then(({ collectError, ErrorSeverity }) => {
          collectError(
            error,
            { 
              component: 'VideoPopup',
              videoSrc: videoSrc 
            },
            ErrorSeverity.LOW
          );
        }).catch(() => {
          // ErrorCollector not available
        });
        
        onComplete?.();
      });
      
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('timeupdate', handleTimeUpdate);
      };
    }
  }, [videoSrc, onComplete, priority]); // Re-run if videoSrc changes

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
