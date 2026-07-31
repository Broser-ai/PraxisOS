"use client";

// PulsingDot · 8px klinisk voice-status indicator.
// Kontrakt: HUMANIZED-FRONTIER-BLUEPRINT §2.7 (Corti-inspired UX)
//
// Design-principle: den ENESTE UI vi viser under konsultation. Zero chat,
// zero buttons, zero text. Praktikerens fokus er patienten, ikke skærmen.

import * as React from "react";
import type { VoiceSessionStatus } from "@/lib/voice/types";

export type PulsingDotProps = {
  status: VoiceSessionStatus;
  /** Optional ARIA-label — default oversat til status */
  ariaLabel?: string;
  /** Size in pixels · default 8 */
  size?: number;
  /**
   * Pause-word som praktikeren siger for at pause capture. Rendes som
   * visuelt-skjult beskrivelse (sr-only) via aria-describedby, så screen-
   * readers annoncerer instruktionen sammen med status. Default: "pause praxis".
   */
  pauseWord?: string;
};

const STATUS_COLOR: Record<VoiceSessionStatus, string> = {
  idle: "#4a4a52",              // neutral grey
  consent_requested: "#f4a53c",  // amber · awaiting user ack
  consent_recorded: "#4ce0c8",   // teal · ready to start
  listening: "#3ec46f",          // green · actively capturing
  thinking: "#4c9dff",           // blue · LLM inflight
  paused: "#a0a0a8",             // muted grey
  ended: "#6b6b74",              // dim grey
  error: "#ff5a45",              // red · surface error
};

const STATUS_LABEL_DA: Record<VoiceSessionStatus, string> = {
  idle: "Klar",
  consent_requested: "Afventer samtykke",
  consent_recorded: "Samtykke registreret",
  listening: "Lytter",
  thinking: "Tænker",
  paused: "Pauseret",
  ended: "Afsluttet",
  error: "Fejl",
};

const PULSE_STATES: Set<VoiceSessionStatus> = new Set(["listening", "thinking"]);

export function PulsingDot(props: PulsingDotProps): React.ReactElement {
  const size = props.size ?? 8;
  const color = STATUS_COLOR[props.status];
  const isPulsing = PULSE_STATES.has(props.status);
  const label = props.ariaLabel ?? `Voice-status: ${STATUS_LABEL_DA[props.status]}`;
  const pauseWord = props.pauseWord ?? "pause praxis";
  const descId = React.useId();
  const description = `Sig “${pauseWord}” for at pause capture.`;

  return (
    <span
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={label}
      aria-describedby={descId}
      style={{
        display: "inline-block",
        position: "relative",
        width: size,
        height: size,
      }}
    >
      {/* sr-only pause-word instruktion · screen-reader annoncerer sammen med status */}
      <span
        id={descId}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {description}
      </span>
      {isPulsing && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: size,
            height: size,
            borderRadius: "50%",
            background: color,
            opacity: 0.35,
            transformOrigin: "center",
            animation: "praxisos-pulsing-dot 1.6s ease-out infinite",
          }}
        />
      )}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 ${size * 0.75}px ${color}55`,
        }}
      />
      <style>{`
        @keyframes praxisos-pulsing-dot {
          0%   { transform: scale(1);   opacity: 0.4; }
          70%  { transform: scale(2.4); opacity: 0;   }
          100% { transform: scale(2.4); opacity: 0;   }
        }
      `}</style>
    </span>
  );
}

export default PulsingDot;
