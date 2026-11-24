'use client';

import React, { useRef, useState, useEffect } from 'react';

export interface DrawingElement {
  id: string;
  type: 'path' | 'rectangle' | 'circle' | 'line' | 'text' | 'arrow';
  data: any;
  style: {
    stroke: string;
    strokeWidth: number;
    fill?: string;
  };
}

export interface DrawingData {
  elements: DrawingElement[];
  width: number;
  height: number;
}

interface InteractiveDrawingProps {
  initialData?: DrawingData;
  onSave: (data: DrawingData) => void;
  onCancel: () => void;
  editMode?: boolean;
  inline?: boolean;
}

type Tool = 'select' | 'pen' | 'rectangle' | 'circle' | 'line' | 'text' | 'arrow' | 'eraser';

export default function InteractiveDrawing({ initialData, onSave, onCancel, editMode = false, inline = false }: InteractiveDrawingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [isDrawing, setIsDrawing] = useState(false);
  const [elements, setElements] = useState<DrawingElement[]>(initialData?.elements || []);
  const [currentPath, setCurrentPath] = useState<Array<[number, number]>>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [startPoint, setStartPoint] = useState<[number, number] | null>(null);
  const [canvasSize] = useState({ width: initialData?.width || 800, height: initialData?.height || 600 });

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all elements
    elements.forEach(element => {
      drawElement(ctx, element, element.id === selectedElement);
    });

    // Draw current path being drawn
    if (currentPath.length > 0 && tool === 'pen') {
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      currentPath.forEach((point, i) => {
        if (i === 0) {
          ctx.moveTo(point[0], point[1]);
        } else {
          ctx.lineTo(point[0], point[1]);
        }
      });
      ctx.stroke();
    }

    // Draw shape preview
    if (startPoint && currentPath.length > 0 && ['rectangle', 'circle', 'line', 'arrow'].includes(tool)) {
      const [x1, y1] = startPoint;
      const [x2, y2] = currentPath[currentPath.length - 1];
      
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      
      if (tool === 'rectangle') {
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      } else if (tool === 'circle') {
        const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        ctx.beginPath();
        ctx.arc(x1, y1, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (tool === 'line' || tool === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        
        // Draw arrowhead for arrow tool
        if (tool === 'arrow') {
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
      }
    }
  }, [elements, currentPath, selectedElement, color, strokeWidth, tool, startPoint]);

  const drawElement = (ctx: CanvasRenderingContext2D, element: DrawingElement, selected: boolean) => {
    ctx.strokeStyle = element.style.stroke;
    ctx.lineWidth = element.style.strokeWidth;
    ctx.fillStyle = element.style.fill || 'transparent';

    if (selected) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = element.style.strokeWidth + 2;
    }

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

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'select') {
      // Check if clicking on an element
      const clickedElement = findElementAtPoint(x, y);
      setSelectedElement(clickedElement?.id || null);
      return;
    }

    if (tool === 'eraser') {
      const elementToDelete = findElementAtPoint(x, y);
      if (elementToDelete) {
        setElements(elements.filter(el => el.id !== elementToDelete.id));
      }
      return;
    }

    setIsDrawing(true);
    setStartPoint([x, y]);
    setCurrentPath([[x, y]]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentPath([...currentPath, [x, y]]);
  };

  const handleMouseUp = () => {
    if (!isDrawing || !startPoint) return;

    const newElement: DrawingElement = {
      id: Date.now().toString(),
      type: tool as any,
      data: {},
      style: {
        stroke: color,
        strokeWidth: strokeWidth,
      }
    };

    if (tool === 'pen') {
      newElement.data = { points: currentPath };
    } else if (tool === 'rectangle') {
      const [x1, y1] = startPoint;
      const [x2, y2] = currentPath[currentPath.length - 1];
      newElement.data = { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
    } else if (tool === 'circle') {
      const [x1, y1] = startPoint;
      const [x2, y2] = currentPath[currentPath.length - 1];
      const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      newElement.data = { cx: x1, cy: y1, radius };
    } else if (tool === 'line' || tool === 'arrow') {
      const [x1, y1] = startPoint;
      const [x2, y2] = currentPath[currentPath.length - 1];
      newElement.data = { x1, y1, x2, y2 };
    }

    if (tool !== 'select' && tool !== 'eraser') {
      setElements([...elements, newElement]);
    }

    setIsDrawing(false);
    setCurrentPath([]);
    setStartPoint(null);
  };

  const findElementAtPoint = (x: number, y: number): DrawingElement | null => {
    // Check elements in reverse order (top to bottom)
    for (let i = elements.length - 1; i >= 0; i--) {
      const element = elements[i];
      
      if (element.type === 'path') {
        // Check if point is near any segment of the path
        for (let j = 0; j < element.data.points.length - 1; j++) {
          const [x1, y1] = element.data.points[j];
          const [x2, y2] = element.data.points[j + 1];
          const distance = distanceToSegment(x, y, x1, y1, x2, y2);
          if (distance < element.style.strokeWidth + 5) {
            return element;
          }
        }
      } else if (element.type === 'rectangle') {
        const { x: rx, y: ry, width, height } = element.data;
        if (x >= rx && x <= rx + width && y >= ry && y <= ry + height) {
          return element;
        }
      } else if (element.type === 'circle') {
        const { cx, cy, radius } = element.data;
        const distance = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2));
        if (Math.abs(distance - radius) < element.style.strokeWidth + 5) {
          return element;
        }
      }
    }
    return null;
  };

  const distanceToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.sqrt(Math.pow(px - projX, 2) + Math.pow(py - projY, 2));
  };

  const handleSave = () => {
    const drawingData: DrawingData = {
      elements,
      width: canvasSize.width,
      height: canvasSize.height,
    };
    onSave(drawingData);
  };

  const handleClear = () => {
    if (confirm('Clear all drawings?')) {
      setElements([]);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedElement) {
      setElements(elements.filter(el => el.id !== selectedElement));
      setSelectedElement(null);
    }
  };

  const buttonClass = (isActive: boolean) => 
    inline 
      ? `p-2 rounded ${isActive ? 'bg-[var(--accent)] text-white' : 'text-gray-700 hover:bg-gray-200'}`
      : `p-2 rounded ${isActive ? 'bg-[var(--accent)] text-white' : 'text-gray-400 hover:bg-gray-700'}`;
  
  const borderClass = inline ? 'border-gray-300' : 'border-gray-700';
  const textClass = inline ? 'text-gray-700' : 'text-gray-400';
  const bgClass = inline ? 'bg-gray-50' : 'bg-[var(--hybrid-canvas)]';

  return (
    <div className={inline ? "w-full" : "fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"}>
      <div className={inline ? "w-full" : "bg-[#1e293b] rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col"}>
        {/* Header */}
        {!inline && (
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">Interactive Drawing Editor</h2>
            <button onClick={onCancel} className="text-gray-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div className={`flex items-center gap-2 p-3 border-b ${borderClass} ${bgClass} overflow-x-auto flex-wrap`}>
          {/* Tools */}
          <div className={`flex items-center gap-1 pr-3 border-r ${borderClass}`}>
            <button onClick={() => setTool('select')} className={buttonClass(tool === 'select')} title="Select">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </button>
            <button onClick={() => setTool('pen')} className={buttonClass(tool === 'pen')} title="Pen">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button onClick={() => setTool('line')} className={buttonClass(tool === 'line')} title="Line">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19l14-14" />
              </svg>
            </button>
            <button onClick={() => setTool('arrow')} className={buttonClass(tool === 'arrow')} title="Arrow">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
            <button onClick={() => setTool('rectangle')} className={buttonClass(tool === 'rectangle')} title="Rectangle">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
              </svg>
            </button>
            <button onClick={() => setTool('circle')} className={buttonClass(tool === 'circle')} title="Circle">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
              </svg>
            </button>
            <button onClick={() => setTool('eraser')} className={buttonClass(tool === 'eraser')} title="Eraser">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          {/* Color */}
          <div className={`flex items-center gap-2 px-3 border-r ${borderClass}`}>
            <label className={`text-sm ${textClass}`}>Color:</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-8 rounded cursor-pointer" />
          </div>

          {/* Stroke Width */}
          <div className={`flex items-center gap-2 px-3 border-r ${borderClass}`}>
            <label className={`text-sm ${textClass}`}>Width:</label>
            <input type="range" min="1" max="20" value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} className="w-24" />
            <span className={`text-sm ${inline ? 'text-gray-700' : 'text-gray-300'} w-6`}>{strokeWidth}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-auto">
            {selectedElement && (
              <button onClick={handleDeleteSelected} className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded">
                Delete Selected
              </button>
            )}
            <button onClick={handleClear} className={`px-3 py-1.5 text-sm rounded ${inline ? 'bg-gray-300 hover:bg-gray-400 text-gray-800' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}>
              Clear All
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className={`flex-1 overflow-auto p-4 ${inline ? 'bg-gray-100' : 'bg-[var(--hybrid-canvas)]'}`}>
          <div className="inline-block bg-white rounded shadow-lg" style={{ position: 'relative' }}>
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="cursor-crosshair"
              style={{ display: 'block' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between p-4 border-t ${borderClass}`}>
          <div className={`text-sm ${textClass}`}>
            {elements.length} element{elements.length !== 1 ? 's' : ''} • {tool.charAt(0).toUpperCase() + tool.slice(1)} tool
          </div>
          <div className="flex gap-2">
            <button onClick={onCancel} className={`px-4 py-2 text-sm rounded ${inline ? 'bg-gray-300 hover:bg-gray-400 text-gray-800' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}>
              Cancel
            </button>
        <button onClick={handleSave} className="px-4 py-2 text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded">
              {inline ? 'Save Drawing' : 'Insert Drawing'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
