// src/renderers/TerrainRenderer.js
// Copyright(c) 2025, Clint H. O'Connor

const version = 'v0.1.0';

class TerrainRenderer {
  constructor() {
    this.cachedTerrainLayer = null;
  }

  getTerrainColor(terrain) {
    switch (terrain) {
      case 'deep': return '#FFFFFF';
      case 'shallow': return '#B3D9FF';
      case 'shoal': return '#87CEEB';
      case 'marsh': return '#90EE90';
      case 'land': return '#DEB887';
      case 'rock': return '#A9A9A9';
      case 'excluded': return 'transparent';
      default: return '#FFFFFF';
    }
  }

  clearCache() {
    this.cachedTerrainLayer = null;
  }

  drawTerrainLayer(ctx, eraConfig, cellSize, labelSize, offsetX, offsetY) {
    if (!this.cachedTerrainLayer) {
      const terrainCanvas = document.createElement('canvas');
      terrainCanvas.width = ctx.canvas.width;
      terrainCanvas.height = ctx.canvas.height;
      const terrainCtx = terrainCanvas.getContext('2d');
      
      terrainCtx.fillStyle = '#FFFFFF';
      terrainCtx.font = 'bold 12px Arial';
      terrainCtx.textAlign = 'center';
      terrainCtx.strokeStyle = '#000000';
      terrainCtx.lineWidth = 3;
      
      for (let row = 0; row < eraConfig.rows; row++) {
        const text = (row + 1).toString();
        const x = offsetX + labelSize / 2;
        const y = offsetY + row * cellSize + labelSize + cellSize / 2 + 4;
        
        terrainCtx.strokeText(text, x, y);
        terrainCtx.fillText(text, x, y);
      }

      for (let col = 0; col < eraConfig.cols; col++) {
        const letter = String.fromCharCode(65 + col);
        const x = offsetX + col * cellSize + labelSize + cellSize / 2;
        const y = offsetY + labelSize / 2 + 4;
        
        terrainCtx.strokeText(letter, x, y);
        terrainCtx.fillText(letter, x, y);
      }

      terrainCtx.strokeStyle = '#000';
      terrainCtx.lineWidth = 1;
      for (let row = 0; row <= eraConfig.rows; row++) {
        terrainCtx.beginPath();
        terrainCtx.moveTo(offsetX + labelSize, offsetY + row * cellSize + labelSize);
        terrainCtx.lineTo(offsetX + eraConfig.cols * cellSize + labelSize, offsetY + row * cellSize + labelSize);
        terrainCtx.stroke();
      }
      for (let col = 0; col <= eraConfig.cols; col++) {
        terrainCtx.beginPath();
        terrainCtx.moveTo(offsetX + col * cellSize + labelSize, offsetY + labelSize);
        terrainCtx.lineTo(offsetX + col * cellSize + labelSize, offsetY + eraConfig.rows * cellSize + labelSize);
        terrainCtx.stroke();
      }

      for (let row = 0; row < eraConfig.rows; row++) {
        for (let col = 0; col < eraConfig.cols; col++) {
          const terrain = eraConfig.terrain[row][col];
          if (terrain !== 'excluded') {
            const x = offsetX + col * cellSize + labelSize + 1;
            const y = offsetY + row * cellSize + labelSize + 1;
            const size = cellSize - 2;
            
            terrainCtx.fillStyle = this.getTerrainColor(terrain);
            terrainCtx.fillRect(x, y, size, size);
          }
        }
      }
      
      this.cachedTerrainLayer = terrainCanvas;
    }
    
    ctx.drawImage(this.cachedTerrainLayer, 0, 0);
  }
}

export default TerrainRenderer;
// EOF
