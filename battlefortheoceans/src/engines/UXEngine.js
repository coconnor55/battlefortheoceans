// src/engines/UXEngine.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.0: Initial UXEngine - 30fps rendering loop for visual presentation
//         - Runs independently of React render cycles
//         - Handles smooth animations (fire, smoke, particles)
//         - Complements CoreEngine (game logic) with presentation layer

const version = 'v0.1.0';

class UXEngine {
  constructor() {
    this.isRunning = false;
    this.animationFrameId = null;
    this.lastFrameTime = 0;
    this.renderCallback = null;
    
    // 30fps = 33.33ms per frame
    this.fps = 30;
    this.frameTime = 1000 / this.fps;
    
    console.log('[UX]', version, 'UXEngine initialized');
  }

  /**
   * Start the rendering loop
   * @param {Function} renderCallback - Function to call each frame
   */
  start(renderCallback) {
    if (this.isRunning) {
      console.warn('[UX]', version, 'UXEngine already running');
      return;
    }

    if (typeof renderCallback !== 'function') {
      console.error('[UX]', version, 'Invalid render callback');
      return;
    }

    this.renderCallback = renderCallback;
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    
    console.log('[UX]', version, `Starting ${this.fps}fps render loop`);
    this.loop(this.lastFrameTime);
  }

  /**
   * Stop the rendering loop
   */
  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    console.log('[UX]', version, 'Render loop stopped');
  }

  /**
   * Main rendering loop - throttled to target FPS
   */
  loop = (currentTime) => {
    if (!this.isRunning) return;

    // Calculate elapsed time since last frame
    const elapsed = currentTime - this.lastFrameTime;

    // Throttle to target FPS
    if (elapsed >= this.frameTime) {
      // Adjust for any drift
      this.lastFrameTime = currentTime - (elapsed % this.frameTime);

      // Call the render callback
      if (this.renderCallback) {
        try {
          this.renderCallback(currentTime);
        } catch (error) {
          console.error('[UX]', version, 'Render callback error:', error);
        }
      }
    }

    // Schedule next frame
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  /**
   * Check if engine is running
   */
  getIsRunning() {
    return this.isRunning;
  }

  /**
   * Get current FPS setting
   */
  getFPS() {
    return this.fps;
  }

  /**
   * Update FPS (will take effect on next frame)
   */
  setFPS(newFPS) {
    if (newFPS <= 0 || newFPS > 120) {
      console.warn('[UX]', version, 'Invalid FPS:', newFPS);
      return;
    }
    
    this.fps = newFPS;
    this.frameTime = 1000 / this.fps;
    console.log('[UX]', version, `FPS updated to ${this.fps}`);
  }
}

export default UXEngine;
// EOF
