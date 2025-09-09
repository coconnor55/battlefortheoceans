// src/components/BackgroundVideo.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useVideo } from '../context/VideoContext';

const version = 'v0.1.1';

const BackgroundVideo = () => {
  const { videoRef, startVideo, stopVideo, selectedVideo } = useVideo();

  useEffect(() => {
    console.log(version, 'BackgroundVideo', 'Mounting, starting video');
    startVideo();
    return () => {
      console.log(version, 'BackgroundVideo', 'Unmounting, stopping video');
      stopVideo();
    };
  }, []);

  if (!selectedVideo) {
    console.log(version, 'BackgroundVideo', 'No selected video yet');
    return null;
  }

  console.log(version, 'BackgroundVideo', 'Rendering video with src:', selectedVideo);
  return ReactDOM.createPortal(
    <video ref={videoRef} muted loop playsInline style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: -1 }}>
      <source src={selectedVideo} type="video/mp4" />
      Your browser does not support the video tag.
    </video>,
    document.getElementById('video-background')
  );
};

export default BackgroundVideo;

// EOF - EOF - EOF
