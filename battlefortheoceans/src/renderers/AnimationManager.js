// src/renderers/AnimationManager.js
// Copyright(c) 2025, Clint H. O'Connor

const version = 'v0.1.0';

class AnimationManager {
  constructor() {
    this.animations = [];
    this.particles = [];
  }

  createExplosion(row, col, isOpponentHit, cellSize, labelSize) {
    const centerX = col * cellSize + labelSize + cellSize / 2;
    const centerY = row * cellSize + labelSize + cellSize / 2;
    
    const particleCount = 20 + Math.floor(Math.random() * 11);
    const newParticles = [];
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
      const speed = 2 + Math.random() * 3;
      
      newParticles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        size: 5 + Math.random() * 4,
        color: isOpponentHit
          ? `rgba(0, ${100 + Math.floor(Math.random() * 100)}, 255, 1)`
          : `rgba(255, ${100 + Math.floor(Math.random() * 100)}, 0, 1)`
      });
    }
    
    this.particles = [...this.particles, ...newParticles];
  }

  updateParticles() {
    let stillAlive = false;
    
    this.particles = this.particles.map(p => {
      if (p.life > 0) {
        stillAlive = true;
        return {
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.1,
          life: p.life - 0.03,
          color: p.color.replace('1)', `${p.life})`)
        };
      }
      return p;
    }).filter(p => p.life > 0);
    
    return stillAlive;
  }

  drawParticle(ctx, particle, offsetX, offsetY) {
    ctx.save();
    ctx.globalAlpha = particle.life;
    ctx.fillStyle = particle.color;
    ctx.fillRect(
      offsetX + particle.x - particle.size / 2,
      offsetY + particle.y - particle.size / 2,
      particle.size,
      particle.size
    );
    ctx.restore();
  }

  drawAllParticles(ctx, offsetX, offsetY) {
    this.particles.forEach(particle => {
      this.drawParticle(ctx, particle, offsetX, offsetY);
    });
  }

  addAnimation(animId, type, row, col, radius, color) {
    const animation = {
      id: animId,
      type: type,
      row: row,
      col: col,
      radius: radius,
      color: color,
      progress: 0
    };
    
    this.animations = [...this.animations, animation];
    return animation;
  }

  updateAnimationProgress(animId, progress) {
    this.animations = this.animations.map(anim =>
      anim.id === animId ? { ...anim, progress } : anim
    );
  }

  removeAnimation(animId) {
    this.animations = this.animations.filter(anim => anim.id !== animId);
  }

  drawAnimation(ctx, anim, offsetX, offsetY, cellSize, labelSize) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - anim.progress);
    
    const animX = offsetX + anim.col * cellSize + labelSize + cellSize / 2;
    const animY = offsetY + anim.row * cellSize + labelSize + cellSize / 2;
    
    if (anim.type === 'hit') {
      ctx.fillStyle = anim.color;
      ctx.beginPath();
      ctx.arc(animX, animY, anim.radius * (1 + anim.progress), 0, 2 * Math.PI);
      ctx.fill();
    } else if (anim.type === 'miss') {
      ctx.strokeStyle = anim.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(animX, animY, anim.radius * (1 + anim.progress * 2), 0, 2 * Math.PI);
      ctx.stroke();
    } else if (anim.type === 'splash') {
      ctx.strokeStyle = anim.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(animX, animY, anim.radius * (1 + anim.progress * 2), 0, 2 * Math.PI);
      ctx.stroke();
      
      ctx.strokeStyle = `rgba(255, 165, 0, ${0.5 * (1 - anim.progress)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(animX, animY, anim.radius * (1 + anim.progress * 3), 0, 2 * Math.PI);
      ctx.stroke();
    }
    
    ctx.restore();
  }

  drawAllAnimations(ctx, offsetX, offsetY, cellSize, labelSize) {
    this.animations.forEach(anim => {
      this.drawAnimation(ctx, anim, offsetX, offsetY, cellSize, labelSize);
    });
  }

  getAnimations() {
    return this.animations;
  }

  getParticles() {
    return this.particles;
  }
}

export default AnimationManager;
// EOF
