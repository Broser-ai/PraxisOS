"use client";

// SoapReviewPane · Companion tier UI (HUMANIZED-FRONTIER-BLUEPRINT §2.6)
//
// Zero-typing keyboard-only navigation:
//   j / ↓     → next sentence
//   k / ↑     → previous sentence
//   a         → accept current sentence
//   e         → edit current sentence (inline)
//   r         → reject-and-redo (marks for regeneration)
//   space     → play/pause current audio segment
//   Enter     → commit reviewed section (S/O/A/P)
//
// Inline provenance-spans per Abridge Linked Evidence pattern.

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SoapDraft, SoapSection, ProvenanceSpan } from "@/lib/voice/types";

export type SoapReviewPaneProps = {
  draft: SoapDraft;
  /** Optional audio URL for click-to-play. Playback offset uses span.transcript_start_ms. */
  audioUrl?: string;
  /** Callback when practitioner commits review of a sentence. */
  onDecision?: (payload: {
    section: SoapSection["section"];
    sentenceIndex: number;
    decision: "accept" | "edit" | "reject";
    editedText?: string;
  }) => void | Promise<void>;
  /** Called when the entire draft is signed off. */
  onSignOff?: (draft: SoapDraft) => void | Promise<void>;
};

type ReviewState = "pending" | "accepted" | "edited" | "rejected";

const SECTION_LABELS: Record<SoapSection["section"], string> = {
  S: "Subjektivt",
  O: "Objektivt",
  A: "Vurdering",
  P: "Plan",
};

