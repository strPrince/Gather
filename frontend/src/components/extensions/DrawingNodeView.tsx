'use client';

import React, { useState, useEffect, useRef } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import InteractiveDrawing, { DrawingData, DrawingElement } from '../InteractiveDrawing';

export default function DrawingNodeView({ node, updateAttributes }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [drawingData, setDrawingData] = useState<DrawingData | null>(node.attrs.data);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render the drawing on canvas
  useEffect(() => {
    if (!drawingData || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = drawingData.width;
    canvas.height = drawingData.height;

    // Clear and fill background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all elements
    drawingData.elements.forEach(element => {
      drawElement(ctx, element);
    });
  }, [drawingData]);

  const drawElement = (ctx: CanvasRenderingContext2D, element: DrawingElement) => {
    ctx.strokeStyle = element.style.stroke;
    ctx.lineWidth = element.style.strokeWidth;
    ctx.fillStyle = element.style.fill || 'transparent';

    switch (element.type) {
      case 'path':
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        element.data.points.forEach((point: [number, number], i: number) => {
          if (i === 0) {
            ctx.moveTo(point[0], point[1]);
          } else {
            ctx.lineTo(point[0], point[1]);
          }
        });
        ctx.stroke();
        break;

      case 'rectangle':
        const { x, y, width, height } = element.data;
        ctx.strokeRect(x, y, width, height);
        if (element.style.fill) {
          ctx.fillRect(x, y, width, height);
        }
        break;

      case 'circle':
        const { cx, cy, radius } = element.data;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        ctx.stroke();
        if (element.style.fill) {
          ctx.fill();
        }
        break;

      case 'line':
      case 'arrow':
        const { x1, y1, x2, y2 } = element.data;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        
        if (element.type === 'arrow') {
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const headLength = 15;
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(
            x2 - headLength * Math.cos(angle - Math.PI / 6),
            y2 - headLength * Math.sin(angle - Math.PI / 6)
          );
          ctx.moveTo(x2, y2);
          ctx.lineTo(
            x2 - headLength * Math.cos(angle + Math.PI / 6),
            y2 - headLength * Math.sin(angle + Math.PI / 6)
          );
          ctx.stroke();
        }
        break;

      case 'text':
        ctx.font = `${element.data.fontSize || 16}px Arial`;
        ctx.fillStyle = element.style.stroke;
        ctx.fillText(element.data.text, element.data.x, element.data.y);
        break;
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = (data: DrawingData) => {
    setDrawingData(data);
    updateAttributes({ data });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm('Delete this drawing?')) {
      // Delete the node
      // This would need editor.chain().focus().deleteNode(this.name).run()
      // But we don't have direct access here, so we'll just clear it
      updateAttributes({ data: null });
    }
  };

  if (!drawingData) {
    return (
      <NodeViewWrapper className="drawing-node">
        <div className="border-2 border-dashed border-gray-400 rounded-lg p-4 my-4 bg-gray-50">
          <p className="text-gray-600 mb-3 text-center text-sm">Click to create a new drawing</p>
          <button
            onClick={handleEdit}
            className="w-full px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
          >
            ✏️ Create Drawing
          </button>
        </div>
      </NodeViewWrapper>
    );
  }

  if (isEditing) {
    return (
      <NodeViewWrapper className="drawing-node">
        <div className="border-2 border-[var(--accent)] rounded-lg p-4 my-4 bg-white shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">✏️ Editing Drawing</h3>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Save is handled by the InteractiveDrawing component
                }}
              className="px-3 py-1 text-sm bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
          <div className="inline-drawing-container">
            <InteractiveDrawing
              initialData={drawingData}
              onSave={handleSave}
              onCancel={handleCancel}
              editMode={true}
              inline={true}
            />
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="drawing-node">
      <div className="relative group my-4 border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
        <canvas
          ref={canvasRef}
          className="max-w-full h-auto block"
          style={{ cursor: 'pointer' }}
          onClick={handleEdit}
        />
        
        {/* Hover overlay with controls */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex gap-2">
            <button
              onClick={handleEdit}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm hover:bg-[var(--accent-hover)] shadow-lg transition-colors"
              title="Edit Drawing"
            >
              ✏️ Edit
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 shadow-lg transition-colors"
              title="Delete Drawing"
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
