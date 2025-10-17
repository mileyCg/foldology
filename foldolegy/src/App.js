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
  }, []);

  // --- Klickauswahl ---
  const handleSelect = (id, e) => {
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
    const { x, y } = e.target.getStage().getPointerPosition();
    setSelectionRect({ x, y, width: 0, height: 0 });
    setIsSelecting(true);
  };

  // --- Auswahlrechteck Bewegung ---
  const handleMouseMove = (e) => {
    if (!isSelecting || !selectionRect) return;
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
  const handleMouseUp = () => {
    if (!isSelecting) return;
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

  // --- Shapes in zweites Raster platzieren ---
  const handlePlaceInSecondArea = () => {
    if (selectedIds.length === 0) return;
    const selectedShapes = triangles.filter((t) => selectedIds.includes(t.id));
    const newPlacedShapes = selectedShapes.map((shape, index) => ({
      ...shape,
      id: `placed-${Date.now()}-${index}`,
      x: (index % 5) * CELL_SIZE,
      y: Math.floor(index / 5) * CELL_SIZE,
    }));
    setPlacedShapes([...placedShapes, ...newPlacedShapes]);
    setSelectedIds([]);
  };

  // --- Snap-to-Grid Funktion ---
  const snap = (value) => Math.round(value / SNAP_STEP) * SNAP_STEP;

  const handleDragEnd = (e) => {
    const node = e.target;
    node.position({
      x: snap(node.x()),
      y: snap(node.y()),
    });
  };

  const handleTransformEnd = (e) => {
    const node = e.target;
    node.position({
      x: snap(node.x()),
      y: snap(node.y()),
    });
    // Snap rotation to 15-degree increments for better UX
    const rotation = node.rotation();
    const snappedRotation = Math.round(rotation / 15) * 15;
    node.rotation(snappedRotation);
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
          onClick={handlePlaceInSecondArea}
          disabled={selectedIds.length === 0}
          className={`px-3 py-1 rounded text-white ${
            selectedIds.length === 0
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          In 2. Raster platzieren ({selectedIds.length})
        </button>
        <button
          onClick={() => setSelectedIds([])}
          className="bg-gray-500 text-white px-3 py-1 rounded"
        >
          Auswahl aufheben
        </button>
        <button
          onClick={() => setPlacedShapes([])}
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
        >
          2. Raster leeren
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', gap: '20px', justifyContent: 'center', alignItems: 'flex-start', flexWrap: 'nowrap', border: '2px solid red', padding: '10px' }}>
        {/* Erstes Raster */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '500px', border: '2px solid blue', padding: '10px' }}>
          <h3 className="text-lg font-semibold mb-2">Original Raster</h3>
          <Stage
            ref={stageRef}
            width={GRID_SIZE * CELL_SIZE}
            height={GRID_SIZE * CELL_SIZE}
            style={{ border: "1px solid #ccc", background: "#f7f7f7" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={handleDeselect}
          >
            <Layer>
              {/* --- Rasterlinien --- */}
              {gridLines}

              {/* --- Dreiecke --- */}
              {triangles.map((tri) => (
                <Line
                  key={tri.id}
                  id={tri.id}
                  points={tri.points}
                  closed
                  fill={tri.fill}
                  stroke={selectedIds.includes(tri.id) ? "red" : "#444"}
                  strokeWidth={selectedIds.includes(tri.id) ? 2 : 0.5}
                  draggable
                  onClick={(e) => handleSelect(tri.id, e)}
                  onTap={(e) => handleSelect(tri.id, e)}
                  onDragEnd={handleDragEnd}
                  onTransformEnd={handleTransformEnd}
                />
              ))}

              {/* --- Gruppen --- */}
              {groups.map((group) => (
                <Group
                  key={group.id}
                  id={group.id}
                  draggable
                  onClick={(e) => handleSelect(group.id, e)}
                  onTap={(e) => handleSelect(group.id, e)}
                  onDragEnd={handleDragEnd}
                  onTransformEnd={handleTransformEnd}
                >
                  {group.shapes.map((s) => (
                    <Line
                      key={s.id}
                      points={s.points}
                      closed
                      fill={s.fill}
                      stroke="#444"
                      strokeWidth={0.5}
                    />
                  ))}
                </Group>
              ))}

              {/* --- Auswahlrechteck --- */}
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

              {/* --- Transformer --- */}
              <Transformer ref={trRef} rotateEnabled={true} />
            </Layer>
          </Stage>
        </div>

        {/* Zweites Raster */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '500px', border: '2px solid green', padding: '10px' }}>
          <h3 className="text-lg font-semibold mb-2">Platzierte Shapes</h3>
          <Stage
            ref={secondStageRef}
            width={GRID_SIZE * CELL_SIZE}
            height={GRID_SIZE * CELL_SIZE}
            style={{ border: "1px solid #ccc", background: "#f0f8ff" }}
          >
            <Layer>
              {/* --- Rasterlinien für zweites Raster --- */}
              {gridLines}

              {/* --- Platzierte Shapes --- */}
              {placedShapes.map((shape) => (
                <Line
                  key={shape.id}
                  id={shape.id}
                  points={shape.points}
                  closed
                  fill={shape.fill}
                  stroke="#444"
                  strokeWidth={0.5}
                  x={shape.x}
                  y={shape.y}
                  draggable
                  onDragEnd={handleDragEnd}
                  onTransformEnd={handleTransformEnd}
                />
              ))}
            </Layer>
          </Stage>
        </div>
      </div>
    </div>
  );
}
