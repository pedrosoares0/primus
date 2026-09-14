'use client';

import { Renderer, Program, Mesh, Color, Triangle } from 'ogl';
import { useEffect, useRef } from 'react';

import './Aurora.css';

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;
uniform float uLightMode;
uniform vec3 uBgColor;
uniform float uOpacity;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v){
  const vec4 C = vec4(
      0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
      0.5 - vec3(
          dot(x0, x0),
          dot(x12.xy, x12.xy),
          dot(x12.zw, x12.zw)
      ), 
      0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop {
  vec3 color;
  float position;
};

#define COLOR_RAMP(colors, factor, finalColor) {              \
  int index = 0;                                            \
  for (int i = 0; i < 2; i++) {                               \
     ColorStop currentColor = colors[i];                    \
     bool isInBetween = currentColor.position <= factor;    \
     index = int(mix(float(index), float(i), float(isInBetween))); \
  }                                                         \
  ColorStop currentColor = colors[index];                   \
  ColorStop nextColor = colors[index + 1];                  \
  float range = nextColor.position - currentColor.position; \
  float lerpFactor = (factor - currentColor.position) / range; \
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  
  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);
  
  vec3 rampColor;
  COLOR_RAMP(colors, uv.x, rampColor);
  
  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;
  
  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);
  
  // Transição translúcida e sedosa com a cor do background
  float factor = clamp(auroraAlpha * (0.20 + 0.80 * clamp(intensity, 0.0, 1.0)), 0.0, 1.0) * uOpacity;
  vec3 finalColor = mix(uBgColor, rampColor, factor);
  
  fragColor = vec4(finalColor, 1.0);
}
`;

export interface AuroraProps {
  colorStops?: [string, string, string] | string[];
  amplitude?: number;
  blend?: number;
  speed?: number;
  time?: number;
  lightMode?: boolean;
  opacity?: number;
  bgColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function Aurora(props: AuroraProps) {
  const {
    colorStops = ['#5227FF', '#7cff67', '#5227FF'],
    amplitude = 0.7,
    blend = 0.7,
    lightMode = false,
    opacity = 0.45,
    bgColor = '#F2F4F7',
    className,
    style,
  } = props;

  const propsRef = useRef(props);
  propsRef.current = props;

  const ctnDom = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ctn = ctnDom.current;
    if (!ctn) return;

    // Renderizador com perfil otimizado para economia de energia e baixo consumo de GPU
    const renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      powerPreference: 'low-power' as any,
      dpr: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 1.25),
    });
    const gl = renderer.gl;

    const bgCol = new Color(bgColor);
    gl.clearColor(bgCol.r, bgCol.g, bgCol.b, 1.0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.canvas.style.backgroundColor = 'transparent';

    let program: Program;

    function resize() {
      if (!ctn) return;
      const width = ctn.offsetWidth || 1;
      const height = ctn.offsetHeight || 1;
      renderer.setSize(width, height);
      if (program) {
        program.uniforms.uResolution.value = [width, height];
      }
    }
    window.addEventListener('resize', resize);

    const ro = new ResizeObserver(() => {
      resize();
    });
    ro.observe(ctn);

    const geometry = new Triangle(gl);
    if ((geometry.attributes as any)?.uv) {
      delete (geometry.attributes as any).uv;
    }

    const colorStopsArray = colorStops.map((hex) => {
      const c = new Color(hex);
      return [c.r, c.g, c.b];
    });

    const initialWidth = ctn.offsetWidth || 1;
    const initialHeight = ctn.offsetHeight || 1;
    renderer.setSize(initialWidth, initialHeight);

    program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: amplitude },
        uColorStops: { value: colorStopsArray },
        uResolution: { value: [initialWidth, initialHeight] },
        uBlend: { value: blend },
        uLightMode: { value: lightMode ? 1 : 0 },
        uBgColor: { value: [bgCol.r, bgCol.g, bgCol.b] },
        uOpacity: { value: opacity },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    ctn.appendChild(gl.canvas);

    let animateId = 0;
    const update = (t: number) => {
      animateId = requestAnimationFrame(update);
      const { time = t * 0.01, speed = 0.7 } = propsRef.current;
      program.uniforms.uTime.value = time * speed * 0.1;
      program.uniforms.uAmplitude.value = propsRef.current.amplitude ?? 0.7;
      program.uniforms.uBlend.value = propsRef.current.blend ?? 0.7;
      program.uniforms.uLightMode.value = (propsRef.current.lightMode ?? lightMode) ? 1 : 0;
      program.uniforms.uOpacity.value = propsRef.current.opacity ?? 0.45;
      
      const currentBg = propsRef.current.bgColor ?? bgColor;
      const curBgCol = new Color(currentBg);
      program.uniforms.uBgColor.value = [curBgCol.r, curBgCol.g, curBgCol.b];

      const stops = propsRef.current.colorStops ?? colorStops;
      program.uniforms.uColorStops.value = stops.map((hex) => {
        const c = new Color(hex);
        return [c.r, c.g, c.b];
      });
      renderer.render({ scene: mesh });
    };
    animateId = requestAnimationFrame(update);

    // Pausa a execução caso a aba do navegador seja minimizada ou fique em segundo plano
    function handleVisibilityChange() {
      if (document.hidden) {
        cancelAnimationFrame(animateId);
      } else {
        animateId = requestAnimationFrame(update);
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    resize();

    return () => {
      cancelAnimationFrame(animateId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      ro.disconnect();
      if (ctn && gl.canvas.parentNode === ctn) {
        ctn.removeChild(gl.canvas);
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amplitude, blend, lightMode, bgColor, opacity]);

  return <div ref={ctnDom} className={`aurora-container ${className || ''}`} style={style} />;
}
