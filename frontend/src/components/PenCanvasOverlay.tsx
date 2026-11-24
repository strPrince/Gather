'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { DrawingData, DrawingElement } from './InteractiveDrawing';

interface PenCanvasOverlayProps {
  onSave: (data: DrawingData) => void;
  onCancel: () => void;
}

type Point = [number, number];

export default function PenCanvasOverlay({ onSave, onCancel }: PenCanvasOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const pointsRef = useRef<Point[]>([]);
  const [elements, setElements] = useState<DrawingElement[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeVersion, setStrokeVersion] = useState(0);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const host = hostRef.current?.parentElement;
    if (!host) return;
    const syncSize = () => {
      const rect = host.getBoundingClientRect();
      setSize({ width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)) });
    };
    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.width || !size.height) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = size.width * ratio;
    canvas.height = size.height * ratio;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    context.strokeStyle = '#1a3c2b';
    context.lineWidth = 2.5;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    elements.forEach((element) => {
      if (element.type !== 'path') return;
      const path = element.data.points as Point[];
      if (!path.length) return;
      context.beginPath();
      path.forEach(([x, y], index) => index === 0 ? context.moveTo(x, y) : context.lineTo(x, y));
      context.stroke();
    });
    if (pointsRef.current.length) {
      context.beginPath();
      pointsRef.current.forEach(([x, y], index) => index === 0 ? context.moveTo(x, y) : context.lineTo(x, y));
      context.stroke();
    }
  }, [elements, size, isDrawing, strokeVersion]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };

  const beginStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointsRef.current = [getPoint(event)];
    setIsDrawing(true);
  };

  const extendStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    pointsRef.current = [...pointsRef.current, getPoint(event)];
    setStrokeVersion((version) => version + 1);
  };

  const finishStroke = () => {
    if (!isDrawing || !pointsRef.current.length) return;
    const element: DrawingElement = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'path',
      data: { points: pointsRef.current },
      style: { stroke: '#1a3c2b', strokeWidth: 2.5 },
    };
    pointsRef.current = [];
    setElements((current) => [...current, element]);
    setIsDrawing(false);
  };

  return (
    <div ref={hostRef} className="pen-canvas-overlay" aria-label="Drawing canvas">
      <canvas
        ref={canvasRef}
        onPointerDown={beginStroke}
        onPointerMove={extendStroke}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      />
      <div className="pen-canvas-toolbar" role="status">
        <span><i />Drawing mode</span>
        <button type="button" onClick={() => setElements([])} disabled={!elements.length}>Clear</button>
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="button" className="is-primary" onClick={() => elements.length ? onSave({ elements, width: size.width, height: size.height }) : onCancel()}>Done</button>
      </div>
    </div>
  );
}
