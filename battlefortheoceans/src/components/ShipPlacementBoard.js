// src/components/ShipPlacementBoard.js
// Copyright(c) 2025, Clint H. O'Connor

import React, { useState, useEffect } from 'react';
import './ShipPlacementBoard.css';

const version = 'v0.1.7';

const ShipPlacementBoard = ({ board, currentShip, onShipPlaced, eraConfig }) => {
  const [previewCells, setPreviewCells] = useState([]);
  const [isValidPlacement, setIsValidPlacement] = useState(false);
  const [startCell, setStartCell] = useState(null);
  const [endCell, setEndCell] = useState(null);

  // Clear preview when ship changes
  useEffect(() => {
    setPreviewCells([]);
    setIsValidPlacement(false);
    setStartCell(null);
    setEndCell(null);
  }, [currentShip]);

  const getCellClass = (row, col) => {
    const terrain = eraConfig.terrain[row][col];
    let classes = [`cell`, `terrain-${terrain}`];
    
    // Show only player ships during placement using sparse grid lookup
    const ships = board.getShipsAt(row, col);
    const hasPlayerShip = ships.some(s => s.owner === 'player');
    if (hasPlayerShip) {
      classes.push('has-ship');
    }
    
    // Check if cell is in preview
    const isPreview = previewCells.some(c => c.row === row && c.col === col);
    if (isPreview) {
      classes.push(isValidPlacement ? 'preview-valid' : 'preview-invalid');
    }
    
    return classes.join(' ');
  };

  const calculateShipCells = (startRow, startCol, endRow, endCol, shipSize) => {
    const cells = [];
    
    if (startRow === endRow) {
      // Horizontal placement
      const minCol = Math.min(startCol, endCol);
      for (let i = 0; i < shipSize; i++) {
        cells.push({ row: startRow, col: minCol + i });
      }
    } else if (startCol === endCol) {
      // Vertical placement
      const minRow = Math.min(startRow, endRow);
      for (let i = 0; i < shipSize; i++) {
        cells.push({ row: minRow + i, col: startCol });
      }
    }
    
    return cells;
  };

  const isValidShipPlacement = (cells) => {
    if (!cells || cells.length === 0) return false;
    
    // Check all cells are within bounds
    for (const cell of cells) {
      if (cell.row < 0 || cell.row >= eraConfig.rows ||
          cell.col < 0 || cell.col >= eraConfig.cols) {
        return false;
      }
      
      // Check terrain allows ship placement
      const terrain = eraConfig.terrain[cell.row][cell.col];
      if (terrain !== 'deep') { // Assuming ships can only be placed in deep water
        return false;
      }
      
      // Check for own ship overlaps (you can't overlap your own ships)
      const ships = board.getShipsAt(cell.row, cell.col);
      const hasOwnShip = ships.some(s => s.owner === 'player');
      if (hasOwnShip) {
        return false;
      }
    }
    
    return true;
  };

  const handleCellMouseDown = (row, col) => {
    if (!currentShip) return;
    
    setStartCell({ row, col });
    setEndCell({ row, col });
    
    // Show single cell preview
    const cells = [{ row, col }];
    setPreviewCells(cells);
    setIsValidPlacement(isValidShipPlacement(cells));
  };

  const handleCellMouseMove = (row, col) => {
    if (!currentShip || !startCell) return;
    
    setEndCell({ row, col });
    
    // Calculate ship placement based on drag direction
    const deltaRow = Math.abs(row - startCell.row);
    const deltaCol = Math.abs(col - startCell.col);
    
    let cells = [];
    
    if (deltaRow > deltaCol) {
      // Vertical placement
      cells = calculateShipCells(startCell.row, startCell.col, row, startCell.col, currentShip.size);
    } else {
      // Horizontal placement
      cells = calculateShipCells(startCell.row, startCell.col, startCell.row, col, currentShip.size);
    }
    
    setPreviewCells(cells);
    setIsValidPlacement(isValidShipPlacement(cells));
  };

  const handleCellMouseUp = (row, col) => {
    if (!currentShip || !startCell || !isValidPlacement) {
      console.log(version, 'Invalid placement attempt:', {
        hasCurrentShip: !!currentShip,
        hasStartCell: !!startCell,
        isValidPlacement
      });
      // Clear preview on invalid placement
      setPreviewCells([]);
      setIsValidPlacement(false);
      setStartCell(null);
      setEndCell(null);
      return;
    }
    
    console.log(version, 'Processing ship placement:', {
      ship: currentShip.name,
      startCell,
      endCell: { row, col },
      previewCells: previewCells.length
    });
    
    // Determine placement orientation
    const deltaRow = Math.abs(row - startCell.row);
    const deltaCol = Math.abs(col - startCell.col);
    const isHorizontal = deltaCol >= deltaRow;
    
    // Calculate final position (top-left of ship)
    let finalRow, finalCol;
    if (isHorizontal) {
      finalRow = startCell.row;
      finalCol = Math.min(startCell.col, col);
    } else {
      finalRow = Math.min(startCell.row, row);
      finalCol = startCell.col;
    }
    
    console.log(version, 'Final placement:', {
      finalRow,
      finalCol,
      isHorizontal,
      shipSize: currentShip.size
    });
    
    // Attempt to place the ship
    const success = onShipPlaced(currentShip, finalRow, finalCol, isHorizontal);
    
    if (success) {
      console.log(version, `Ship placed successfully: ${currentShip.name} at ${finalRow},${finalCol} ${isHorizontal ? 'H' : 'V'}`);
    } else {
      console.log(version, `Failed to place ship: ${currentShip.name}`);
    }
    
    // Clear preview
    setPreviewCells([]);
    setIsValidPlacement(false);
    setStartCell(null);
    setEndCell(null);
  };

  // Touch event handlers for mobile
  const handleTouchStart = (e, row, col) => {
    e.preventDefault();
    handleCellMouseDown(row, col);
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element && element.dataset.row !== undefined) {
      const row = parseInt(element.dataset.row);
      const col = parseInt(element.dataset.col);
      handleCellMouseMove(row, col);
    }
  };

  const handleTouchEnd = (e, row, col) => {
    e.preventDefault();
    handleCellMouseUp(row, col);
  };

  return (
    <div className="ship-placement-board">
      <div
        className="board-grid"
        style={{
          gridTemplateRows: `repeat(${eraConfig.rows}, 1fr)`,
          gridTemplateColumns: `repeat(${eraConfig.cols}, 1fr)`
        }}
      >
        {Array.from({ length: eraConfig.rows }, (_, row) =>
          Array.from({ length: eraConfig.cols }, (_, col) => (
            <div
              key={`${row}-${col}`}
              className={getCellClass(row, col)}
              data-row={row}
              data-col={col}
              onMouseDown={() => handleCellMouseDown(row, col)}
              onMouseMove={() => handleCellMouseMove(row, col)}
              onMouseUp={() => handleCellMouseUp(row, col)}
              onTouchStart={(e) => handleTouchStart(e, row, col)}
              onTouchMove={handleTouchMove}
              onTouchEnd={(e) => handleTouchEnd(e, row, col)}
            >
              <span className="cell-coord">{String.fromCharCode(65 + col)}{row + 1}</span>
            </div>
          ))
        )}
      </div>
      
      {currentShip && (
        <div className="placement-instructions">
          <p>Tap and drag to place {currentShip.name} ({currentShip.size} squares)</p>
          <p>Drag horizontally or vertically to set orientation</p>
        </div>
      )}
    </div>
  );
};

export default ShipPlacementBoard;

// EOF
