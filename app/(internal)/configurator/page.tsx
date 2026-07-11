"use client";

// PraxisOS · Neural Configurator demo-side (EPIC 3)
// Lever komponenten NeuralConfigurator med default-parametre.

import * as React from "react";
import { NeuralConfigurator } from "@/components/NeuralConfigurator";

export default function ConfiguratorDemoPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-[1400px] mx-auto p-4 lg:p-6">
        <header className="mb-5">
          <p className="text-[11px] uppercase tracking-widest text-neutral-500">
            PraxisOS · Neural Configurator
          </p>
          <h1 className="text-2xl font-semibold mt-1">EPIC 3 · Demo</h1>
          <p className="text-sm text-neutral-400 mt-1 max-w-2xl">
            Gaussian Splatting-inspireret material-preview + 16-parameter
            orthotic-generator. Ingen scan_id valgt — bruger procedural
            placeholder-mesh.
          </p>
        </header>

        <NeuralConfigurator
          scanId="demo-001"
          onSave={async (params) => {
            console.log("Saved params:", params);
            alert(
              "Parameter-set gemt (console.log). I prod ville dette POST'e til /api/v1/[tenant]/configurator/scan/[id]/finalize",
            );
          }}
        />
      </div>
    </div>
  );
}
