// src/handlers/InputHandler.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.2: Removed getMunitions - TargetOptionsMenu reads munitions directly
// v0.1.1: Munitions refactoring - use munitions object instead of starShellsRemaining
// Handles all canvas input events (mouse, touch, keyboard)
// Manages long press detection, coordinate transformation, and input state

const version = 'v0.1.2';

const LONG_PRESS_DURATION = 500; // ms

class InputHandler {
  constructor({
    canvasRef,
    getMode, // () => 'placement' | 'battle'
    getEraConfig, // () => eraConfig
    getGameBoard, // () => gameBoard
    getGameState, // () => gameState
    getCurrentShip, // () => currentShip
      cellSize,
    labelSize,
    // Callbacks
    onShotFired, // (row, col) => shotResult
    onActionMenuRequested, // ({row, col, clientX, clientY}) => void
    onShipPlaced, // (ship, cells, orientation) => void
    onPlacementPreview, // (cells, isValid) => void
    onValidatePlacement // (cells) => boolean
  }) {
    this.canvasRef = canvasRef;
    this.getMode = getMode;
    this.getEraConfig = getEraConfig;
    this.getGameBoard = getGameBoard;
    this.getGameState = getGameState;
    this.getCurrentShip = getCurrentShip;
      this.cellSize = cellSize;
    this.labelSize = labelSize;
    
    // Callbacks
    this.onShotFired = onShotFired;
    this.onActionMenuRequested = onActionMenuRequested;
    this.onShipPlaced = onShipPlaced;
    this.onPlacementPreview = onPlacementPreview;
    this.onValidatePlacement = onValidatePlacement;
    
    // Placement state
    this.isPlacing = false;
    this.startCell = null;
    this.lastProcessedCell = null;
    
    // Long press state
    this.longPressTimer = null;
    this.longPressTriggered = false;
    
    // Bound event handlers
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    
    console.log('[INPUT]', version, 'InputHandler created');
  }
  
  // Coordinate transformation
  getCanvasCoordinates(clientX, clientY) {
    const canvas = this.canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    return { x, y };
  }
  
  // Convert canvas coordinates to grid cell
  getGridCell(x, y) {
    const col = Math.floor((x - 20 - this.labelSize) / this.cellSize);
    const row = Math.floor((y - 20 - this.labelSize) / this.cellSize);
    return { row, col };
  }
  
  // Check if cell is within bounds
  isValidCell(row, col) {
    const eraConfig = this.getEraConfig();
    return row >= 0 && row < eraConfig.rows && col >= 0 && col < eraConfig.cols;
  }
  
  // Long press management
  startLongPress(clientX, clientY, row, col) {
    const mode = this.getMode();
    const gameState = this.getGameState();
    
    if (mode !== 'battle' || !gameState?.isPlayerTurn || !gameState?.isGameActive) {
      return;
    }
    
    console.log('[INPUT]', version, 'Starting long press at', row, col);
    this.longPressTriggered = false;
    
    this.longPressTimer = setTimeout(() => {
      this.longPressTriggered = true;
      
      // Request action menu
      this.onActionMenuRequested?.({
        row,
        col,
        clientX,
        clientY
      });
      
      console.log('[INPUT]', version, 'Long press menu at', row, col);
    }, LONG_PRESS_DURATION);
  }
  
