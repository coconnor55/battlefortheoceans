// src/components/BackgroundVideo.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useVideo } from '../context/VideoContext';

const version = 'v0.1.0'

const BackgroundVideo = () => {
  const { videoRef, startVideo, stopVideo, selectedVideo } = useVideo();

  useEffect(() => {
    startVideo();
    return () => stopVideo();
  }, []);

  return ReactDOM.createPortal(
    <video ref={videoRef} muted loop playsInline>
      <source src={selectedVideo} type="video/mp4" />
      Your browser does not support the video tag.
    </video>,
    document.getElementById('video-background') // Fixed DOM node in index.html
  );
};

export default BackgroundVideo;

// EOF - EOF - EOF
