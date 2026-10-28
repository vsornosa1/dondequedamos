'use client';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { SplitText } from 'gsap/SplitText';

if (typeof window !== 'undefined') gsap.registerPlugin(useGSAP, DrawSVGPlugin, SplitText);

// Quien pide menos movimiento ve cada cosa directamente en su sitio.
export const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export { gsap, useGSAP, SplitText };
