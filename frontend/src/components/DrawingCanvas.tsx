import React, { useState, useRef, useEffect } from 'react';
import { getStroke } from 'perfect-freehand';

interface DrawingCanvasProps {
  onSave: (imageDataUrl: string) => void;
  onCancel: () => void;
}

export default function DrawingCanvas({ onSave, onCancel }: DrawingCanvasProps) {
  const [points, setPoints] = useState<number[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  function handlePointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const point = [e.nativeEvent.offsetX, e.nativeEvent.offsetY, e.pressure];
    setPoints([point]);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isDrawing) return;
    const point = [e.nativeEvent.offsetX, e.nativeEvent.offsetY, e.pressure];
    setPoints([...points, point]);
  }

  function handlePointerUp(e: React.PointerEvent) {
    setIsDrawing(false);
  }

  const stroke = getStroke(points, {
    size: 8,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  });

  const pathData = getSvgPathFromStroke(stroke);

  function getSvgPathFromStroke(stroke: number[][]) {
    if (!stroke.length) return '';

    const d = stroke.reduce(
      (acc, [x0, y0], i, arr) => {
        const [x1, y1] = arr[(i + 1) % arr.length];
        acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
        return acc;
      },
      ['M', ...stroke[0], 'Q']
    );

    d.push('Z');
    return d.join(' ');
  }

  const handleSave = () => {
    if (!svgRef.current) return;
    
    // Create a canvas to draw the SVG onto
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const svg = svgRef.current;
    
    // Get SVG data
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.onload = () => {
      canvas.width = 500; // Set desired width
      canvas.height = 500; // Set desired height
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        onSave(dataUrl);
        URL.revokeObjectURL(url);
      }
    };
    img.src = url;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg shadow-xl w-[550px]">
        <h3 className="text-lg font-semibold mb-2">Draw Signature / Sketch</h3>
        <div className="border border-gray-200 rounded mb-4 bg-white cursor-crosshair">
          <svg
            ref={svgRef}
            width={500}
            height={500}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{ touchAction: 'none' }}
          >
            {points.length > 0 && <path d={pathData} fill="black" />}
          </svg>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)]"
          >
            Insert Drawing
          </button>
        </div>
      </div>
    </div>
  );
}
