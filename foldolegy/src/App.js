import React, { useState, useRef, useEffect } from "react";
import { Stage, Layer, Line, Transformer } from "react-konva";

// Constants
const GRID_SIZE = 5;
const CELL_SIZE = 100;
const SNAP_STEP = 10;

export default function App() {
  // State
  const [triangles, setTriangles] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionRect, setSelectionRect] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [groups, setGroups] = useState([]);
  const [placedShapes, setPlacedShapes] = useState([]);
  const [rightGridTriangles, setRightGridTriangles] = useState([]);
  
  // Refs
  const stageRef = useRef();
  const trRef = useRef();

  // --- Grid Generation Helper ---
  const generateGridTriangles = (prefix, color) => {
    const tris = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const x = col * CELL_SIZE;
        const y = row * CELL_SIZE;
        const half = CELL_SIZE / 2;
        const cx = x + half;
        const cy = y + half;

        const base = { x: 0, y: 0, rotation: 0 };

        // Create 4 triangles per cell
        const triangleConfigs = [
          { suffix: 'tl', points: [x, y, cx, cy, x + CELL_SIZE, y] },
          { suffix: 'tr', points: [x + CELL_SIZE, y, cx, cy, x + CELL_SIZE, y + CELL_SIZE] },
          { suffix: 'br', points: [x + CELL_SIZE, y + CELL_SIZE, cx, cy, x, y + CELL_SIZE] },
          { suffix: 'bl', points: [x, y + CELL_SIZE, cx, cy, x, y] }
        ];

        triangleConfigs.forEach(({ suffix, points }) => {
          tris.push({
            id: `${prefix}-${row}-${col}-${suffix}`,
            points,
            fill: color,
            ...base,
          });
        });
      }
    }
    return tris;
  };

  // --- Initialize Grids ---
  useEffect(() => {
    setTriangles(generateGridTriangles('t', '#6ee7b7')); // Green
    setRightGridTriangles(generateGridTriangles('right-t', '#e0f2fe')); // Light blue
  }, []);

  // --- Selection Handlers ---
  const handleSelect = (id, e) => {
    e.cancelBubble = true;
    const isShift = e.evt.shiftKey;
    
    if (isShift) {
      setSelectedIds(prev =>
        prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
      );
    } else {
      setSelectedIds([id]);
    }
  };

  const handleDeselect = (e) => {
    if (e.target === e.target.getStage() && !isSelecting) {
      setSelectedIds([]);
    }
  };

  // --- Selection Rectangle ---
  const handleMouseDown = (e) => {
    if (e.target !== e.target.getStage()) return;
    e.cancelBubble = true;
    const { x, y } = e.target.getStage().getPointerPosition();
    setSelectionRect({ x, y, width: 0, height: 0 });
    setIsSelecting(true);
  };

  const handleMouseMove = (e) => {
    if (!isSelecting || !selectionRect) return;
    e.cancelBubble = true;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    setSelectionRect({
      x: Math.min(point.x, selectionRect.x),
      y: Math.min(point.y, selectionRect.y),
      width: Math.abs(point.x - selectionRect.x),
      height: Math.abs(point.y - selectionRect.y),
    });
  };

  const handleMouseUp = (e) => {
    if (!isSelecting) return;
    e.cancelBubble = true;
    
    const box = selectionRect;
    const selected = triangles.filter(t => {
      const xs = t.points.filter((_, i) => i % 2 === 0);
      const ys = t.points.filter((_, i) => i % 2 === 1);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      
      return !(maxX < box.x || minX > box.x + box.width || maxY < box.y || minY > box.y + box.height);
    });
    
    setSelectedIds(selected.map(t => t.id));
    setSelectionRect(null);
    setIsSelecting(false);
  };

  // --- Grouping ---
  const handleGroup = () => {
    if (selectedIds.length < 2) return;
    
    const newGroup = {
      id: `group-${Date.now()}`,
      shapes: selectedIds.map(id => triangles.find(t => t.id === id)).filter(Boolean),
      x: 0,
      y: 0,
      rotation: 0,
    };
    
    setGroups(prev => [...prev, newGroup]);
    setTriangles(prev => prev.map(triangle => 
      selectedIds.includes(triangle.id) 
        ? { ...triangle, groupId: newGroup.id }
        : triangle
    ));
    setSelectedIds([]);
  };

  // --- Utility Functions ---
  const snap = (value) => Math.round(value / SNAP_STEP) * SNAP_STEP;

  const findNearestFreeCell = (targetX, targetY) => {
    const targetRow = Math.floor(targetY / CELL_SIZE);
    const targetCol = Math.floor(targetX / CELL_SIZE);
    
    for (let radius = 0; radius < GRID_SIZE; radius++) {
      for (let row = Math.max(0, targetRow - radius); row <= Math.min(GRID_SIZE - 1, targetRow + radius); row++) {
        for (let col = Math.max(0, targetCol - radius); col <= Math.min(GRID_SIZE - 1, targetCol + radius); col++) {
          if (Math.abs(row - targetRow) === radius || Math.abs(col - targetCol) === radius) {
            const cellX = col * CELL_SIZE;
            const cellY = row * CELL_SIZE;
            const isOccupied = placedShapes.some(shape => 
              Math.abs(shape.x - cellX) < CELL_SIZE && 
              Math.abs(shape.y - cellY) < CELL_SIZE
            );
            
            if (!isOccupied) {
              return { x: cellX, y: cellY };
            }
          }
        }
      }
    }
    return null;
  };

  // --- Shape Movement ---
  const moveShapesToCell = (cellX, cellY) => {
    try {
      const selectedShapes = triangles.filter(t => selectedIds.includes(t.id));
      
      if (selectedShapes.length === 0) {
        console.log("No selected shapes to move");
        return;
      }
      
      setTriangles(prev => prev.filter(t => !selectedIds.includes(t.id)));
      
      const movedShapes = selectedShapes.map((shape, index) => ({
        ...shape,
        id: `moved-${Date.now()}-${index}`,
        x: cellX,
        y: cellY,
        groupId: undefined
      }));
      
      setPlacedShapes(prev => [...prev, ...movedShapes]);
      setSelectedIds([]);
      
      console.log(`Successfully moved ${movedShapes.length} shapes to cell (${cellX}, ${cellY})`);
    } catch (error) {
      console.error("Error moving shapes to cell:", error);
    }
  };

  const handleMoveToRightGrid = (targetId, e) => {
    e.cancelBubble = true;
    if (selectedIds.length === 0) return;
    
    const targetCell = rightGridTriangles.find(t => t.id === targetId);
    if (!targetCell) return;
    
    const cellRow = Math.floor(targetCell.points[1] / CELL_SIZE);
    const cellCol = Math.floor(targetCell.points[0] / CELL_SIZE);
    const cellX = cellCol * CELL_SIZE;
    const cellY = cellRow * CELL_SIZE;
    
    const isOccupied = placedShapes.some(shape => 
      Math.abs(shape.x - cellX) < CELL_SIZE && 
      Math.abs(shape.y - cellY) < CELL_SIZE
    );
    
    if (isOccupied) {
      const nearestFreeCell = findNearestFreeCell(cellX, cellY);
      if (nearestFreeCell) {
        moveShapesToCell(nearestFreeCell.x, nearestFreeCell.y);
      }
    } else {
      moveShapesToCell(cellX, cellY);
    }
  };

  // --- Drag Handlers ---
  const handleDragEnd = (e) => {
    const node = e.target;
    const id = node.id().replace('green-', '');
    const maxX = (GRID_SIZE - 1) * CELL_SIZE;
    const maxY = (GRID_SIZE - 1) * CELL_SIZE;
    const constrainedX = Math.max(0, Math.min(snap(node.x()), maxX));
    const constrainedY = Math.max(0, Math.min(snap(node.y()), maxY));
    
    const draggedTriangle = triangles.find(tri => tri.id === id);
    
    if (draggedTriangle && draggedTriangle.groupId) {
      // Group movement
      const groupShapes = triangles.filter(tri => tri.groupId === draggedTriangle.groupId);
      const deltaX = constrainedX - (draggedTriangle.x || 0);
      const deltaY = constrainedY - (draggedTriangle.y || 0);
      
      setTriangles(prev => prev.map(tri => {
        if (tri.groupId === draggedTriangle.groupId) {
          return {
            ...tri,
            x: Math.max(0, Math.min((tri.x || 0) + deltaX, maxX)),
            y: Math.max(0, Math.min((tri.y || 0) + deltaY, maxY))
          };
        }
        return tri;
      }));
      
      // Update visual positions
      groupShapes.forEach(shape => {
        const shapeNode = stageRef.current?.find(`green-${shape.id}`);
        if (shapeNode) {
          const newShapeX = Math.max(0, Math.min((shape.x || 0) + deltaX, maxX));
          const newShapeY = Math.max(0, Math.min((shape.y || 0) + deltaY, maxY));
          shapeNode.position({ x: newShapeX, y: newShapeY });
        }
      });
      
      node.position({ x: constrainedX, y: constrainedY });
    } else {
      // Individual movement
      node.position({ x: constrainedX, y: constrainedY });
      setTriangles(prev => prev.map(tri => 
        tri.id === id 
          ? { ...tri, x: constrainedX, y: constrainedY }
          : tri
      ));
    }
  };

  const handleTransformEnd = (e) => {
    const node = e.target;
    const id = node.id().replace('green-', '');
    const maxX = (GRID_SIZE - 1) * CELL_SIZE;
    const maxY = (GRID_SIZE - 1) * CELL_SIZE;
    const constrainedX = Math.max(0, Math.min(snap(node.x()), maxX));
    const constrainedY = Math.max(0, Math.min(snap(node.y()), maxY));
    const snappedRotation = Math.round(node.rotation() / 15) * 15;
    
    const draggedTriangle = triangles.find(tri => tri.id === id);
    
    if (draggedTriangle && draggedTriangle.groupId) {
      // Group transformation
      const groupShapes = triangles.filter(tri => tri.groupId === draggedTriangle.groupId);
      const deltaX = constrainedX - (draggedTriangle.x || 0);
      const deltaY = constrainedY - (draggedTriangle.y || 0);
      const deltaRotation = snappedRotation - (draggedTriangle.rotation || 0);
      
      setTriangles(prev => prev.map(tri => {
        if (tri.groupId === draggedTriangle.groupId) {
          return {
            ...tri,
            x: Math.max(0, Math.min((tri.x || 0) + deltaX, maxX)),
            y: Math.max(0, Math.min((tri.y || 0) + deltaY, maxY)),
            rotation: (tri.rotation || 0) + deltaRotation
          };
        }
        return tri;
      }));
      
      // Update visual positions and rotations
      groupShapes.forEach(shape => {
        const shapeNode = stageRef.current?.find(`green-${shape.id}`);
        if (shapeNode) {
          const newShapeX = Math.max(0, Math.min((shape.x || 0) + deltaX, maxX));
          const newShapeY = Math.max(0, Math.min((shape.y || 0) + deltaY, maxY));
          const newShapeRotation = (shape.rotation || 0) + deltaRotation;
          shapeNode.position({ x: newShapeX, y: newShapeY });
          shapeNode.rotation(newShapeRotation);
        }
      });
      
      node.position({ x: constrainedX, y: constrainedY });
      node.rotation(snappedRotation);
    } else {
      // Individual transformation
      node.position({ x: constrainedX, y: constrainedY });
      node.rotation(snappedRotation);
      setTriangles(prev => prev.map(tri => 
        tri.id === id 
          ? { ...tri, x: constrainedX, y: constrainedY, rotation: snappedRotation }
          : tri
      ));
    }
  };

  const handlePlacedShapeDragEnd = (e) => {
    const node = e.target;
    const shapeId = node.id();
    const finalX = node.x();
    const finalY = node.y();
    const gridX = finalX - (GRID_SIZE * CELL_SIZE + 20);
    const gridY = finalY;
    const maxX = (GRID_SIZE - 1) * CELL_SIZE;
    const maxY = (GRID_SIZE - 1) * CELL_SIZE;
    const constrainedX = Math.max(0, Math.min(gridX, maxX));
    const constrainedY = Math.max(0, Math.min(gridY, maxY));
    
    node.position({
      x: constrainedX + GRID_SIZE * CELL_SIZE + 20,
      y: constrainedY,
    });
    
    setPlacedShapes(prev => prev.map(shape => 
      shape.id === shapeId 
        ? { ...shape, x: constrainedX, y: constrainedY }
        : shape
    ));
  };

  // --- Transformer ---
  useEffect(() => {
    const stage = stageRef.current;
    const transformer = trRef.current;
    if (!stage || !transformer) return;

    const selectedNodes = selectedIds.map(id => stage.findOne(`#green-${id}`)).filter(Boolean);
    transformer.nodes(selectedNodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds]);

  // --- Grid Lines ---
  const gridLines = [];
  for (let i = 0; i <= GRID_SIZE; i++) {
    const pos = i * CELL_SIZE;
    gridLines.push(
      <Line
        key={`v-${i}`}
        points={[pos, 0, pos, GRID_SIZE * CELL_SIZE]}
        stroke="#888"
        strokeWidth={0.5}
      />
    );
    gridLines.push(
      <Line
        key={`h-${i}`}
        points={[0, pos, GRID_SIZE * CELL_SIZE, pos]}
        stroke="#888"
        strokeWidth={0.5}
      />
    );
  }

  // --- Right Grid Lines ---
  const rightGridLines = [];
  for (let i = 0; i <= GRID_SIZE; i++) {
    const pos = i * CELL_SIZE;
    rightGridLines.push(
      <Line
        key={`right-v-${i}`}
        points={[pos, 0, pos, GRID_SIZE * CELL_SIZE]}
        stroke="#888"
        strokeWidth={0.5}
      />
    );
    rightGridLines.push(
      <Line
        key={`right-h-${i}`}
        points={[0, pos, GRID_SIZE * CELL_SIZE, pos]}
        stroke="#888"
        strokeWidth={0.5}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', width: '100%' }}>
      <h1 className="text-xl font-bold mb-2">Foldolegy – Snap-to-Grid</h1>

      <div className="flex gap-2 mb-3">
        <button
          onClick={handleGroup}
          disabled={selectedIds.length < 2}
          className={`px-3 py-1 rounded text-white ${
            selectedIds.length < 2
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          Gruppieren ({selectedIds.length})
        </button>
        <button
          onClick={() => setSelectedIds([])}
          className="bg-gray-500 text-white px-3 py-1 rounded"
        >
          Auswahl aufheben
        </button>
        <button
          onClick={() => {
            setTriangles(prev => [...prev, ...placedShapes.map(shape => ({
              ...shape,
              id: shape.id.replace('moved-', 't-'),
              x: 0,
              y: 0,
              rotation: 0
            }))]);
            setPlacedShapes([]);
          }}
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
        >
          Shapes zurück
        </button>
      </div>

      {/* Single Stage with both grids side by side */}
      <Stage
        ref={stageRef}
        width={GRID_SIZE * CELL_SIZE * 2 + 40}
        height={GRID_SIZE * CELL_SIZE}
        style={{ border: "1px solid #ccc", background: "#f7f7f7" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleDeselect}
      >
        {/* Background Layer - Both Grids */}
        <Layer>
          {/* Left Grid Lines */}
          {gridLines}

          {/* Left Grid Cells (clickable) */}
          {triangles.map((tri) => (
            <Line
              key={tri.id}
              id={tri.id}
              points={tri.points}
              closed
              fill={tri.fill}
              stroke="#444"
              strokeWidth={0.5}
              opacity={0.3}
              onClick={(e) => handleSelect(tri.id, e)}
              style={{ cursor: 'pointer' }}
              listening={true}
              hitStrokeWidth={0}
            />
          ))}

          {/* Right Grid Lines */}
          {rightGridLines.map(line => (
            <Line
              key={line.key}
              points={line.props.points.map((point, i) => 
                i % 2 === 0 ? point + GRID_SIZE * CELL_SIZE + 20 : point
              )}
              stroke={line.props.stroke}
              strokeWidth={line.props.strokeWidth}
            />
          ))}

          {/* Right Grid Cells (clickable) */}
          {rightGridTriangles.map((tri) => {
            const cellRow = Math.floor(tri.points[1] / CELL_SIZE);
            const cellCol = Math.floor(tri.points[0] / CELL_SIZE);
            const cellX = cellCol * CELL_SIZE;
            const cellY = cellRow * CELL_SIZE;
            
            const isOccupied = placedShapes.some(shape => 
              Math.abs(shape.x - cellX) < CELL_SIZE && 
              Math.abs(shape.y - cellY) < CELL_SIZE
            );
            
            return (
              <Line
                key={tri.id}
                id={tri.id}
                points={tri.points.map((point, i) => 
                  i % 2 === 0 ? point + GRID_SIZE * CELL_SIZE + 20 : point
                )}
                closed
                fill={isOccupied ? "#ff6b6b" : tri.fill}
                stroke={isOccupied ? "#ff0000" : "#444"}
                strokeWidth={isOccupied ? 2 : 0.5}
                opacity={isOccupied ? 0.6 : 0.3}
                onClick={(e) => {
                  if (!isOccupied) {
                    handleMoveToRightGrid(tri.id, e);
                  }
                }}
                style={{ cursor: isOccupied ? 'not-allowed' : 'pointer' }}
                listening={!isOccupied}
                hitStrokeWidth={0}
              />
            );
          })}
        </Layer>

        {/* Surface Layer - Interactive Shapes */}
        <Layer>
          {/* Green Prototype Shapes in Left Grid */}
          {triangles.map((tri) => {
            const isGrouped = tri.groupId;
            const isSelected = selectedIds.includes(tri.id);
            
            return (
              <Line
                key={`green-${tri.id}`}
                id={`green-${tri.id}`}
                points={tri.points}
                closed
                fill={isGrouped ? "#3b82f6" : "#22c55e"}
                stroke={isSelected ? "#ff0000" : isGrouped ? "#1d4ed8" : "#444"}
                strokeWidth={isSelected ? 3 : isGrouped ? 2 : 0.5}
                x={tri.x || 0}
                y={tri.y || 0}
                rotation={tri.rotation || 0}
                draggable
                onClick={(e) => {
                  e.cancelBubble = true;
                  if (isGrouped) {
                    const groupShapes = triangles.filter(t => t.groupId === tri.groupId);
                    setSelectedIds(groupShapes.map(s => s.id));
                  } else {
                    handleSelect(tri.id, e);
                  }
                }}
                onTap={(e) => {
                  e.cancelBubble = true;
                  if (isGrouped) {
                    const groupShapes = triangles.filter(t => t.groupId === tri.groupId);
                    setSelectedIds(groupShapes.map(s => s.id));
                  } else {
                    handleSelect(tri.id, e);
                  }
                }}
                onMouseDown={(e) => {
                  e.cancelBubble = true;
                  e.evt.stopPropagation();
                }}
                onDragStart={(e) => {
                  e.cancelBubble = true;
                  e.evt.stopPropagation();
                  e.target.moveToTop();
                  e.target.getStage().batchDraw();
                }}
                onDragEnd={handleDragEnd}
                onTransformEnd={handleTransformEnd}
                listening={true}
                hitStrokeWidth={20}
                perfectDrawEnabled={false}
              />
            );
          })}

          {/* Placed Shapes in Right Grid */}
          {placedShapes.map((shape) => (
            <Line
              key={shape.id}
              id={shape.id}
              points={shape.points}
              closed
              fill={shape.fill}
              stroke="#ff0000"
              strokeWidth={3}
              x={shape.x + GRID_SIZE * CELL_SIZE + 20}
              y={shape.y}
              draggable
              onClick={(e) => {
                e.cancelBubble = true;
                e.evt.stopPropagation();
                handleSelect(shape.id, e);
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                e.evt.stopPropagation();
                handleSelect(shape.id, e);
              }}
              onMouseDown={(e) => {
                e.cancelBubble = true;
                e.evt.stopPropagation();
              }}
              onDragStart={(e) => {
                e.cancelBubble = true;
                e.evt.stopPropagation();
                e.target.moveToTop();
                e.target.getStage().batchDraw();
              }}
              onDragEnd={(e) => {
                e.cancelBubble = true;
                e.evt.stopPropagation();
                handlePlacedShapeDragEnd(e);
              }}
              onTransformEnd={handleTransformEnd}
              listening={true}
              hitStrokeWidth={20}
              perfectDrawEnabled={false}
            />
          ))}

          {/* Selection Rectangle */}
          {selectionRect && (
            <Line
              points={[
                selectionRect.x,
                selectionRect.y,
                selectionRect.x + selectionRect.width,
                selectionRect.y,
                selectionRect.x + selectionRect.width,
                selectionRect.y + selectionRect.height,
                selectionRect.x,
                selectionRect.y + selectionRect.height,
              ]}
              closed
              fill="rgba(0, 0, 255, 0.1)"
              stroke="blue"
              strokeWidth={1}
              listening={false}
            />
          )}

          {/* Transformer */}
          <Transformer
            ref={trRef}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 5 || newBox.height < 5) {
                return oldBox;
              }
              return newBox;
            }}
          />
        </Layer>
      </Stage>
    </div>
  );
}