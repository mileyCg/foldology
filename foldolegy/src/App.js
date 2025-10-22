import React, { useState, useRef, useEffect } from "react";
import { Stage, Layer, Line, Transformer, Group } from "react-konva";

const GRID_SIZE = 5;
const CELL_SIZE = 100;
const SNAP_STEP = 10; // Einrasten alle 10 px (fein genug für Druckraster)

export default function App() {
  const [triangles, setTriangles] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionRect, setSelectionRect] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [groups, setGroups] = useState([]);
  const [placedShapes, setPlacedShapes] = useState([]); // For the second 5x5 area
  const [rightGridTriangles, setRightGridTriangles] = useState([]); // Same grid structure for right side
  const stageRef = useRef();
  const trRef = useRef();
  const secondStageRef = useRef();

  // --- Raster vorbereiten ---
  useEffect(() => {
    const tris = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const x = col * CELL_SIZE;
        const y = row * CELL_SIZE;
        const half = CELL_SIZE / 2;
        const cx = x + half;
        const cy = y + half;

        const color = "#6ee7b7"; // grün
        const base = { x: 0, y: 0, rotation: 0 };

        tris.push({
          id: `t-${row}-${col}-tl`,
          points: [x, y, cx, cy, x + CELL_SIZE, y],
          fill: color,
          ...base,
        });
        tris.push({
          id: `t-${row}-${col}-tr`,
          points: [x + CELL_SIZE, y, cx, cy, x + CELL_SIZE, y + CELL_SIZE],
          fill: color,
          ...base,
        });
        tris.push({
          id: `t-${row}-${col}-br`,
          points: [x + CELL_SIZE, y + CELL_SIZE, cx, cy, x, y + CELL_SIZE],
          fill: color,
          ...base,
        });
        tris.push({
          id: `t-${row}-${col}-bl`,
          points: [x, y + CELL_SIZE, cx, cy, x, y],
          fill: color,
          ...base,
        });
      }
    }
    setTriangles(tris);
    
    // Create the same grid structure for the right side
    const rightTris = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const x = col * CELL_SIZE;
        const y = row * CELL_SIZE;
        const half = CELL_SIZE / 2;
        const cx = x + half;
        const cy = y + half;

        const color = "#e0f2fe"; // light blue
        const base = { x: 0, y: 0, rotation: 0 };

        rightTris.push({
          id: `right-t-${row}-${col}-tl`,
          points: [x, y, cx, cy, x + CELL_SIZE, y],
          fill: color,
          ...base,
        });
        rightTris.push({
          id: `right-t-${row}-${col}-tr`,
          points: [x + CELL_SIZE, y, cx, cy, x + CELL_SIZE, y + CELL_SIZE],
          fill: color,
          ...base,
        });
        rightTris.push({
          id: `right-t-${row}-${col}-br`,
          points: [x + CELL_SIZE, y + CELL_SIZE, cx, cy, x, y + CELL_SIZE],
          fill: color,
          ...base,
        });
        rightTris.push({
          id: `right-t-${row}-${col}-bl`,
          points: [x, y + CELL_SIZE, cx, cy, x, y],
          fill: color,
          ...base,
        });
      }
    }
    setRightGridTriangles(rightTris);
  }, []);

  // --- Klickauswahl ---
  const handleSelect = (id, e) => {
    e.cancelBubble = true;
    const isShift = e.evt.shiftKey;
    if (isShift) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
      );
    } else {
      setSelectedIds([id]);
    }
  };

  // --- Auswahlrechteck Start ---
  const handleMouseDown = (e) => {
    if (e.target !== e.target.getStage()) return;
    e.cancelBubble = true;
    const { x, y } = e.target.getStage().getPointerPosition();
    setSelectionRect({ x, y, width: 0, height: 0 });
    setIsSelecting(true);
  };

  // --- Auswahlrechteck Bewegung ---
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

  // --- Auswahlrechteck Ende ---
  const handleMouseUp = (e) => {
    if (!isSelecting) return;
    e.cancelBubble = true;
    const box = selectionRect;
    const selected = triangles
      .filter((t) => {
        const xs = t.points.filter((_, i) => i % 2 === 0);
        const ys = t.points.filter((_, i) => i % 2 === 1);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        return (
          minX < box.x + box.width &&
          maxX > box.x &&
          minY < box.y + box.height &&
          maxY > box.y
        );
      })
      .map((t) => t.id);
    setSelectedIds(selected);
    setSelectionRect(null);
    setIsSelecting(false);
  };

  // --- Klick ins Leere = Deselektieren ---
  const handleDeselect = (e) => {
    if (e.target === e.target.getStage() && !isSelecting) {
      setSelectedIds([]);
    }
  };

  // --- Gruppieren ---
  const handleGroup = () => {
    if (selectedIds.length < 2) return;
    const grouped = triangles.filter((t) => selectedIds.includes(t.id));
    const rest = triangles.filter((t) => !selectedIds.includes(t.id));
    setGroups([
      ...groups,
      {
        id: `group-${groups.length}`,
        shapes: grouped,
        x: 0,
        y: 0,
        rotation: 0,
      },
    ]);
    setTriangles(rest);
    setSelectedIds([]);
  };

  // --- Move shapes from left to right grid ---
  const handleMoveToRightGrid = (targetId, e) => {
    e.cancelBubble = true;
    if (selectedIds.length === 0) {
      console.log("No shapes selected");
      return;
    }
    
    // Find the target cell position in right grid
    const targetCell = rightGridTriangles.find(t => t.id === targetId);
    if (!targetCell) {
      console.log("Target cell not found:", targetId);
      return;
    }
    
    // Calculate cell position (top-left corner of the cell)
    const cellRow = Math.floor(targetCell.points[1] / CELL_SIZE);
    const cellCol = Math.floor(targetCell.points[0] / CELL_SIZE);
    const cellX = cellCol * CELL_SIZE;
    const cellY = cellRow * CELL_SIZE;
    
    console.log(`Target cell: Row ${cellRow}, Col ${cellCol}, Position (${cellX}, ${cellY})`);
    
    // Check if target cell is already occupied
    const isOccupied = placedShapes.some(shape => 
      Math.abs(shape.x - cellX) < CELL_SIZE && 
      Math.abs(shape.y - cellY) < CELL_SIZE
    );
    
    console.log(`Cell occupied: ${isOccupied}`);
    console.log(`Current placed shapes:`, placedShapes.map(s => ({x: s.x, y: s.y})));
    
    if (isOccupied) {
      // Find nearest free cell
      const nearestFreeCell = findNearestFreeCell(cellX, cellY);
      if (!nearestFreeCell) {
        console.log("No free cells available");
        return; // No free cells available
      }
      
      console.log(`Moving to nearest free cell: (${nearestFreeCell.x}, ${nearestFreeCell.y})`);
      // Move selected shapes to nearest free cell
      moveShapesToCell(nearestFreeCell.x, nearestFreeCell.y);
    } else {
      console.log(`Moving to target cell: (${cellX}, ${cellY})`);
      // Move shapes to target cell
      moveShapesToCell(cellX, cellY);
    }
  };

  // --- Find nearest free cell ---
  const findNearestFreeCell = (targetX, targetY) => {
    const targetRow = Math.floor(targetY / CELL_SIZE);
    const targetCol = Math.floor(targetX / CELL_SIZE);
    
    console.log(`Searching for free cell near (${targetX}, ${targetY}) - Row ${targetRow}, Col ${targetCol}`);
    
    // Check all cells in expanding radius
    for (let radius = 0; radius < GRID_SIZE; radius++) {
      console.log(`Checking radius ${radius}`);
      for (let row = Math.max(0, targetRow - radius); row <= Math.min(GRID_SIZE - 1, targetRow + radius); row++) {
        for (let col = Math.max(0, targetCol - radius); col <= Math.min(GRID_SIZE - 1, targetCol + radius); col++) {
          const cellX = col * CELL_SIZE;
          const cellY = row * CELL_SIZE;
          
          // Check if this cell is free
          const isOccupied = placedShapes.some(shape => 
            Math.abs(shape.x - cellX) < CELL_SIZE && 
            Math.abs(shape.y - cellY) < CELL_SIZE
          );
          
          console.log(`Cell (${row}, ${col}) at (${cellX}, ${cellY}) - Occupied: ${isOccupied}`);
          
          if (!isOccupied) {
            console.log(`Found free cell at (${cellX}, ${cellY})`);
            return { x: cellX, y: cellY };
          }
        }
      }
    }
    console.log("No free cells found");
    return null; // No free cells
  };

  // --- Move shapes to specific cell ---
  const moveShapesToCell = (cellX, cellY) => {
    const selectedShapes = triangles.filter((t) => selectedIds.includes(t.id));
    
    // Remove selected shapes from left grid
    setTriangles(prev => prev.filter(t => !selectedIds.includes(t.id)));
    
    // Add shapes to right grid at specified cell
    const movedShapes = selectedShapes.map((shape, index) => ({
      ...shape,
      id: `moved-${Date.now()}-${index}`,
      x: cellX,
      y: cellY,
    }));
    
    setPlacedShapes([...placedShapes, ...movedShapes]);
    setSelectedIds([]);
  };

  // --- Handle drag end for placed shapes ---
  const handlePlacedShapeDragEnd = (e) => {
    const node = e.target;
    const shapeId = node.id();
    
    // Get the final position
    const finalX = node.x();
    const finalY = node.y();
    
    // Convert to grid coordinates (remove the offset for right grid)
    const gridX = finalX - (GRID_SIZE * CELL_SIZE + 20);
    const gridY = finalY;
    
    // Only constrain to grid bounds, but allow free movement within
    const maxX = (GRID_SIZE - 1) * CELL_SIZE;
    const maxY = (GRID_SIZE - 1) * CELL_SIZE;
    const constrainedX = Math.max(0, Math.min(gridX, maxX));
    const constrainedY = Math.max(0, Math.min(gridY, maxY));
    
    // Update position - allow free movement within grid bounds
    node.position({
      x: constrainedX + GRID_SIZE * CELL_SIZE + 20,
      y: constrainedY,
    });
    
    // Update state with exact position (no snapping)
    setPlacedShapes(prev => prev.map(shape => 
      shape.id === shapeId 
        ? { ...shape, x: constrainedX, y: constrainedY }
        : shape
    ));
  };

  // --- Snap-to-Grid Funktion ---
  const snap = (value) => Math.round(value / SNAP_STEP) * SNAP_STEP;

  const handleDragEnd = (e) => {
    const node = e.target;
    const id = node.id();
    
    // Allow shapes to move anywhere within the grid bounds
    const maxX = (GRID_SIZE - 1) * CELL_SIZE;
    const maxY = (GRID_SIZE - 1) * CELL_SIZE;
    
    // Constrain to grid bounds but allow movement to any cell
    const constrainedX = Math.max(0, Math.min(snap(node.x()), maxX));
    const constrainedY = Math.max(0, Math.min(snap(node.y()), maxY));
    
    node.position({
      x: constrainedX,
      y: constrainedY,
    });
    
    // Update the state to reflect the new position
    setTriangles(prev => prev.map(tri => 
      tri.id === id 
        ? { ...tri, x: constrainedX, y: constrainedY }
        : tri
    ));
  };

  const handleTransformEnd = (e) => {
    const node = e.target;
    const id = node.id();
    
    // Allow shapes to move anywhere within the grid bounds
    const maxX = (GRID_SIZE - 1) * CELL_SIZE;
    const maxY = (GRID_SIZE - 1) * CELL_SIZE;
    
    // Constrain to grid bounds but allow movement to any cell
    const constrainedX = Math.max(0, Math.min(snap(node.x()), maxX));
    const constrainedY = Math.max(0, Math.min(snap(node.y()), maxY));
    
    node.position({
      x: constrainedX,
      y: constrainedY,
    });
    
    // Snap rotation to 15-degree increments for better UX
    const rotation = node.rotation();
    const snappedRotation = Math.round(rotation / 15) * 15;
    node.rotation(snappedRotation);
    
    // Update the state to reflect the new position and rotation
    setTriangles(prev => prev.map(tri => 
      tri.id === id 
        ? { ...tri, x: constrainedX, y: constrainedY, rotation: snappedRotation }
        : tri
    ));
  };

  // --- Transformer aktualisieren ---
  useEffect(() => {
    const stage = stageRef.current;
    const transformer = trRef.current;
    if (!stage || !transformer) return;
    
    const nodes = selectedIds
      .map((id) => stage.findOne(`#${id}`))
      .filter(Boolean);
    
    if (nodes.length > 0) {
      transformer.nodes(nodes);
      transformer.getLayer()?.batchDraw();
    } else {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
    }
  }, [selectedIds]);

  // --- Rasterlinien zeichnen ---
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
            // Move all placed shapes back to left grid
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
        <button
          onClick={() => {
            console.log("=== GRID DEBUG INFO ===");
            console.log("Placed shapes:", placedShapes);
            console.log("Available cells:");
            for (let row = 0; row < GRID_SIZE; row++) {
              for (let col = 0; col < GRID_SIZE; col++) {
                const cellX = col * CELL_SIZE;
                const cellY = row * CELL_SIZE;
                const isOccupied = placedShapes.some(shape => 
                  Math.abs(shape.x - cellX) < CELL_SIZE && 
                  Math.abs(shape.y - cellY) < CELL_SIZE
                );
                console.log(`Cell (${row}, ${col}) at (${cellX}, ${cellY}) - ${isOccupied ? 'OCCUPIED' : 'FREE'}`);
              }
            }
          }}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
        >
          Debug Grid
        </button>
      </div>

      {/* Single Stage with both grids side by side */}
      <Stage
        ref={stageRef}
        width={GRID_SIZE * CELL_SIZE * 2 + 40} // Two grids + gap
        height={GRID_SIZE * CELL_SIZE}
        style={{ border: "1px solid #ccc", background: "#f7f7f7" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleDeselect}
      >
        {/* Background Layer - Both Grids */}
        <Layer>
          {/* Left Grid Background */}
          <Line
            points={[0, 0, GRID_SIZE * CELL_SIZE, 0, GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE, 0, GRID_SIZE * CELL_SIZE]}
            closed
            stroke="#ccc"
            strokeWidth={1}
            fill="#f7f7f7"
          />
          
          {/* Right Grid Background */}
          <Line
            points={[GRID_SIZE * CELL_SIZE + 20, 0, (GRID_SIZE * CELL_SIZE * 2) + 20, 0, (GRID_SIZE * CELL_SIZE * 2) + 20, GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE + 20, GRID_SIZE * CELL_SIZE]}
            closed
            stroke="#ccc"
            strokeWidth={1}
            fill="#f0f8ff"
          />

          {/* Left Grid Lines */}
          {gridLines.map((line, index) => (
            <Line
              key={`left-${index}`}
              {...line.props}
            />
          ))}

          {/* Right Grid Lines */}
          {gridLines.map((line, index) => (
            <Line
              key={`right-${index}`}
              {...line.props}
              points={line.props.points.map((point, i) => 
                i % 2 === 0 ? point + GRID_SIZE * CELL_SIZE + 20 : point
              )}
            />
          ))}

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

          {/* Green Prototype Shapes in Left Grid */}
          {triangles.map((tri) => (
            <Line
              key={`green-${tri.id}`}
              id={`green-${tri.id}`}
              points={tri.points}
              closed
              fill="#22c55e"
              stroke={selectedIds.includes(tri.id) ? "red" : "#444"}
              strokeWidth={selectedIds.includes(tri.id) ? 2 : 0.5}
              x={tri.x || 0}
              y={tri.y || 0}
              rotation={tri.rotation || 0}
              draggable
              onClick={(e) => handleSelect(tri.id, e)}
              onTap={(e) => handleSelect(tri.id, e)}
              onDragEnd={handleDragEnd}
              onTransformEnd={handleTransformEnd}
            />
          ))}

          {/* Right Grid Cells (clickable) */}
          {rightGridTriangles.map((tri) => {
            const cellRow = Math.floor(tri.points[1] / CELL_SIZE);
            const cellCol = Math.floor(tri.points[0] / CELL_SIZE);
            const cellX = cellCol * CELL_SIZE;
            const cellY = cellRow * CELL_SIZE;
            
            // Check if this cell is occupied
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
                fill={isOccupied ? "#ff6b6b" : tri.fill} // Red if occupied, original color if free
                stroke={isOccupied ? "#ff0000" : "#444"}
                strokeWidth={isOccupied ? 2 : 0.5}
                opacity={isOccupied ? 0.6 : 0.3}
                onClick={(e) => {
                  // Only handle clicks if no placed shapes are in this area
                  if (!isOccupied) {
                    handleMoveToRightGrid(tri.id, e);
                  }
                }}
                style={{ cursor: isOccupied ? 'not-allowed' : 'pointer' }}
                listening={!isOccupied} // Don't listen if occupied
                hitStrokeWidth={0}
              />
            );
          })}
        </Layer>

        {/* Surface Layer - Placed Shapes */}
        <Layer>
          {/* Placed Shapes - always on top */}
          {placedShapes.map((shape) => (
            <Line
              key={shape.id}
              id={shape.id}
              points={shape.points}
              closed
              fill={shape.fill}
              stroke="#ff0000"
              strokeWidth={3}
              x={shape.x + GRID_SIZE * CELL_SIZE + 20} // Offset for right grid
              y={shape.y}
              draggable
              onClick={(e) => {
                e.cancelBubble = true;
                e.evt.stopPropagation();
                console.log("Clicked placed shape:", shape.id);
                handleSelect(shape.id, e);
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                e.evt.stopPropagation();
                console.log("Tapped placed shape:", shape.id);
                handleSelect(shape.id, e);
              }}
              onMouseDown={(e) => {
                e.cancelBubble = true;
                e.evt.stopPropagation();
                console.log("Mouse down on placed shape:", shape.id);
              }}
              onDragStart={(e) => {
                e.cancelBubble = true;
                e.evt.stopPropagation();
                console.log("Drag start on placed shape:", shape.id);
                // Bring to front when dragging starts
                e.target.moveToTop();
                e.target.getStage().batchDraw();
              }}
              onDragEnd={(e) => {
                e.cancelBubble = true;
                e.evt.stopPropagation();
                console.log("Drag end on placed shape:", shape.id);
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
              stroke="blue"
              dash={[4, 4]}
              fill="rgba(0,0,255,0.1)"
            />
          )}

          {/* Transformer */}
          <Transformer ref={trRef} rotateEnabled={true} />
        </Layer>
      </Stage>
    </div>
  );
}