  cancelLongPress() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }
  
  // Calculate preview cells for placement
  calculatePreviewCells(startCell, currentCell, shipSize) {
    const deltaCol = currentCell.col - startCell.col;
    const deltaRow = currentCell.row - startCell.row;
    
    let direction = 'right';
    
    if (Math.abs(deltaRow) > Math.abs(deltaCol)) {
      direction = deltaRow >= 0 ? 'down' : 'up';
    } else {
      direction = deltaCol >= 0 ? 'right' : 'left';
    }
    
    const cells = [];
    for (let i = 0; i < shipSize; i++) {
      let cellRow = startCell.row;
      let cellCol = startCell.col;
      
      switch (direction) {
        case 'right': cellCol = startCell.col + i; break;
        case 'left': cellCol = startCell.col - i; break;
        case 'down': cellRow = startCell.row + i; break;
        case 'up': cellRow = startCell.row - i; break;
        default: break;
      }
      
      cells.push({ row: cellRow, col: cellCol });
    }
    
    return cells;
  }
  
  // Calculate orientation from cells
  calculateOrientation(cells) {
    if (cells.length < 2) return 0;
    
    const first = cells[0];
    const last = cells[cells.length - 1];
    
    const deltaCol = last.col - first.col;
    const deltaRow = last.row - first.row;
    
    if (Math.abs(deltaCol) > Math.abs(deltaRow)) {
      return deltaCol > 0 ? 0 : 180;
    } else {
      return deltaRow > 0 ? 90 : 270;
    }
  }
  
  // Mouse event handlers
  handleMouseDown(e) {
    const mode = this.getMode();
    const { x, y } = this.getCanvasCoordinates(e.clientX, e.clientY);
    const { row, col } = this.getGridCell(x, y);
    
    if (!this.isValidCell(row, col)) return;
    
    if (mode === 'battle') {
      this.startLongPress(e.clientX, e.clientY, row, col);
      return;
    }
    
    // Placement mode
    const currentShip = this.getCurrentShip();
    if (!currentShip || this.isPlacing) return;
    
    this.startCell = { row, col };
    this.isPlacing = true;
    this.lastProcessedCell = { row, col };
    
    const defaultCells = [];
    for (let i = 0; i < currentShip.size; i++) {
      defaultCells.push({ row, col: col + i });
    }
    
    const isValid = this.onValidatePlacement?.(defaultCells) ?? false;
    this.onPlacementPreview?.(defaultCells, isValid);
  }
  
  handleMouseMove(e) {
    const mode = this.getMode();
    
    // Cancel long press on mouse move
    if (mode === 'battle') {
      this.cancelLongPress();
      return;
    }
    
    // Placement mode
    const currentShip = this.getCurrentShip();
    if (!currentShip || !this.isPlacing || !this.startCell) return;
    
    const { x, y } = this.getCanvasCoordinates(e.clientX, e.clientY);
    const { row, col } = this.getGridCell(x, y);
    
    if (!this.isValidCell(row, col)) return;
    
    // Check if cell changed
    const cellChanged = !this.lastProcessedCell ||
                       this.lastProcessedCell.row !== row ||
                       this.lastProcessedCell.col !== col;
    
    if (!cellChanged) return;
    
    this.lastProcessedCell = { row, col };
    
    const cells = this.calculatePreviewCells(this.startCell, { row, col }, currentShip.size);
    const isValid = this.onValidatePlacement?.(cells) ?? false;
    
    this.onPlacementPreview?.(cells, isValid);
  }
  
  handleMouseUp(e) {
    this.cancelLongPress();
    
    const mode = this.getMode();
    if (mode !== 'placement') {
      this.resetPlacementState();
      return;
    }
    
    const currentShip = this.getCurrentShip();
    if (!currentShip || !this.isPlacing) {
      this.resetPlacementState();
      return;
    }
    
    // Get current preview cells from last preview
    // We need to recalculate from stored state
    const { x, y } = this.getCanvasCoordinates(e.clientX, e.clientY);
    const { row, col } = this.getGridCell(x, y);
    
    if (this.isValidCell(row, col) && this.startCell) {
      const cells = this.calculatePreviewCells(this.startCell, { row, col }, currentShip.size);
      const isValid = this.onValidatePlacement?.(cells) ?? false;
      
      if (isValid && cells.length > 0) {
        const orientation = this.calculateOrientation(cells);
        this.onShipPlaced?.(currentShip, cells, orientation);
      }
    }
    
    this.resetPlacementState();
    this.onPlacementPreview?.([], false);
  }
  
  handleClick(e) {
    this.cancelLongPress();
    
    // If long press was triggered, don't fire shot
    if (this.longPressTriggered) {
      this.longPressTriggered = false;
      return;
    }
    
    const mode = this.getMode();
    if (mode !== 'battle') return;
    
    const gameState = this.getGameState();
    if (!gameState?.isPlayerTurn || !this.onShotFired) return;
    
    const { x, y } = this.getCanvasCoordinates(e.clientX, e.clientY);
    const { row, col } = this.getGridCell(x, y);
    
    if (this.isValidCell(row, col)) {
      this.onShotFired(row, col);
    }
  }
  
  // Touch event handlers
  handleTouchStart(e) {
    e.preventDefault();
    
    const touch = e.touches[0];
    const { x, y } = this.getCanvasCoordinates(touch.clientX, touch.clientY);
    const { row, col } = this.getGridCell(x, y);
    
    if (!this.isValidCell(row, col)) return;
    
    const mode = this.getMode();
    
    if (mode === 'battle') {
      this.startLongPress(touch.clientX, touch.clientY, row, col);
      return;
    }
    
    // Placement mode
    const currentShip = this.getCurrentShip();
    if (!currentShip || this.isPlacing) return;
    
    this.startCell = { row, col };
    this.isPlacing = true;
    this.lastProcessedCell = { row, col };
    
    const defaultCells = [];
    for (let i = 0; i < currentShip.size; i++) {
      defaultCells.push({ row, col: col + i });
    }
    
    const isValid = this.onValidatePlacement?.(defaultCells) ?? false;
    this.onPlacementPreview?.(defaultCells, isValid);
  }
  
  handleTouchMove(e) {
    e.preventDefault();
    
    const mode = this.getMode();
    
    // Cancel long press on touch move
    if (mode === 'battle') {
      this.cancelLongPress();
      return;
    }
    
    // Placement mode
    const currentShip = this.getCurrentShip();
    if (!currentShip || !this.isPlacing || !this.startCell) return;
    
    const touch = e.touches[0];
    const { x, y } = this.getCanvasCoordinates(touch.clientX, touch.clientY);
    const { row, col } = this.getGridCell(x, y);
    
    if (!this.isValidCell(row, col)) return;
    
    // Check if cell changed
    const cellChanged = !this.lastProcessedCell ||
                       this.lastProcessedCell.row !== row ||
                       this.lastProcessedCell.col !== col;
    
    if (!cellChanged) return;
    
    this.lastProcessedCell = { row, col };
    
    const cells = this.calculatePreviewCells(this.startCell, { row, col }, currentShip.size);
    const isValid = this.onValidatePlacement?.(cells) ?? false;
    
    this.onPlacementPreview?.(cells, isValid);
  }
  
  handleTouchEnd(e) {
    e.preventDefault();
    
    this.cancelLongPress();
    
    // If long press was triggered, don't fire shot
    if (this.longPressTriggered) {
      this.longPressTriggered = false;
      return;
    }
    
    const mode = this.getMode();
    
    if (mode === 'battle') {
      const touch = e.changedTouches[0];
      const { x, y } = this.getCanvasCoordinates(touch.clientX, touch.clientY);
      const { row, col } = this.getGridCell(x, y);
      
      if (this.isValidCell(row, col)) {
        const gameState = this.getGameState();
        if (gameState?.isPlayerTurn && this.onShotFired) {
          this.onShotFired(row, col);
        }
      }
      return;
    }
    
    // Placement mode
    const currentShip = this.getCurrentShip();
    if (!currentShip || !this.isPlacing) {
      this.resetPlacementState();
      this.onPlacementPreview?.([], false);
      return;
    }
    
    const touch = e.changedTouches[0];
    const { x, y } = this.getCanvasCoordinates(touch.clientX, touch.clientY);
    const { row, col } = this.getGridCell(x, y);
    
    if (this.isValidCell(row, col) && this.startCell) {
      const cells = this.calculatePreviewCells(this.startCell, { row, col }, currentShip.size);
      const isValid = this.onValidatePlacement?.(cells) ?? false;
      
      if (isValid && cells.length > 0) {
        const orientation = this.calculateOrientation(cells);
        this.onShipPlaced?.(currentShip, cells, orientation);
      }
    }
    
    this.resetPlacementState();
    this.onPlacementPreview?.([], false);
  }
  
  // State management
  resetPlacementState() {
    this.isPlacing = false;
    this.startCell = null;
    this.lastProcessedCell = null;
  }
  
  reset() {
    this.cancelLongPress();
    this.resetPlacementState();
    this.longPressTriggered = false;
  }
  
  // Attach event listeners to canvas
  attach() {
    const canvas = this.canvasRef.current;
    if (!canvas) return;
    
    console.log('[INPUT]', version, 'Attaching event listeners');
    
    canvas.addEventListener('mousedown', this.handleMouseDown);
    canvas.addEventListener('mousemove', this.handleMouseMove);
    canvas.addEventListener('mouseup', this.handleMouseUp);
    canvas.addEventListener('click', this.handleClick);
    canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });
  }
  
  // Detach event listeners
  detach() {
    const canvas = this.canvasRef.current;
    if (!canvas) return;
    
    console.log('[INPUT]', version, 'Detaching event listeners');
    
    canvas.removeEventListener('mousedown', this.handleMouseDown);
    canvas.removeEventListener('mousemove', this.handleMouseMove);
    canvas.removeEventListener('mouseup', this.handleMouseUp);
    canvas.removeEventListener('click', this.handleClick);
    canvas.removeEventListener('touchstart', this.handleTouchStart);
    canvas.removeEventListener('touchmove', this.handleTouchMove);
    canvas.removeEventListener('touchend', this.handleTouchEnd);
    
    this.reset();
  }
}

export default InputHandler;
// EOF
