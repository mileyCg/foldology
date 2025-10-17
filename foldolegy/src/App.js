import React, { useState, useRef, useEffect } from "react";
import { Stage, Layer, Line, Transformer } from "react-konva";

const GRID_SIZE = 5;
const CELL_SIZE = 100; // etwas größer für Sichtbarkeit

export default function App() {
  const [triangles, setTriangles] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionRect, setSelectionRect] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const stageRef = useRef();
  const trRef = useRef();

  // Bei Start: alle Dreiecke des Gitters erzeugen
  useEffect(() => {
    const tris = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const x = col * CELL_SIZE;
        const y = row * CELL_SIZE;
        const half = CELL_SIZE / 2;

        // Mittelpunkt
        const cx = x + half;
        const cy = y + half;

        // vier Dreiecke pro Box
        tris.push({
          id: `t-${row}-${col}-tl`,
          points: [x, y, cx, cy, x + CELL_SIZE, y],
          fill: "#9ae6b4",
          x: 0,
          y: 0,
          rotation: 0,
        });
        tris.push({
          id: `t-${row}-${col}-tr`,
          points: [x + CELL_SIZE, y, cx, cy, x + CELL_SIZE, y + CELL_SIZE],
          fill: "#68d391",
          x: 0,
          y: 0,
          rotation: 0,
        });
        tris.push({
          id: `t-${row}-${col}-br`,
          points: [x + CELL_SIZE, y + CELL_SIZE, cx, cy, x, y + CELL_SIZE],
          fill: "#48bb78",
          x: 0,
          y: 0,
          rotation: 0,
        });
        tris.push({
          id: `t-${row}-${col}-bl`,
          points: [x, y + CELL_SIZE, cx, cy, x, y],
          fill: "#38a169",
          x: 0,
          y: 0,
          rotation: 0,
        });
      }
    }
    setTriangles(tris);
  }, []);

  // Auswahl per Klick
  const handleSelect = (id, e) => {
    const isShift = e.evt.shiftKey;
    if (isShift) {
      if (selectedIds.includes(id)) {
        setSelectedIds(selectedIds.filter((sid) => sid !== id));
      } else {
        setSelectedIds([...selectedIds, id]);
      }
    } else {
      setSelectedIds([id]);
    }
  };

  // Rechteck-Auswahl Start
  const handleMouseDown = (e) => {
    if (e.target !== e.target.getStage()) return;
    const { x, y } = e.target.getStage().getPointerPosition();
    setSelectionRect({ x, y, width: 0, height: 0 });
    setIsSelecting(true);
  };

  // Rechteck-Auswahl Bewegung
  const handleMouseMove = (e) => {
    if (!isSelecting || !selectionRect) return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    const newRect = {
      x: Math.min(point.x, selectionRect.x),
      y: Math.min(point.y, selectionRect.y),
      width: Math.abs(point.x - selectionRect.x),
      height: Math.abs(point.y - selectionRect.y),
    };
    setSelectionRect(newRect);
  };

  // Rechteck-Auswahl Ende
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

  // Deselect durch Klick ins Leere
  const handleDeselect = (e) => {
    if (e.target === e.target.getStage() && !isSelecting) {
      setSelectedIds([]);
    }
  };

  // Transformer aktualisieren
  useEffect(() => {
    const stage = stageRef.current;
    const transformer = trRef.current;
    const nodes = selectedIds
      .map((id) => stage.findOne(`#${id}`))
      .filter(Boolean);
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds]);

  return (
    <div className="flex flex-col items-center p-4">
      <h1 className="text-xl font-bold mb-2">
        Foldolegy – Diagonalraster (5×5 Boxen / 4 Dreiecke)
      </h1>
      <p className="text-sm mb-2 text-gray-600">
        Shift + Klick für Mehrfachauswahl, Maus ziehen für Rechteck-Auswahl
      </p>

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
          {triangles.map((tri) => (
            <Line
              key={tri.id}
              id={tri.id}
              points={tri.points}
              closed
              fill={tri.fill}
              stroke="#444"
              strokeWidth={0.5}
              draggable
              onClick={(e) => handleSelect(tri.id, e)}
              onTap={(e) => handleSelect(tri.id, e)}
            />
          ))}

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

          <Transformer
            ref={trRef}
            rotateEnabled={true}
            enabledAnchors={[
              "top-left",
              "top-right",
              "bottom-left",
              "bottom-right",
            ]}
          />
        </Layer>
      </Stage>
    </div>
  );
}
