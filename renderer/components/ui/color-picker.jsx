'use client';
import { cn } from '@/lib/utils';
import { Label } from './label';
import { Input } from './input';
import { Button } from './button';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
// Convert hex to HSV
function hexToHSV(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    let h = 0;
    let s = max === 0 ? 0 : diff / max;
    let v = max;
    if (diff !== 0) {
        if (max === r) {
            h = ((g - b) / diff + (g < b ? 6 : 0)) / 6;
        }
        else if (max === g) {
            h = ((b - r) / diff + 2) / 6;
        }
        else {
            h = ((r - g) / diff + 4) / 6;
        }
    }
    return { h: h * 360, s: s * 100, v: v * 100 };
}
// Convert HSV to hex
function hsvToHex(h, s, v) {
    h = h / 360;
    s = s / 100;
    v = v / 100;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    let r = 0, g = 0, b = 0;
    switch (i % 6) {
        case 0:
            r = v;
            g = t;
            b = p;
            break;
        case 1:
            r = q;
            g = v;
            b = p;
            break;
        case 2:
            r = p;
            g = v;
            b = t;
            break;
        case 3:
            r = p;
            g = q;
            b = v;
            break;
        case 4:
            r = t;
            g = p;
            b = v;
            break;
        case 5:
            r = v;
            g = p;
            b = q;
            break;
    }
    const toHex = (n) => {
        const hex = Math.round(n * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}
export function ColorPicker({ value, onChange, label, className }) {
    const [hue, setHue] = useState(0);
    const [saturation, setSaturation] = useState(100);
    const [brightness, setBrightness] = useState(100);
    const [hexInput, setHexInput] = useState(value || '#FF0000');
    const saturationRef = useRef(null);
    const hueRef = useRef(null);
    const onChangeRef = useRef(onChange);
    const [isDraggingSaturation, setIsDraggingSaturation] = useState(false);
    const [isDraggingHue, setIsDraggingHue] = useState(false);
    // Keep onChange ref up to date
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);
    // Initialize from value prop only once
    useEffect(() => {
        if (value && value.startsWith('#')) {
            const hsv = hexToHSV(value);
            setHue(hsv.h);
            setSaturation(hsv.s);
            setBrightness(hsv.v);
            setHexInput(value);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run on mount
    // Update hex input display when HSV changes (but don't call onChange here)
    useEffect(() => {
        const newHex = hsvToHex(hue, saturation, brightness);
        setHexInput(newHex);
    }, [hue, saturation, brightness]);
    const handleSaturationMouseDown = (e) => {
        setIsDraggingSaturation(true);
        handleSaturationMove(e);
    };
    const handleSaturationMove = (e) => {
        if (!saturationRef.current)
            return;
        const rect = saturationRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
        const newSaturation = (x / rect.width) * 100;
        const newBrightness = 100 - (y / rect.height) * 100;
        setSaturation(newSaturation);
        setBrightness(newBrightness);
    };
    const handleHueMouseDown = (e) => {
        setIsDraggingHue(true);
        handleHueMove(e);
    };
    const handleHueMove = (e) => {
        if (!hueRef.current)
            return;
        const rect = hueRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const newHue = (x / rect.width) * 360;
        setHue(newHue);
    };
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDraggingSaturation) {
                handleSaturationMove(e);
            }
            if (isDraggingHue) {
                handleHueMove(e);
            }
        };
        const handleMouseUp = () => {
            // Call onChange when user finishes dragging
            if (isDraggingSaturation || isDraggingHue) {
                const finalColor = hsvToHex(hue, saturation, brightness);
                onChangeRef.current(finalColor);
            }
            setIsDraggingSaturation(false);
            setIsDraggingHue(false);
        };
        if (isDraggingSaturation || isDraggingHue) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDraggingSaturation, isDraggingHue, hue, saturation, brightness]);
    const handleHexChange = (e) => {
        let input = e.target.value.toUpperCase();
        // Auto-add # if missing
        if (!input.startsWith('#')) {
            input = '#' + input;
        }
        setHexInput(input);
        // Validate and apply if valid hex
        if (/^#[0-9A-F]{6}$/i.test(input)) {
            const hsv = hexToHSV(input);
            setHue(hsv.h);
            setSaturation(hsv.s);
            setBrightness(hsv.v);
            onChangeRef.current(input);
        }
    };
    const currentColor = hsvToHex(hue, saturation, brightness);
    const hueColor = hsvToHex(hue, 100, 100);
    return (<div className={cn('space-y-3', className)}>
      {label && <Label>{label}</Label>}

      {/* No color option */}
      <div className='flex items-center justify-between gap-2 pb-3 border-b'>
        <Button type='button' variant='outline' size='sm' onClick={() => onChange(undefined)} className='flex-1'>
          <X className='h-4 w-4 mr-2'/>
          No Color
        </Button>
      </div>

      {/* Saturation/Brightness picker */}
      <div ref={saturationRef} className='relative w-full h-48 rounded-lg cursor-crosshair overflow-hidden' style={{
            background: `linear-gradient(to top, #000, transparent),
                       linear-gradient(to right, #fff, ${hueColor})`,
        }} onMouseDown={handleSaturationMouseDown}>
        {/* Picker circle */}
        <div className='absolute w-5 h-5 border-2 border-white rounded-full shadow-lg pointer-events-none' style={{
            left: `${saturation}%`,
            top: `${100 - brightness}%`,
            transform: 'translate(-50%, -50%)',
        }}/>
      </div>

      {/* Hue slider */}
      <div className='space-y-1'>
        <div ref={hueRef} className='relative w-full h-4 rounded-lg cursor-pointer' style={{
            background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
        }} onMouseDown={handleHueMouseDown}>
          {/* Hue slider handle */}
          <div className='absolute w-5 h-5 border-2 border-white rounded-full shadow-lg pointer-events-none' style={{
            left: `${(hue / 360) * 100}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: hueColor,
        }}/>
        </div>
      </div>

      {/* Hex input and preview */}
      <div className='flex items-center gap-3'>
        <div className='w-12 h-12 rounded-lg border-2 border-gray-300 flex-shrink-0' style={{ backgroundColor: currentColor }}/>
        <div className='flex-1'>
          <Label htmlFor='hex-input' className='text-xs text-gray-500 mb-1'>HEX</Label>
          <Input id='hex-input' type='text' value={hexInput} onChange={handleHexChange} placeholder='#000000' maxLength={7} className='font-mono uppercase'/>
        </div>
      </div>
    </div>);
}