export function SoapReviewPane(props: SoapReviewPaneProps): React.ReactElement {
  const { draft, audioUrl, onDecision, onSignOff } = props;

  // Flat list of {section, index} pointers for keyboard navigation
  const flatIndex = useMemo(() => {
    const out: Array<{ section: SoapSection["section"]; sentenceIndex: number }> = [];
    for (const sec of draft.sections) {
      for (let i = 0; i < sec.sentences.length; i++) {
        out.push({ section: sec.section, sentenceIndex: i });
      }
    }
    return out;
  }, [draft]);

  const [cursor, setCursor] = useState(0);
  const [reviewMap, setReviewMap] = useState<
    Record<string, { state: ReviewState; editedText?: string }>
  >({});
  const [editingText, setEditingText] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const keyOf = (section: SoapSection["section"], idx: number): string => `${section}-${idx}`;

  const currentSentence = flatIndex[cursor];
  const currentSection = draft.sections.find((s) => s.section === currentSentence?.section);
  const currentSentenceObj = currentSection?.sentences[currentSentence?.sentenceIndex ?? 0];
  const currentState =
    (currentSentence && reviewMap[keyOf(currentSentence.section, currentSentence.sentenceIndex)]?.state) ??
    "pending";

  // Keyboard handling
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Skip if user is typing in an edit-field
      if (editingText !== null) return;

      const key = e.key.toLowerCase();
      if (key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(flatIndex.length - 1, c + 1));
      } else if (key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (key === "a" && currentSentence) {
        e.preventDefault();
        commit(currentSentence, "accepted");
      } else if (key === "e" && currentSentence && currentSentenceObj) {
        e.preventDefault();
        setEditingText(currentSentenceObj.text);
      } else if (key === "r" && currentSentence) {
        e.preventDefault();
        commit(currentSentence, "rejected");
      } else if (key === " " && currentSentenceObj && audioUrl) {
        e.preventDefault();
        playSpan(currentSentenceObj.spans[0]);
      } else if (key === "enter" && allSectionAccepted()) {
        e.preventDefault();
        void onSignOff?.(draft);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, flatIndex, editingText, currentSentence, currentSentenceObj, audioUrl]);

  const commit = useCallback(
    (target: { section: SoapSection["section"]; sentenceIndex: number }, decision: ReviewState) => {
      const k = keyOf(target.section, target.sentenceIndex);
      setReviewMap((prev) => ({
        ...prev,
        [k]: {
          state: decision === "accepted" ? "accepted" : decision === "edited" ? "edited" : decision === "rejected" ? "rejected" : "pending",
        },
      }));
      const mappedDecision: "accept" | "edit" | "reject" =
        decision === "accepted" ? "accept" : decision === "edited" ? "edit" : "reject";
      void onDecision?.({
        section: target.section,
        sentenceIndex: target.sentenceIndex,
        decision: mappedDecision,
      });
      // Auto-advance cursor after commit
      setCursor((c) => Math.min(flatIndex.length - 1, c + 1));
    },
    [flatIndex.length, onDecision],
  );

  function commitEdit() {
    if (editingText === null || !currentSentence) return;
    const k = keyOf(currentSentence.section, currentSentence.sentenceIndex);
    setReviewMap((prev) => ({
      ...prev,
      [k]: { state: "edited", editedText: editingText },
    }));
    void onDecision?.({
      section: currentSentence.section,
      sentenceIndex: currentSentence.sentenceIndex,
      decision: "edit",
      editedText: editingText,
    });
    setEditingText(null);
    setCursor((c) => Math.min(flatIndex.length - 1, c + 1));
  }

  function playSpan(span: ProvenanceSpan | undefined) {
    if (!span || !audioRef.current) return;
    audioRef.current.currentTime = span.transcript_start_ms / 1000;
    void audioRef.current.play();
  }

  function allSectionAccepted(): boolean {
    return flatIndex.every((p) => {
      const state = reviewMap[keyOf(p.section, p.sentenceIndex)]?.state;
      return state === "accepted" || state === "edited";
    });
  }

  const acceptedCount = flatIndex.filter(
    (p) => {
      const st = reviewMap[keyOf(p.section, p.sentenceIndex)]?.state;
      return st === "accepted" || st === "edited";
    },
  ).length;

  return (
    <div className="w-full max-w-[860px] rounded-xl bg-neutral-950 text-neutral-100 border border-neutral-800 overflow-hidden">
      <header className="px-4 py-3 border-b border-neutral-800 flex items-center gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-neutral-500">
            Companion · SOAP review
          </p>
          <h2 className="text-sm font-semibold mt-0.5">
            Session {draft.session_id.slice(-8)} · {draft.language.toUpperCase()}
          </h2>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[10px] uppercase tracking-widest text-neutral-500">
            Reviewed
          </p>
          <p className="text-lg font-semibold tabular-nums text-emerald-400">
            {acceptedCount}/{flatIndex.length}
          </p>
        </div>
      </header>

      <div className="px-4 py-3 bg-neutral-900/70 border-b border-neutral-800 text-[11px] text-neutral-400 flex gap-3 flex-wrap">
        <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono">j / k</kbd> navigate
        <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono">a</kbd> accept
        <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono">e</kbd> edit
        <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono">r</kbd> reject
        {audioUrl && (
          <>
            <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono">space</kbd> play
          </>
        )}
        <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono">enter</kbd> sign off
      </div>

      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" className="hidden" />}

      <div className="p-4 space-y-5 max-h-[560px] overflow-y-auto">
        {draft.sections.map((section) => (
          <section key={section.section}>
            <h3 className="text-xs uppercase tracking-widest text-neutral-500 mb-2">
              {section.section} · {SECTION_LABELS[section.section]}
            </h3>
            <div className="space-y-1.5">
              {section.sentences.map((sentence, sIdx) => {
                const isCursor =
                  currentSentence?.section === section.section &&
                  currentSentence?.sentenceIndex === sIdx;
                const state = reviewMap[keyOf(section.section, sIdx)]?.state ?? "pending";
                const editedText = reviewMap[keyOf(section.section, sIdx)]?.editedText;
                return (
                  <SentenceRow
                    key={sIdx}
                    section={section.section}
                    sentenceIndex={sIdx}
                    text={editedText ?? sentence.text}
                    spans={sentence.spans}
                    state={state}
                    isCursor={isCursor}
                    isEditing={isCursor && editingText !== null}
                    editingText={isCursor ? editingText : null}
                    onEditChange={setEditingText}
                    onEditCommit={commitEdit}
                    onClickPlay={() => playSpan(sentence.spans[0])}
                    onClickAccept={() =>
                      commit({ section: section.section, sentenceIndex: sIdx }, "accepted")
                    }
                    onClickReject={() =>
                      commit({ section: section.section, sentenceIndex: sIdx }, "rejected")
                    }
                    audioAvailable={Boolean(audioUrl)}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <footer className="px-4 py-3 border-t border-neutral-800 flex items-center gap-3">
        <p className="text-[11px] text-neutral-500">
          AI-udkast · {draft.vlm_model_version} · må ikke persisteres uden practitioner-godkendelse.
        </p>
        <button
          type="button"
          disabled={!allSectionAccepted()}
          onClick={() => onSignOff?.(draft)}
          className="ml-auto rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-neutral-950 font-semibold px-4 py-1.5 text-sm transition"
        >
          Signér SOAP-note
        </button>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SentenceRow
// ---------------------------------------------------------------------------

function SentenceRow(props: {
  section: SoapSection["section"];
  sentenceIndex: number;
  text: string;
  spans: ProvenanceSpan[];
  state: ReviewState;
  isCursor: boolean;
  isEditing: boolean;
  editingText: string | null;
  onEditChange: (v: string | null) => void;
  onEditCommit: () => void;
  onClickPlay: () => void;
  onClickAccept: () => void;
  onClickReject: () => void;
  audioAvailable: boolean;
}): React.ReactElement {
  const provenanceHint = props.spans[0]?.provenance ?? "template";
  const speaker = props.spans[0]?.source_speaker ?? "unknown";
  const provenanceColor: Record<ProvenanceSpan["provenance"], string> = {
    verbatim: "text-emerald-400",
    paraphrased: "text-cyan-400",
    inferred: "text-amber-400",
    template: "text-neutral-500",
  };
  const stateBorder: Record<ReviewState, string> = {
    pending: "border-neutral-800",
    accepted: "border-emerald-500/50",
    edited: "border-cyan-500/50",
    rejected: "border-red-500/50",
  };

  return (
    <div
      className={
        "flex items-start gap-3 p-2.5 rounded-md border transition " +
        stateBorder[props.state] +
        (props.isCursor ? " bg-neutral-900" : " bg-neutral-950")
      }
      aria-current={props.isCursor ? "true" : undefined}
    >
      <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-0.5">
        <span
          className={"text-[10px] uppercase tracking-widest font-mono " + provenanceColor[provenanceHint]}
          title={`Provenance: ${provenanceHint} · Speaker: ${speaker}`}
        >
          {provenanceHint.slice(0, 3)}
        </span>
        {props.audioAvailable && (
          <button
            type="button"
            onClick={props.onClickPlay}
            className="text-neutral-500 hover:text-neutral-200"
            aria-label="Afspil audio-segment"
            title="Afspil audio-segment"
          >
            ▶
          </button>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {props.isEditing ? (
          <textarea
            autoFocus
            value={props.editingText ?? ""}
            onChange={(e) => props.onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                props.onEditChange(null);
              } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                props.onEditCommit();
              }
            }}
            onBlur={props.onEditCommit}
            className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1.5 text-sm text-neutral-100 focus:outline-none focus:border-emerald-400"
            rows={3}
          />
        ) : (
          <p className="text-sm leading-relaxed">{props.text}</p>
        )}
      </div>

      <div className="flex-shrink-0 flex flex-col gap-1">
        <button
          type="button"
          onClick={props.onClickAccept}
          className="text-emerald-400 hover:text-emerald-300 text-xs"
          title="Accept (a)"
        >
          ✓
        </button>
        <button
          type="button"
          onClick={props.onClickReject}
          className="text-red-400 hover:text-red-300 text-xs"
          title="Reject (r)"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
