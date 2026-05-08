import { useCallback, useEffect, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import type { Dispatch } from "react";
import type { SectionBlock, BreakpointsConfig, PageLayout } from "../../../types.js";
import { DEFAULT_BREAKPOINTS_CONFIG } from "../../../types.js";
import type { HistoryAction } from "../builderReducer.js";

interface Options {
  pageId: string;
  collection: string;
  /** Live `state.sections` reference. Save reads at call-time. */
  sections: SectionBlock[];
  isDirty: boolean;
  dispatch: Dispatch<HistoryAction>;
}

export interface BuilderPersistence {
  breakpointsConfig: BreakpointsConfig;
  setBreakpointsConfig: (cfg: BreakpointsConfig) => void;
  isBreakpointsDirty: boolean;
  save: () => Promise<void>;
}

/**
 * Owns: layout load on mount, breakpoints config load on mount, save flow,
 * beforeunload guard. Extracted from Builder.tsx (audit H4 finalize) so the
 * orchestration component stops mixing state plumbing with UI rendering.
 *
 * Breakpoints config is mutable from the LeftPanel; this hook tracks the
 * "dirty since last save" flag so Builder doesn't have to wire it manually.
 */
export function useBuilderPersistence({
  pageId,
  collection,
  sections,
  isDirty,
  dispatch,
}: Options): BuilderPersistence {
  const [breakpointsConfig, setBreakpointsConfig_] = useState<BreakpointsConfig>(DEFAULT_BREAKPOINTS_CONFIG);
  const [isBreakpointsDirty, setIsBreakpointsDirty] = useState(false);

  const setBreakpointsConfig = useCallback((cfg: BreakpointsConfig) => {
    setBreakpointsConfig_(cfg);
    setIsBreakpointsDirty(true);
  }, []);

  // Load layout on mount / page change.
  useEffect(() => {
    dispatch({ type: "LOAD_START" });
    apiFetch(`/_emdash/api/plugins/empixel-builder/layout?pageId=${encodeURIComponent(pageId)}&collection=${encodeURIComponent(collection)}`)
      .then((res) => parseApiResponse<{ data: PageLayout | null }>(res, "Failed to load layout"))
      .then(({ data }) => dispatch({ type: "LOAD_SUCCESS", sections: data?.sections ?? [] }))
      .catch((err: unknown) => dispatch({ type: "LOAD_ERROR", error: String(err) }));
  }, [pageId, collection, dispatch]);

  // Load breakpoints config once.
  useEffect(() => {
    apiFetch("/_emdash/api/plugins/empixel-builder/breakpoints")
      .then((res) => parseApiResponse<{ data: BreakpointsConfig }>(res, "Failed to load breakpoints"))
      .then(({ data }) => {
        if (data) {
          setBreakpointsConfig_({
            enabled: Array.isArray(data.enabled) ? data.enabled : DEFAULT_BREAKPOINTS_CONFIG.enabled,
            overrides: Array.isArray(data.overrides) ? data.overrides : [],
          });
        }
      })
      .catch(() => { /* ignore — fall back to default */ });
  }, []);

  // beforeunload guard while dirty.
  useEffect(() => {
    if (!isDirty && !isBreakpointsDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, isBreakpointsDirty]);

  const save = useCallback(async () => {
    dispatch({ type: "SAVE_START" });
    try {
      const res = await apiFetch("/_emdash/api/plugins/empixel-builder/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, collection, sections }),
      });
      if (!res.ok) {
        dispatch({ type: "SAVE_ERROR", error: (await res.text()) || "Save failed" });
        return;
      }
      if (isBreakpointsDirty) {
        const bpRes = await apiFetch("/_emdash/api/plugins/empixel-builder/breakpoints", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(breakpointsConfig),
        });
        if (!bpRes.ok) {
          dispatch({ type: "SAVE_ERROR", error: (await bpRes.text()) || "Save failed" });
          return;
        }
        setIsBreakpointsDirty(false);
      }
      dispatch({ type: "SAVE_SUCCESS" });
    } catch (err) {
      dispatch({ type: "SAVE_ERROR", error: String(err) });
    }
  }, [pageId, collection, sections, isBreakpointsDirty, breakpointsConfig, dispatch]);

  return { breakpointsConfig, setBreakpointsConfig, isBreakpointsDirty, save };
}
