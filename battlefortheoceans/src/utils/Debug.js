// src/utils/Debug.js (v0.1.47)
// Copyright(c) 2025, Clint H. O'Connor
// LOCKED - do not modify
const Debug = {
  log(version, ...args) {
    console.log(`${version}:`, ...args);
  },
  error(version, ...args) {
    console.error(`${version}:`, ...args);
  },
  warn(version, ...args) {
    console.warn(`${version}:`, ...args);
  }
};

export default Debug;
