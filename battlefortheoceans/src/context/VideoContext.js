// src/context/VideoContext.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { createContext, useContext, useRef, useState } from 'react';

const version = "v0.1.0"
const VideoContext = createContext();

const videos = [
    // Add videos for random selection
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
];

export const VideoProvider = ({ children }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);

  const startVideo = () => {
    if (!selectedVideo) {
      const randomVideo = videos[Math.floor(Math.random() * videos.length)];
      setSelectedVideo(randomVideo);
    }
    if (videoRef.current && !isPlaying) {
      videoRef.current.play();
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
