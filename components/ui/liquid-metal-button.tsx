'use client'

import { liquidMetalFragmentShader, ShaderMount } from "@paper-design/shaders";
import { Sparkles } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";

export interface LiquidMetalButtonProps {
  label?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  viewMode?: "text" | "icon";
  className?: string;
  disabled?: boolean;
  carregando?: boolean;
  type?: "button" | "submit" | "reset";
  icon?: React.ReactNode;
  icone?: React.ReactNode;
  larguraTotal?: boolean;
  fullWidth?: boolean;
  tamanho?: "sm" | "md" | "lg";
  gradient?: string;
  corTexto?: string;
}

export function LiquidMetalButton({
  label,
  children,
  onClick,
  viewMode = "text",
  className = "",
  disabled = false,
  carregando = false,
  type = "button",
  icon,
  icone,
  larguraTotal = false,
  fullWidth = false,
  tamanho = "md",
  gradient = "linear-gradient(180deg, #1FBBA4 0%, #17A592 50%, #0E7567 100%)",
  corTexto = "#EFF7F2",
}: LiquidMetalButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [ripples, setRipples] = useState<
    Array<{ x: number; y: number; id: number }>
  >([]);
  const shaderRef = useRef<HTMLDivElement>(null);
  // biome-ignore lint/suspicious/noExplicitAny: External library without types
  const shaderMount = useRef<any>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rippleId = useRef(0);

  const isFull = larguraTotal || fullWidth;
  const iconeFinal = icone || icon;
  const textoFinal = children || label || "Ação";

  const altura = tamanho === "sm" ? 40 : tamanho === "lg" ? 52 : 46;
  const alturaInner = altura - 4;

  const [containerWidth, setContainerWidth] = useState<number>(() => {
    if (viewMode === "icon") return altura;
    if (isFull) return 320;
    return tamanho === "sm" ? 130 : tamanho === "lg" ? 180 : 154;
  });

  useEffect(() => {
    if (viewMode === "icon") {
      setContainerWidth(altura);
      return;
    }
    if (!isFull) {
      setContainerWidth(tamanho === "sm" ? 130 : tamanho === "lg" ? 180 : 154);
      return;
    }

    const updateWidth = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        if (w > 0) setContainerWidth(w);
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [isFull, viewMode, tamanho, altura]);

  useEffect(() => {
    const styleId = "shader-canvas-style-clean-blue";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .shader-container-clean-blue canvas {
          width: 100% !important;
          height: 100% !important;
          display: block !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          border-radius: 100px !important;
        }
        @keyframes ripple-animation-clean-blue {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) scale(4);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    const loadShader = async () => {
      try {
        if (shaderRef.current && typeof window !== "undefined") {
          if (shaderMount.current?.dispose) {
            shaderMount.current.dispose();
          }

          shaderMount.current = new ShaderMount(
            shaderRef.current,
            liquidMetalFragmentShader,
            {
              u_repetition: 2.8,
              u_softness: 0.5,
              u_shiftRed: 0.1,
              u_shiftBlue: 0.6, // Metal líquido com reflexo esmeralda/teal
              u_distortion: 0.03,
              u_contour: 0.15,
              u_angle: 45,
              u_scale: 7.5,
              u_shape: 0, // 0 = Full Fill em todo o canvas/botão
              u_offsetX: 0.0,
              u_offsetY: 0.0,
            },
            undefined,
            0.6,
          );
        }
      } catch (error) {
        console.error("[LiquidMetalButton] Failed to load shader:", error);
      }
    };

    loadShader();

    return () => {
      if (shaderMount.current?.dispose) {
        shaderMount.current.dispose();
        shaderMount.current = null;
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (disabled || carregando) return;
    setIsHovered(true);
    shaderMount.current?.setSpeed?.(1.1);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsPressed(false);
    shaderMount.current?.setSpeed?.(0.6);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || carregando) return;

    if (shaderMount.current?.setSpeed) {
      shaderMount.current.setSpeed(2.4);
      setTimeout(() => {
        if (isHovered) {
          shaderMount.current?.setSpeed?.(1.1);
        } else {
          shaderMount.current?.setSpeed?.(0.6);
        }
      }, 300);
    }

    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const ripple = { x, y, id: rippleId.current++ };

      setRipples((prev) => [...prev, ripple]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== ripple.id));
      }, 600);
    }

    onClick?.();
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block select-none ${isFull ? "w-full flex" : ""} ${className}`}
      style={{ width: isFull ? "100%" : `${containerWidth}px` }}
    >
      <div
        style={{
          perspective: "1000px",
          perspectiveOrigin: "50% 50%",
          width: "100%",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: `${altura}px`,
            transformStyle: "preserve-3d",
            transition:
              "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.4s ease",
            transform: "none",
          }}
        >
          {/* Camada Frontal: Texto / Ícone / Spinner com Contraste Branco Cristal */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${altura}px`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transformStyle: "preserve-3d",
              transition:
                "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.4s ease, gap 0.4s ease",
              transform: "translateZ(20px)",
              zIndex: 30,
              pointerEvents: "none",
            }}
          >
            {carregando ? (
              <div className="flex items-center justify-center gap-2" style={{ color: corTexto }}>
                <svg className="animate-spin h-4 w-4" style={{ color: corTexto }} viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-xs font-bold tracking-wide" style={{ color: corTexto }}>Carregando...</span>
              </div>
            ) : viewMode === "icon" ? (
              iconeFinal || (
                <Sparkles
                  size={18}
                  style={{
                    color: corTexto,
                    filter: "drop-shadow(0px 1px 2px rgba(13, 100, 88, 0.45))",
                    transition: "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    transform: "scale(1)",
                  }}
                />
              )
            ) : (
              <div className="flex items-center justify-center gap-2 px-3">
                {iconeFinal && (
                  <span className="shrink-0 drop-shadow-[0_1px_2px_rgba(13,100,88,0.45)]" style={{ color: corTexto }}>
                    {iconeFinal}
                  </span>
                )}
                <span
                  style={{
                    fontSize: tamanho === "sm" ? "12px" : tamanho === "lg" ? "15px" : "13.5px",
                    color: corTexto,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    textShadow: "0px 1px 2px rgba(13, 100, 88, 0.35)",
                    transition: "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    transform: "scale(1)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {textoFinal}
                </span>
              </div>
            )}
          </div>

          {/* Camada Intermediária: Azul Claro e Vibrante (Apple Clean Cyan/Cobalt) */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${altura}px`,
              transformStyle: "preserve-3d",
              transition:
                "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.4s ease",
              transform: `translateZ(10px) ${isPressed ? "translateY(1px) scale(0.98)" : "translateY(0) scale(1)"}`,
              zIndex: 20,
            }}
          >
            <div
              style={{
                width: "calc(100% - 4px)",
                height: `${alturaInner}px`,
                margin: "2px auto",
                borderRadius: "100px",
                background: gradient,
                border: "1.5px solid rgba(255, 255, 255, 0.65)",
                boxShadow: isPressed
                  ? "inset 0px 2px 4px rgba(13, 100, 88, 0.4), inset 0px 1px 2px rgba(0, 0, 0, 0.2)"
                  : "inset 0px 1px 2px rgba(255, 255, 255, 0.7), 0px 2px 10px rgba(23, 165, 146, 0.35)",
                transition:
                  "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.4s ease, box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </div>

          {/* Camada Inferior: Moldura com Sombra Suave e Shader Líquido */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${altura}px`,
              transformStyle: "preserve-3d",
              transition:
                "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.4s ease",
              transform: `translateZ(0px) ${isPressed ? "translateY(1px) scale(0.98)" : "translateY(0) scale(1)"}`,
              zIndex: 10,
            }}
          >
            <div
              style={{
                height: `${altura}px`,
                width: "100%",
                borderRadius: "100px",
                boxShadow: isPressed
                  ? "0px 0px 0px 1px rgba(23, 165, 146, 0.6), 0px 2px 4px 0px rgba(23, 165, 146, 0.2)"
                  : isHovered
                    ? "0px 0px 0px 1px rgba(70, 217, 170, 0.7), 0px 10px 24px 0px rgba(23, 165, 146, 0.38), 0px 4px 8px 0px rgba(70, 217, 170, 0.25)"
                    : "0px 0px 0px 1px rgba(23, 165, 146, 0.4), 0px 8px 20px 0px rgba(23, 165, 146, 0.25), 0px 2px 6px 0px rgba(70, 217, 170, 0.15)",
                transition:
                  "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.4s ease, box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                background: "transparent",
              }}
            >
              <div
                ref={shaderRef}
                className="shader-container-clean-blue"
                style={{
                  borderRadius: "100px",
                  overflow: "hidden",
                  position: "relative",
                  width: "100%",
                  height: `${altura}px`,
                  transition: "height 0.4s ease",
                }}
              />
            </div>
          </div>

          {/* Botão Interativo Nativo */}
          <button
            ref={buttonRef}
            type={type}
            disabled={disabled || carregando}
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseDown={() => setIsPressed(true)}
            onMouseUp={() => setIsPressed(false)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${altura}px`,
              background: "transparent",
              border: "none",
              cursor: disabled || carregando ? "not-allowed" : "pointer",
              outline: "none",
              zIndex: 40,
              transformStyle: "preserve-3d",
              transform: "translateZ(25px)",
              transition:
                "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.4s ease",
              overflow: "hidden",
              borderRadius: "100px",
              opacity: disabled ? 0.5 : 1,
            }}
            aria-label={typeof textoFinal === "string" ? textoFinal : "Botão"}
          >
            {ripples.map((ripple) => (
              <span
                key={ripple.id}
                style={{
                  position: "absolute",
                  left: `${ripple.x}px`,
                  top: `${ripple.y}px`,
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, rgba(195, 255, 231, 0) 70%)",
                  pointerEvents: "none",
                  animation: "ripple-animation-clean-blue 0.6s ease-out",
                }}
              />
            ))}
          </button>
        </div>
      </div>
    </div>
  );
}
