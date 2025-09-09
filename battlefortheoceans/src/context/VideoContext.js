// src/context/VideoContext.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { createContext, useContext, useRef, useState, useEffect } from 'react';

const version = 'v0.1.4';

const VideoContext = createContext();

const videos = [
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
];

export const VideoProvider = ({ children }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(() => videos[Math.floor(Math.random() * videos.length)]);

  useEffect(() => {
    if (videoRef.current && selectedVideo) {
      videoRef.current.play().catch(error => console.error(version, 'Initial video play error:', error));
      setIsPlaying(true);
    }
  }, [selectedVideo]);

  const startVideo = () => {
    if (videoRef.current && !isPlaying && selectedVideo) {
      videoRef.current.play().catch(error => console.error(version, 'Video play error:', error));
      setIsPlaying(true);
    }
  };

  const stopVideo = () => {
    if (videoRef.current && isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <VideoContext.Provider value={{ videoRef, startVideo, stopVideo, selectedVideo }}>
      {children}
    </VideoContext.Provider>
  );
};

export const useVideo = () => useContext(VideoContext);

// EOF - EOF - EOF
