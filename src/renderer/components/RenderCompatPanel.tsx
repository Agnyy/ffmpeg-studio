import { useMemo } from "react";
import type { TimelineLayer } from "../../shared/project";
import { analyzeCompositionEffectRenderCompat } from "../../keyframes/effectKeyframeRenderCompat";
import { analyzeCompositionRenderCompat } from "../../keyframes/keyframeRenderCompat";

type RenderCompatPanelProps = {
  layers: TimelineLayer[];
};

export default function RenderCompatPanel({ layers }: RenderCompatPanelProps) {
  const report = useMemo(() => analyzeCompositionRenderCompat(layers), [layers]);
  const effectReport = useMemo(() => analyzeCompositionEffectRenderCompat(layers), [layers]);

  if (!report.hasAnimatedTransform && !report.hasAnimatedEffects) {
    return (
      <div className="export-panel-block export-render-compat">
        <h3 className="export-panel-title">Render compatibility</h3>
        <p className="export-render-compat-ok">No animated properties.</p>
      </div>
    );
  }

  return (
    <div className="export-panel-block export-render-compat">
      <h3 className="export-panel-title">Render compatibility</h3>
      <ul className="export-render-compat-list">
        {report.groups
          .filter((group) => group.animated)
          .map((group) => (
            <li
              key={group.group}
              className={
                group.mode === "supported"
                  ? "export-render-compat-supported"
                  : "export-render-compat-limited"
              }
              title={group.tooltip}
            >
              {group.mode === "supported" ? "✓" : "⚠"} {group.label} —{" "}
              {group.mode === "supported" ? "render supported" : "preview only at range start"}
            </li>
          ))}
      </ul>
      {report.limitedEntries.length > 0 && (
        <div className="export-panel-warning export-render-compat-warning">
          ⚠ {report.limitedEntries.length} animated propert
          {report.limitedEntries.length === 1 ? "y" : "ies"} have limited render support:
          <ul>
            {report.limitedEntries.map((entry) => (
              <li key={`${entry.layerId}-${entry.group}`}>
                {entry.label} on layer {entry.layerName}
              </li>
            ))}
          </ul>
        </div>
      )}
      {report.allSupported && !effectReport.hasAnimatedEffects && (
        <p className="export-render-compat-ok">
          All animated transform properties are supported in render.
        </p>
      )}
      {effectReport.hasAnimatedEffects && (
        <>
          <h4 className="export-panel-subtitle">Effect parameters</h4>
          <ul className="export-render-compat-list">
            {effectReport.params.map((param) => (
              <li
                key={`${param.effectType}-${param.param}`}
                className={
                  param.mode === "supported"
                    ? "export-render-compat-supported"
                    : "export-render-compat-limited"
                }
                title={param.tooltip}
              >
                {param.mode === "supported" ? "✓" : "⚠"} {param.label} —{" "}
                {param.mode === "supported"
                  ? "preview/render supported"
                  : "render may use value at range start"}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
