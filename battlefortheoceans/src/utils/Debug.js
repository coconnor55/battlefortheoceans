// src/utils/Debug.js (v0.1.47)
// Copyright(c) 2025, Clint H. O'Connor

const Debug = {
  log(version, ...args) {
    console.log(`Battleship ${version}:`, ...args);
  },
  error(version, ...args) {
    console.error(`Battleship ${version}:`, ...args);
  },
  warn(version, ...args) {
    console.warn(`Battleship ${version}:`, ...args);
  }
};

export default Debug;
