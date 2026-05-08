import { epxVars } from "../epxVars.js";

export function BuilderStyles() {
  return (
    <style>{`
      /* ── Theme variables ── */
      ${epxVars}

      /* ── Selector ── */
      .epx-selector {
        min-height: 100vh;
        background: var(--epx-bg);
        color: var(--epx-text);
        color-scheme: light dark;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .epx-selector__header {
        background: var(--epx-surface);
        border-bottom: 1px solid var(--epx-border);
        padding: 32px 40px 0;
      }
      .epx-selector__header-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
      }
      .epx-selector__settings-link {
        font-size: 13px;
        color: var(--epx-text-muted);
        text-decoration: none;
        padding: 4px 8px;
        border-radius: 5px;
        transition: background 0.1s, color 0.1s;
      }
      .epx-selector__settings-link:hover { background: var(--epx-hover-bg); color: var(--epx-text-2); }
      .epx-selector__subtitle {
        color: var(--epx-text-muted);
        font-size: 14px;
        margin: 6px 0 20px;
      }
      .epx-selector__tabs {
        display: flex;
        gap: 0;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
      }
      .epx-selector__tabs::-webkit-scrollbar { display: none; }
      .epx-selector__tab {
        padding: 10px 20px;
        border: none;
        background: none;
        font-size: 14px;
        font-weight: 500;
        color: var(--epx-text-muted);
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: color 0.15s, border-color 0.15s;
        white-space: nowrap;
      }
      .epx-selector__tab.is-active { color: var(--epx-accent); border-bottom-color: var(--epx-accent); }
      .epx-selector__tab:hover:not(.is-active) { color: var(--epx-text-2); }

      .epx-selector__body {
        padding: 24px 40px;
      }
      .epx-selector__loading {
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--epx-text-muted);
        font-size: 14px;
      }
      .epx-selector__empty { color: var(--epx-text-faint); font-size: 14px; }

      .epx-selector__table-wrap {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      @media (min-width: 1000px) {
        .epx-selector__table-wrap { overflow-x: visible; }
      }
      .epx-selector__table {
        width: 100%;
        min-width: 640px;
        border-collapse: collapse;
        font-size: 14px;
      }
      .epx-selector__th {
        text-align: left;
        font-size: 12px;
        font-weight: 600;
        color: var(--epx-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 0 12px 10px;
        border-bottom: 1px solid var(--epx-border);
      }
      .epx-selector__th--center { text-align: center; }
      .epx-selector__row:hover .epx-selector__td { background: var(--epx-hover-bg); }
      .epx-selector__td {
        padding: 12px;
        border-bottom: 1px solid var(--epx-border);
        color: var(--epx-text-muted);
        font-size: 13px;
        white-space: nowrap;
        vertical-align: middle;
      }
      .epx-selector__td--name {
        cursor: pointer;
        min-width: 200px;
      }
      .epx-selector__td--center { text-align: center; }
      .epx-selector__entry-title {
        display: block;
        font-size: 14px;
        font-weight: 600;
        color: var(--epx-text);
        margin-bottom: 2px;
      }
      .epx-selector__entry-id {
        display: block;
        font-size: 11px;
        color: var(--epx-text-faint);
        font-family: monospace;
      }
      .epx-selector__toggle {
        width: 16px;
        height: 16px;
        cursor: pointer;
        accent-color: var(--epx-accent);
      }
      .epx-selector__toggle:disabled { opacity: 0.4; cursor: wait; }
      .epx-selector__view-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--epx-text-faint);
        border-radius: 5px;
        padding: 4px;
        transition: color 0.15s, background 0.15s;
      }
      .epx-selector__view-link:hover { color: var(--epx-accent); background: var(--epx-hover-bg); }

      .epx-toast-container {
        position: fixed;
        bottom: 1.25rem;
        right: 1.25rem;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
      }
      .epx-toast {
        padding: 10px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        pointer-events: auto;
        cursor: pointer;
        animation: epx-toast-in 0.2s ease;
      }
      @keyframes epx-toast-in {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .epx-toast--success { background: #166534; color: #dcfce7; }
      .epx-toast--error   { background: #991b1b; color: #fee2e2; }

      /* ── Builder ── */
      .epx-builder {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: var(--epx-bg);
        color: var(--epx-text);
        color-scheme: light dark;
      }

      .epx-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 7px;
        background: var(--epx-surface);
        border-bottom: 1px solid var(--epx-border);
        flex-shrink: 0;
        gap: 16px;
      }
      .epx-topbar__left { display: flex; align-items: center; gap: 12px; }
      .epx-topbar__logo { font-weight: 700; font-size: 15px; }
      .epx-topbar__page-id {
        display: flex; align-items: center; gap: 4px;
        color: var(--epx-text-muted); font-size: 13px;
        text-decoration: none;
      }
      .epx-topbar__page-id:hover { color: var(--epx-text); }
      .epx-topbar__page-id-icon { opacity: 0; transition: opacity 0.15s; flex-shrink: 0; }
      .epx-topbar__page-id:hover .epx-topbar__page-id-icon { opacity: 1; }
      .epx-topbar__center { flex: 1; text-align: center; }
      .epx-topbar__unsaved { font-size: 13px; color: #f59e0b; }
      .epx-topbar__error { font-size: 13px; color: #ef4444; }
      .epx-topbar__right { display: flex; gap: 8px; }

      .epx-theme-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        background: none;
        border: 1px solid transparent;
        border-radius: 6px;
        cursor: pointer;
        color: var(--epx-text-muted);
        transition: background 0.1s, color 0.1s, border-color 0.1s;
        flex-shrink: 0;
      }
      .epx-theme-toggle:hover {
        background: var(--epx-hover-bg);
        border-color: var(--epx-border);
        color: var(--epx-text);
      }

      .epx-builder__panels {
        display: grid;
        flex: 1;
        overflow: hidden;
      }

      .epx-resize-handle {
        background: var(--epx-border);
        cursor: col-resize;
        transition: background 0.15s;
        position: relative;
        z-index: 10;
        flex-shrink: 0;
      }
      .epx-resize-handle::after {
        content: '';
        position: absolute;
        inset: 0 -3px;
      }
      .epx-resize-handle:hover { background: var(--epx-accent); }
      .epx-resize-handle.is-collapsed { cursor: col-resize; background: var(--epx-border); }
      .epx-resize-handle.is-collapsed:hover { background: var(--epx-accent); }

      .epx-btn {
        padding: 7px 16px;
        border-radius: 6px;
        border: 1px solid transparent;
        font-size: 14px;
        cursor: pointer;
        font-weight: 500;
        transition: opacity 0.15s;
      }
      .epx-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .epx-btn--primary { background: var(--epx-accent); color: #fff; }
      .epx-btn--primary:not(:disabled):hover { background: var(--epx-accent-hover); }
      .epx-btn--ghost { background: transparent; color: var(--epx-text-mid); border-color: var(--epx-input-border); }
      .epx-btn--ghost:hover { background: var(--epx-hover-bg); }

      /* ── Unsaved-changes modal ── */
      .epx-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 100000;
        background: rgba(0,0,0,0.45);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .epx-modal {
        position: relative;
        background: var(--epx-surface);
        border: 1px solid var(--epx-border);
        border-radius: 12px;
        padding: 32px 32px 28px;
        width: 380px;
        max-width: calc(100vw - 40px);
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      }
      .epx-modal__close {
        position: absolute;
        top: 14px;
        right: 14px;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: none;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        color: var(--epx-text-muted);
        font-size: 14px;
        transition: background 0.1s, color 0.1s;
      }
      .epx-modal__close:hover { background: var(--epx-hover-bg); color: var(--epx-text); }
      .epx-modal__title {
        margin: 0 0 10px;
        font-size: 17px;
        font-weight: 600;
        color: var(--epx-text);
      }
      .epx-modal__body {
        margin: 0 0 24px;
        font-size: 14px;
        color: var(--epx-text-muted);
        line-height: 1.5;
      }
      .epx-modal__actions {
        display: flex;
        gap: 10px;
      }

      /* ── Context Menu ── */
      .epx-context-menu {
        position: fixed;
        z-index: 99999;
        background: var(--epx-surface);
        border: 1px solid var(--epx-border);
        border-radius: 7px;
        box-shadow: 0 6px 20px rgba(0,0,0,.18);
        min-width: 168px;
        padding: 4px 0;
        user-select: none;
      }
      .epx-context-menu__item {
        display: flex;
        align-items: center;
        width: 100%;
        padding: 7px 14px;
        font-size: 13px;
        text-align: left;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--epx-text);
        line-height: 1;
        gap: 8px;
        transition: background 0.1s;
      }
      .epx-context-menu__item:hover:not(:disabled) { background: var(--epx-hover-bg); }
      .epx-context-menu__item:disabled { opacity: 0.4; cursor: not-allowed; }
      .epx-context-menu__item--danger { color: var(--epx-red, #d94040); }
      .epx-context-menu__item--danger:hover:not(:disabled) { background: color-mix(in srgb, var(--epx-red, #d94040) 10%, transparent); }
      .epx-context-menu__separator {
        margin: 4px 0;
        border: none;
        border-top: 1px solid var(--epx-border);
      }

      .epx-left-panel {
        background: var(--epx-surface);
        overflow: hidden; display: flex; flex-direction: column;
      }
      .epx-left-panel__tabs { display: flex; border-bottom: 1px solid var(--epx-border); }
      .epx-left-panel__tab { flex: 1; padding: 9px 0; border: none; background: none; color: var(--epx-text-faint); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color 0.15s, border-color 0.15s; display: flex; align-items: center; justify-content: center; }
      .epx-left-panel__tab:hover { color: var(--epx-text-mid); }
      .epx-left-panel__tab.is-active { color: var(--epx-accent); border-bottom-color: var(--epx-accent); }
      .epx-left-panel__header { padding: 8px 12px 6px; border-bottom: 1px solid var(--epx-border-subtle); }
      .epx-left-panel__hint { font-size: 11px; color: var(--epx-text-faint); margin: 0; }
      .epx-left-panel__list { padding: 8px; display: flex; flex-direction: column; gap: 2px; }
      .epx-left-panel__empty { flex: 1; }

      .epx-block-group { display: flex; flex-direction: column; }
      .epx-block-group + .epx-block-group { margin-top: 4px; border-top: 1px solid var(--epx-border-subtle); padding-top: 4px; }
      .epx-block-group__label {
        font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
        color: var(--epx-text-faint); padding: 6px 10px 2px;
      }
      .epx-block-card {
        display: flex; align-items: center; gap: 8px; padding: 8px 10px;
        border: 1px solid transparent; border-radius: 6px; background: none;
        cursor: grab; text-align: left; width: 100%; font-size: 13px;
        transition: background 0.1s, border-color 0.1s;
      }
      .epx-block-card:hover { background: var(--epx-card-hover-bg); border-color: #c7d2fe; }
      .epx-block-card__icon { font-size: 16px; flex-shrink: 0; width: 22px; text-align: center; }
      .epx-block-card__label { font-weight: 500; color: var(--epx-text-strong); }

      /* ── Canvas ── */
      .epx-canvas { overflow-y: auto; background: var(--epx-bg); min-width: 0; width: 100%; }
      .epx-canvas--empty { display: flex; align-items: center; justify-content: center; }
      .epx-canvas--empty .epx-canvas__preview-frame { display: flex; align-items: center; justify-content: center; }
      .epx-canvas__empty-state { text-align: center; color: var(--epx-text-faint); }
      .epx-canvas__empty-icon { font-size: 48px; margin-bottom: 12px; }
      .epx-canvas__empty-state h3 { margin: 0 0 6px; font-size: 16px; color: var(--epx-text-mid); }
      .epx-canvas__empty-state p { margin: 0; font-size: 13px; }
      .epx-canvas__list { display: flex; flex-direction: column; }

      /* ── Block preview (leaf blocks) ── */
      .epx-block-preview {
        position: relative; overflow: visible;
        border: 1px solid transparent; cursor: pointer;
        transition: border-color 0.15s;
        width: 100%;
      }
      .epx-block-preview.is-selected { border-color: var(--epx-selected); }

      /* ── BlockOverlay ── */
      .epx-block-overlay {
        position: absolute; top: 0; left: 50%; transform: translateX(-50%);
        z-index: 20; display: flex; align-items: center; gap: 2px;
        background: rgba(20,20,20,0.82); border-radius: 4px; padding: 0;
        opacity: 0; pointer-events: none; transition: opacity 0.15s;
        white-space: nowrap;
      }
      .epx-block-overlay.is-visible { opacity: 1; pointer-events: auto; }
      .epx-block-overlay__btn {
        background: none; border: none; color: #fff; cursor: pointer;
        width: 22px; height: 22px; border-radius: 4px; font-size: 17px;
        display: flex; align-items: center; justify-content: center; padding: 0;
        transition: background 0.1s;
      }
      .epx-block-overlay__btn:hover { background: rgba(255,255,255,0.15); }
      .epx-block-overlay__btn--delete:hover { background: rgba(220,38,38,0.8); }
      .epx-block-overlay__handle {
        color: #ccc; cursor: grab; user-select: none;
        width: 22px; height: 22px; border-radius: 4px;
        display: flex; align-items: center; justify-content: center;
        font-size: 15px; transition: background 0.1s, color 0.1s;
      }
      .epx-block-overlay__handle:hover { background: rgba(255,255,255,0.15); color: #fff; }
      /* ── Container block (section) ── */
      .epx-container-block {
        background: transparent;
        position: relative; cursor: pointer;
        overflow: visible;
      }
      .epx-container-block::before {
        content: ""; position: absolute; inset: 0;
        border: 1px solid transparent; pointer-events: none;
        transition: border-color 0.15s; z-index: 5;
      }
      .epx-container-block:hover::before { border-color: var(--epx-selected); }
      .epx-container-block.is-selected::before { border-color: var(--epx-selected); }
      .epx-container-block__children {
        display: flex; flex-direction: column; min-height: 48px; height: 100%;
      }
      .epx-container__empty-zone {
        display: flex; align-items: center; justify-content: center; min-height: 56px;
        border-radius: 6px; transition: background 0.15s;
      }
      .epx-container__empty-zone.is-over { background: rgba(134,239,172,0.12); }

      /* ── Inner block overlay (drag handle, top-left) ── */
      .epx-inner-block-overlay {
        position: absolute; top: 0; left: 0; z-index: 20;
        opacity: 0; pointer-events: none; transition: opacity 0.15s;
      }
      .epx-inner-block-overlay.is-visible { opacity: 1; pointer-events: auto; }
      .epx-inner-block-overlay__handle {
        background: rgba(20,20,20,0.82); color: #ccc; cursor: grab; user-select: none;
        width: 22px; height: 22px; border-radius: 4px;
        display: flex; align-items: center; justify-content: center;
        font-size: 15px; transition: background 0.1s, color 0.1s;
      }
      .epx-inner-block-overlay__handle:hover { background: rgba(20,20,20,0.95); color: #fff; }

      /* ── Right column (always-visible settings + structure) ── */
      .epx-right-column {
        display: flex; flex-direction: column; overflow: hidden;
        background: var(--epx-surface);
      }
      .epx-right-column__settings {
        overflow: hidden; display: flex; flex-direction: column; flex-shrink: 0;
      }

      /* Horizontal resize handle (between settings and structure) */
      .epx-resize-handle--row {
        cursor: row-resize; height: 4px; background: var(--epx-border);
        flex-shrink: 0; position: relative; z-index: 10; transition: background 0.15s;
      }
      .epx-resize-handle--row::after { content: ''; position: absolute; inset: -3px 0; }
      .epx-resize-handle--row:hover { background: var(--epx-accent); }

      /* ── Structure panel ── */
      .epx-structure-panel {
        display: flex; flex-direction: column; overflow: hidden;
        border-top: 1px solid var(--epx-border); background: var(--epx-surface); flex-shrink: 0;
      }
      .epx-structure-panel__header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0 10px; height: 32px; flex-shrink: 0;
        border-bottom: 1px solid var(--epx-border-subtle);
      }
      .epx-structure-panel__title {
        font-size: 11px; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.06em; color: var(--epx-text-faint);
      }
      .epx-structure-panel__collapse-btn {
        background: none; border: none; cursor: pointer; color: var(--epx-text-faint);
        width: 22px; height: 22px; border-radius: 4px; display: flex;
        align-items: center; justify-content: center; padding: 0; transition: background 0.1s, color 0.1s;
      }
      .epx-structure-panel__collapse-btn:hover { background: var(--epx-hover-bg); color: var(--epx-text-mid); }
      .epx-structure-panel__body {
        flex: 1; overflow-y: auto; padding: 4px 0;
        scrollbar-width: thin; scrollbar-color: var(--epx-text-muted) transparent;
      }
      .epx-structure-panel__body::-webkit-scrollbar { width: 4px; }
      .epx-structure-panel__body::-webkit-scrollbar-track { background: transparent; }
      .epx-structure-panel__body::-webkit-scrollbar-thumb { background: var(--epx-text-muted); border-radius: 4px; }
      .epx-structure-panel__empty {
        padding: 20px 12px; font-size: 12px; color: var(--epx-text-faint); text-align: center;
      }

      /* ── Structure rows ── */
      .epx-structure-row-wrapper { position: relative; }
      .epx-structure-row {
        display: flex; align-items: center; gap: 4px; height: 28px;
        cursor: pointer; border-radius: 4px; margin: 0 4px;
        transition: background 0.1s; user-select: none;
      }
      .epx-structure-row:hover { background: var(--epx-hover-bg); }
      .epx-structure-row.is-selected { background: var(--epx-accent-bg); }
      .epx-structure-row.is-dragging { opacity: 0.4; }
      .epx-structure-row.is-drop-inside {
        background: var(--epx-accent-bg);
        outline: 1.5px dashed var(--epx-accent);
        outline-offset: -1px;
      }
      .epx-structure-row__expand-btn {
        background: none; border: none; cursor: pointer; color: var(--epx-text-faint);
        width: 16px; height: 16px; flex-shrink: 0; display: flex; align-items: center;
        justify-content: center; border-radius: 3px; padding: 0; transition: color 0.1s, background 0.1s;
      }
      .epx-structure-row__expand-btn:hover { color: var(--epx-text-mid); background: var(--epx-hover-bg); }
      .epx-structure-row__icon { font-size: 12px; width: 16px; text-align: center; flex-shrink: 0; }
      .epx-structure-row__label {
        font-size: 12px; color: var(--epx-text-mid); overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0;
        cursor: grab; touch-action: none;
      }
      .epx-structure-row__label:active { cursor: grabbing; }
      .epx-structure-row.is-selected .epx-structure-row__label { color: var(--epx-accent); font-weight: 600; }

      /* ── Structure drop line ── */
      .epx-structure-drop-line {
        height: 2px; margin-right: 8px; border-radius: 1px;
        background-image: repeating-linear-gradient(90deg, var(--epx-accent) 0px, var(--epx-accent) 5px, transparent 5px, transparent 9px);
        margin-top: 1px; margin-bottom: 1px;
      }

      /* ── Drop indicator ── */
      .epx-drop-indicator {
        position: absolute; bottom: -3px; left: 0; right: 0;
        height: 2px; background: var(--epx-selected); border-radius: 1px; z-index: 30;
        pointer-events: none;
      }

      /* ── Drag overlay ghost ── */
      .epx-drag-overlay-ghost {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px; background: var(--epx-surface);
        border: 1px solid #c7d2fe; border-radius: 6px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        font-size: 13px; font-weight: 500; color: var(--epx-text-strong);
        pointer-events: none; white-space: nowrap;
        transform: rotate(2deg);
      }
      .epx-drag-overlay-ghost__icon { font-size: 16px; }
      .epx-drag-overlay-ghost__label { color: var(--epx-text-strong); }

      /* ── Right panel ── */
      .epx-right-panel {
        background: var(--epx-surface);
        display: flex; flex-direction: column; overflow: hidden; height: 100%;
      }
      .epx-right-panel--empty { align-items: center; justify-content: center; }
      .epx-right-panel__placeholder { text-align: center; color: var(--epx-text-faint); padding: 32px 16px; }
      .epx-right-panel__placeholder-icon { font-size: 32px; margin-bottom: 8px; }
      .epx-right-panel__placeholder p { font-size: 13px; margin: 0; }
      .epx-right-panel__header { display: flex; align-items: center; gap: 8px; padding: 14px 14px 6px; border-bottom: 1px solid var(--epx-border-subtle); }
      .epx-right-panel__icon { font-size: 20px; }
      .epx-right-panel__title { font-size: 14px; font-weight: 700; margin: 0; }
      .epx-right-panel__description { font-size: 12px; color: var(--epx-text-muted); padding: 6px 14px 10px; margin: 0; border-bottom: 1px solid var(--epx-border-subtle); }
      .epx-right-panel__tabs { display: flex; border-bottom: 1px solid var(--epx-border); }
      .epx-right-panel__tab { flex: 1; padding: 9px 0; border: none; background: none; color: var(--epx-text-faint); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color 0.15s, border-color 0.15s; display: flex; align-items: center; justify-content: center; }
      .epx-right-panel__tab:hover { color: var(--epx-text-mid); }
      .epx-right-panel__tab.is-active { color: var(--epx-accent); border-bottom-color: var(--epx-accent); }
      .epx-right-panel__fields { padding: 12px 14px; display: flex; flex-direction: column; gap: 12px; flex: 1; overflow: hidden auto; scrollbar-width: thin; scrollbar-color: var(--epx-text-muted) transparent; height: 100%; }
      .epx-right-panel__fields::-webkit-scrollbar { width: 4px; }
      .epx-right-panel__fields::-webkit-scrollbar-track { background: transparent; }
      .epx-right-panel__fields::-webkit-scrollbar-thumb { background: var(--epx-text-muted); border-radius: 4px; }

      .epx-field { display: flex; flex-direction: column; gap: 4px; }
      .epx-field__label { font-size: 12px; font-weight: 600; color: var(--epx-text-faint); }
      .epx-field__required { color: #ef4444; margin-left: 3px; }
      .epx-field__input, .epx-field__select, .epx-field__textarea {
        width: 100%; padding: 6px 8px; border: 1px solid var(--epx-input-border); border-radius: 5px;
        font-size: 13px; background: var(--epx-input-bg); color: var(--epx-text); box-sizing: border-box; transition: border-color 0.15s;
      }
      .epx-field__input:focus, .epx-field__select:focus, .epx-field__textarea:focus {
        outline: none; border-color: var(--epx-accent); background: var(--epx-surface);
      }
      .epx-field__textarea { resize: vertical; min-height: 72px; }
      /* ── Code editor (intentionally always dark — Catppuccin Mocha) ── */
      .epx-code-editor {
        border: 1px solid #2a2a3d; border-radius: 6px; overflow: hidden;
        font-family: "SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", monospace;
        font-size: 12px; line-height: 1.7; background: #1e1e2e;
      }
      .epx-code-editor__header {
        padding: 4px 8px; background: #13131f; border-bottom: 1px solid #2a2a3d;
        display: flex; align-items: center; gap: 6px; font-size: 11px; min-width: 0;
      }
      .epx-code-editor__copy-btn {
        flex-shrink: 0; background: none; border: none; cursor: pointer;
        color: #6c7086; padding: 2px; border-radius: 3px; display: flex;
        align-items: center; transition: color 0.15s;
      }
      .epx-code-editor__copy-btn:hover { color: #cba6f7; }
      .epx-code-editor__selector-scroll {
        display: flex; align-items: center; gap: 0; overflow-x: auto;
        white-space: nowrap; flex: 1; min-width: 0;
        scrollbar-width: thin; scrollbar-color: #313244 transparent;
      }
      .epx-code-editor__selector-scroll::-webkit-scrollbar { height: 3px; }
      .epx-code-editor__selector-scroll::-webkit-scrollbar-track { background: transparent; }
      .epx-code-editor__selector-scroll::-webkit-scrollbar-thumb { background: #313244; border-radius: 2px; }
      .epx-code-editor__selector-kw { color: #cba6f7; font-style: italic; }
      .epx-code-editor__selector-eq { color: #6c7086; }
      .epx-code-editor__selector-val { color: #89dceb; }
      .epx-code-editor__body {
        display: flex; align-items: stretch;
      }
      .epx-code-editor__line-nums {
        padding: 8px 0; min-width: 36px; text-align: right;
        background: #181825; color: #45475a; border-right: 1px solid #2a2a3d;
        overflow: hidden; flex-shrink: 0; user-select: none;
      }
      .epx-code-editor__line-num { padding: 0 8px; height: calc(1.7 * 12px); box-sizing: content-box; }
      .epx-code-editor__textarea {
        flex: 1; padding: 8px 10px; border: none; outline: none; resize: none;
        background: #1e1e2e; color: #cdd6f4; font-family: inherit; font-size: inherit;
        line-height: inherit; overflow: hidden; box-sizing: border-box;
        caret-color: #f5c2e7; display: block; min-height: 60px;
      }
      .epx-code-editor__textarea::placeholder { color: #45475a; }
      .epx-code-editor__suggestions {
        background: #1e1e2e; border: 1px solid #2a2a3d; border-radius: 6px;
        box-shadow: 0 6px 18px rgba(0,0,0,0.35);
        max-height: 200px; overflow-y: auto;
        display: flex; flex-direction: column;
        font-family: "SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", monospace;
        font-size: 12px;
      }
      .epx-code-editor__suggestion {
        display: block; width: 100%; text-align: left;
        padding: 4px 10px; border: none; background: transparent;
        color: #cdd6f4; cursor: pointer;
      }
      .epx-code-editor__suggestion:hover,
      .epx-code-editor__suggestion.is-active {
        background: #313244; color: #f5c2e7;
      }
      .epx-field--toggle .epx-field__toggle-label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
      .epx-field__toggle-input { width: 16px; height: 16px; cursor: pointer; }

      /* ── LinkControl ── */
      .epx-link-ctrl__checks { display: flex; align-items: center; gap: 12px; padding: 6px 10px; border-top: 1px solid var(--epx-border-subtle); }
      .epx-link-ctrl__check { display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: 11px; color: var(--epx-text-2); user-select: none; }
      .epx-link-ctrl__check input[type="checkbox"] { width: 13px; height: 13px; cursor: pointer; accent-color: var(--epx-accent); }
      .epx-bg-ctrl__url-row--indent { padding-left: 0; }
      .epx-link-ctrl__hint { margin: 0; padding: 5px 10px 7px; font-size: 10px; line-height: 1.6; color: var(--epx-text-faint); border-top: 1px solid var(--epx-border-subtle); }
      .epx-link-ctrl__hint code { font-family: monospace; color: #f38019; border: 1px solid var(--epx-border-subtle); border-radius: 3px; padding: 0 3px; }

      /* ── SpacingControl ── */
      .epx-spacing-ctrl { display: flex; flex-direction: column; container-type: inline-size; }
      .epx-spacing-ctrl__row { display: flex; align-items: center; gap: 2px; }
      .epx-spacing-ctrl__row .epx-side-input { border-top: none; }
      .epx-spacing-ctrl__row > .epx-spacing-ctrl__collapsed { flex: 1; min-width: 0; }
      .epx-spacing-ctrl__collapsed {
        display: flex; align-items: center; height: 28px;
        outline: 1px solid var(--epx-border); border-radius: 5px;
        background: var(--epx-input-bg); overflow: visible;
      }
      .epx-spacing-ctrl__collapsed > .epx-side-input {
        flex: 1; min-width: 0; border-top: none; background: transparent;
      }
      .epx-spacing-ctrl__expanded {
        outline: 1px solid var(--epx-border); border-radius: 5px;
        background: var(--epx-input-bg); overflow: visible;
      }
      .epx-spacing-ctrl__exp-header {
        display: flex; align-items: center; justify-content: space-between;
        height: 27px; padding: 0; border-bottom: 1px solid var(--epx-border-subtle);
      }
      .epx-spacing-ctrl__label {
        font-size: 10px; font-weight: 700; color: var(--epx-text-faint); opacity: 0.65;
        text-transform: uppercase; letter-spacing: 0.06em; padding: 0 8px;
      }
      .epx-spacing-ctrl__caret {
        background: none; border: none; border-left: 1px solid var(--epx-border-subtle);
        cursor: pointer; color: var(--epx-text-faint);
        font-size: 11px; padding: 0 8px; height: 28px; line-height: 28px;
        flex-shrink: 0; transition: color 0.1s;
        margin-left: auto;
      }
      .epx-spacing-ctrl__caret:hover { color: var(--epx-text-mid); }
      .epx-spacing-ctrl__exp-actions { display: flex; align-items: center; }
      .epx-reset-btn {
        background: none; border: none; cursor: pointer; padding: 0 4px; height: 28px;
        display: flex; align-items: center; color: var(--epx-text-faint);
        transition: color 0.1s; flex-shrink: 0;
      }
      .epx-reset-btn:hover { color: var(--epx-accent); }
      .epx-spacing-ctrl__grid { display: grid; }
      .epx-spacing-ctrl__grid--col2 { grid-template-columns: 1fr 1fr; }
      .epx-spacing-ctrl__grid--col1 { grid-template-columns: 1fr; }
      .epx-spacing-ctrl__grid--col2 > .epx-side-input:nth-child(odd) {
        border-right: 2px solid var(--epx-border-subtle);
      }
      @container (max-width: 220px) {
        .epx-spacing-ctrl__grid--col2 { grid-template-columns: 1fr; }
        .epx-spacing-ctrl__grid--col2 > .epx-side-input:nth-child(odd) { border-right: none; }
      }

      /* ── SideInput ── */
      .epx-side-input {
        display: flex; align-items: center; min-height: 28px; height: auto;
        background: transparent; position: relative;
        border-top: 1px solid var(--epx-border-subtle);
        min-width: 0;
      }
      .epx-side-input__label {
        flex-shrink: 0; width: 22px; text-align: center;
        font-size: 9px; font-weight: 700; color: var(--epx-text-faint);
        text-transform: uppercase; cursor: ew-resize; user-select: none;
        align-self: stretch; display: flex; align-items: center; justify-content: center;
        transition: color 0.1s, background 0.1s;
        border-right: 1px solid var(--epx-border-subtle);
      }
      .epx-side-input__label--full {
        flex: 0 1 auto; width: auto; max-width: 100%; justify-content: flex-start; padding: 0 8px;
        font-size: 10px; letter-spacing: 0.06em; border-right: none;
        white-space: nowrap; overflow: hidden;
        text-overflow: clip;
        min-width: 0;
        position: relative;
      }
      .epx-side-input__label--full::after,
      .epx-spacing-ctrl__label::after {
        content: "...";
        position: absolute;
        right: 0;
        top: 0;
        bottom: 0;
        display: none;
        align-items: center;
        padding: 0 4px 0 6px;
        font: inherit; color: inherit; letter-spacing: 0;
        background: linear-gradient(to right, transparent, var(--epx-input-bg, #fff) 40%);
        pointer-events: none;
      }
      .epx-side-input__label--full[data-overflow="true"]::after,
      .epx-spacing-ctrl__label[data-overflow="true"]::after {
        display: flex;
      }
      .epx-side-input__label--has-suffix { gap: 4px; }
      .epx-side-input__label--icon { color: var(--epx-text-muted); }
      .epx-bp-label-icon {
        display: inline-flex; align-items: center; flex-shrink: 0;
        opacity: 0.5; color: #fff;
        margin-right: auto; padding-left: 2px;
      }
      .epx-bp-label-icon svg { width: 10px; height: 10px; }
      .epx-spacing-ctrl__label { display: flex; align-items: center; gap: 5px; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: clip; position: relative; }
      .epx-side-input__num {
        flex: 1; min-width: 40px; border: none; background: transparent;
        color: var(--epx-text); font-size: 12px; padding: 0 4px;
        text-align: right; outline: none; -moz-appearance: textfield;
      }
      .epx-side-input__num::-webkit-inner-spin-button,
      .epx-side-input__num::-webkit-outer-spin-button { -webkit-appearance: none; }
      .epx-side-input__num:disabled { color: var(--epx-text-faint); }
      .epx-side-input__unit-wrap { position: relative; flex-shrink: 0; }
      .epx-side-input__unit-btn {
        background: none; border: none; border-left: 1px solid var(--epx-border-subtle);
        cursor: pointer; color: var(--epx-text-faint); font-size: 10px; font-weight: 600;
        padding: 0 6px; height: 28px; min-width: 34px; text-align: center;
        transition: color 0.1s, background 0.1s;
      }
      .epx-side-input__unit-btn:hover { color: var(--epx-accent); }
      .epx-side-input__unit-btn--icon { display: flex; align-items: center; justify-content: center; }
      .epx-side-input__num--custom::placeholder { font-style: italic; }

      /* ── UnitDropdown ── */
      .epx-unit-dropdown {
        position: absolute; top: calc(100% + 3px); right: 0;
        background: var(--epx-surface); border: 1px solid var(--epx-border);
        border-radius: 6px; box-shadow: 0 6px 20px rgba(0,0,0,0.15);
        z-index: 200; display: flex; flex-direction: column;
        min-width: 60px; padding: 3px;
      }
      .epx-unit-dropdown__item {
        background: none; border: none; cursor: pointer; color: var(--epx-text-mid);
        font-size: 11px; font-weight: 500; padding: 5px 10px;
        text-align: left; border-radius: 4px; transition: background 0.1s, color 0.1s;
      }
      .epx-unit-dropdown__item:hover { background: var(--epx-hover-bg); color: var(--epx-text); }
      .epx-unit-dropdown__item.is-active { color: var(--epx-accent); font-weight: 700; }
      .epx-unit-dropdown__sep { height: 1px; background: var(--epx-border-subtle); margin: 3px 4px; }
      .epx-unit-dropdown__item--pen { display: flex; align-items: center; justify-content: center; padding: 5px 0; }

      /* ── FieldRow ── */
      .epx-field-group {
        outline: 1px solid var(--epx-border); border-radius: 5px;
        background: var(--epx-input-bg); overflow: visible; width: 100%;
      }
      .epx-spacing-ctrl__row > .epx-field-group { flex: 1; min-width: 0; width: auto; }
      .epx-side-input__label--row {
        flex: 0 0 auto; width: auto; justify-content: flex-start; padding: 0 8px;
        font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0;
        cursor: default; color: var(--epx-text-faint); border-right: none;
        text-align: left; line-height: 1; white-space: nowrap;
      }
      .epx-side-input__label--row:hover { color: var(--epx-text-faint); background: none; }
      .epx-side-input__label--scrub:hover { color: var(--epx-accent); }
      .epx-panel-divider { height: 1px; background: var(--epx-border); margin: 2px 0; }
      .epx-row-label--section { text-transform: uppercase; letter-spacing: 0.06em; font-size: 10px; font-weight: 700; color: var(--epx-text-faint); }
      .epx-row-label--color { color: var(--epx-text-faint); }
      /* Dirty state — label lightens toward white */
      .epx-spacing-ctrl.is-dirty .epx-side-input__label--full,
      .epx-spacing-ctrl.is-dirty .epx-spacing-ctrl__label,
      .epx-field-group.is-dirty .epx-side-input__label--row,
      .epx-field.is-dirty .epx-field__label {
        color: color-mix(in srgb, var(--epx-text-faint), white 45%);
      }
      .epx-spacing-ctrl.is-dirty .epx-side-input__label:hover {
        color: color-mix(in srgb, var(--epx-text-faint), white 45%);
      }
      .epx-field-row__select-wrap { flex: 0 0 auto; position: relative; width: fit-content; margin-left: auto; }
      .epx-field-row__select-btn {
        width: 100%; height: 28px; border: none; background: transparent;
        display: flex; align-items: center; justify-content: flex-end; gap: 5px;
        padding: 0 8px; cursor: pointer; color: var(--epx-text); font-size: 12px;
        transition: color 0.1s;
      }
      .epx-field-row__select-btn:hover { color: var(--epx-accent); }
      .epx-field-row__select-btn > span:first-child {
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        min-width: 0; max-width: 160px; flex: 0 1 auto;
      }
      .epx-field-row__select-btn--pen { color: var(--epx-text-muted); }
      .epx-field-row__select-caret { font-size: 9px; color: var(--epx-text-faint); flex-shrink: 0; }

      /* ── BorderControl ── */
      .epx-border-style-row {
        display: grid; grid-template-columns: 1fr 1fr;
        border-top: 1px solid var(--epx-border-subtle);
      }
      .epx-border-style-cell {
        display: flex; align-items: center; height: 28px;
        border-right: 1px solid var(--epx-border-subtle);
      }
      .epx-border-style-cell > .epx-side-input__label--row { width: auto; flex-shrink: 0; }
      .epx-border-style-btn { width: 100%; }
      .epx-border-mixed {
        flex: 1; font-size: 11px; color: var(--epx-text-faint);
        font-style: italic; text-align: right; padding: 0 8px;
      }
      .epx-border-color-cell {
        display: flex; align-items: center; justify-content: flex-end; gap: 6px; height: 28px;
        padding: 0 8px; position: relative; overflow: visible;
      }

      /* Typography expanded — truncate sub-row labels with ellipsis */
      .epx-typo-ctrl.epx-spacing-ctrl .epx-spacing-ctrl__expanded .epx-side-input__label--row,
      .epx-typo-ctrl.epx-spacing-ctrl .epx-spacing-ctrl__expanded .epx-side-input__label--full {
        display: block; min-width: 0; flex-shrink: 1;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        line-height: 28px; text-align: left;
      }
      .epx-border-color-swatch {
        width: 14px; height: 14px; border-radius: 2px; flex-shrink: 0;
        border: 1px solid rgba(128,128,128,0.3); cursor: pointer;
      }
      .epx-border-color-hex {
        font-size: 10px; color: var(--epx-text-muted); font-family: monospace;
      }


      /* ── Stateful control wrapper (toggle + control grouped) ── */
      .epx-stateful-ctrl { display: flex; flex-direction: column; gap: 1px; }

      /* ── State toggle (Normal / Hover) ── */
      .epx-state-toggle {
        display: flex; gap: 2px;
        outline: 1px solid var(--epx-border); border-radius: 5px;
        background: var(--epx-ctrl-bg); overflow: visible;
        padding: 2px; margin: 0 0 3px;
      }
      .epx-state-toggle__btn {
        flex: 1; padding: 3px 0; font-size: 11px; border-radius: 4px;
        border: none; background: transparent; color: var(--epx-text-faint);
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: color 0.1s, background 0.1s;
      }
      .epx-state-toggle__btn.is-active {
        background: var(--epx-surface-2); color: var(--epx-text);
      }
      .epx-state-header {
        display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 0 0 3px;
      }
      .epx-state-header .epx-state-toggle,
      .epx-state-header .epx-blk-theme-toggle { margin: 0; }
      .epx-blk-theme-toggle {
        display: flex; gap: 2px;
        outline: 1px solid var(--epx-border); border-radius: 5px;
        background: var(--epx-ctrl-bg); overflow: visible;
        padding: 2px; margin: 0 0 3px;
      }
      .epx-blk-theme-toggle > * {
        flex: 1; height: 100%; font-size: 11px; border-radius: 4px;
        border: none; background: transparent; color: var(--epx-text-faint);
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: color 0.1s, background 0.1s;
      }
      .epx-blk-theme-toggle > *.is-active {
        background: var(--epx-surface-2); color: var(--epx-text);
      }

      /* ── Tooltip ── */
      [data-tooltip] { position: relative; }
      .epx-icon-btn-group [data-tooltip]:last-child::after { left: auto; right: 0; transform: none; }
      [data-tooltip]::after {
        content: attr(data-tooltip);
        position: absolute; top: calc(100% + 4px); left: 50%;
        transform: translateX(-50%);
        background: var(--epx-surface-2); color: var(--epx-text);
        font-size: 10px; line-height: 1; padding: 3px 7px;
        border-radius: 4px; white-space: nowrap; pointer-events: none;
        border: 1px solid var(--epx-border);
        opacity: 0; transition: opacity 0.12s; z-index: 9999;
      }
      [data-tooltip]:hover::after { opacity: 1; }

      /* ── ColorPicker ── */
      .epx-colorpicker {
        position: fixed; width: 256px;
        background: var(--epx-surface); border: 1px solid var(--epx-border);
        border-radius: 8px; box-shadow: 0 8px 28px rgba(0,0,0,0.22);
        z-index: 9999; overflow: hidden;
      }
      .epx-colorpicker__field {
        position: relative; height: 150px; cursor: crosshair; user-select: none;
      }
      .epx-colorpicker__field-white {
        position: absolute; inset: 0;
        background: linear-gradient(to right, #fff, transparent);
      }
      .epx-colorpicker__field-black {
        position: absolute; inset: 0;
        background: linear-gradient(to bottom, transparent, #000);
      }
      .epx-colorpicker__field-handle {
        position: absolute; width: 12px; height: 12px; border-radius: 50%;
        border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.5);
        transform: translate(-50%, -50%); pointer-events: none;
      }
      .epx-colorpicker__sliders { padding: 8px 10px 4px; display: flex; flex-direction: column; gap: 6px; }
      .epx-colorpicker__hue {
        position: relative; height: 10px; border-radius: 5px; cursor: pointer; user-select: none;
        background: linear-gradient(to right,
          hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%),
          hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%));
      }
      .epx-colorpicker__alpha-track {
        position: relative; height: 10px; border-radius: 5px; cursor: pointer; user-select: none;
        background-image: linear-gradient(45deg, #aaa 25%, transparent 25%),
          linear-gradient(-45deg, #aaa 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #aaa 75%),
          linear-gradient(-45deg, transparent 75%, #aaa 75%);
        background-size: 6px 6px;
        background-position: 0 0, 0 3px, 3px -3px, -3px 0;
        overflow: hidden;
      }
      .epx-colorpicker__alpha-fill { position: absolute; inset: 0; }
      .epx-colorpicker__slider-thumb {
        position: absolute; top: 50%; width: 14px; height: 14px;
        background: #fff; border-radius: 50%;
        border: 2px solid rgba(0,0,0,0.25); box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        transform: translate(-50%, -50%); pointer-events: none;
      }
      .epx-colorpicker__inputs {
        display: flex; align-items: center; gap: 5px; padding: 6px 10px 10px;
      }
      .epx-colorpicker__eyedrop {
        flex-shrink: 0; width: 26px; height: 26px; border-radius: 4px;
        border: 1px solid var(--epx-border); background: none; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        color: var(--epx-text-muted); transition: color 0.1s, border-color 0.1s;
      }
      .epx-colorpicker__eyedrop:hover { color: var(--epx-text); border-color: var(--epx-text-muted); }
      .epx-colorpicker__fmt-btn {
        flex-shrink: 0; height: 26px; padding: 0 6px;
        border: 1px solid var(--epx-border); border-radius: 4px;
        background: var(--epx-input-bg); color: var(--epx-text-faint);
        font-size: 9px; font-weight: 700; letter-spacing: 0.06em;
        text-transform: uppercase; cursor: pointer;
        transition: color 0.1s, border-color 0.1s;
      }
      .epx-colorpicker__fmt-btn:hover { color: var(--epx-accent); border-color: var(--epx-accent); }
      .epx-colorpicker__fmt-inputs {
        flex: 1; min-width: 0; display: flex; align-items: stretch; height: 26px;
        background: var(--epx-input-bg); border: 1px solid var(--epx-border);
        border-radius: 4px; overflow: hidden;
      }
      .epx-colorpicker__fmt-input {
        flex: 1; min-width: 0; border: none; background: transparent;
        color: var(--epx-text); font-size: 11px; font-family: monospace;
        text-align: center; outline: none; padding: 0 2px;
        -moz-appearance: textfield;
      }
      .epx-colorpicker__fmt-input::-webkit-inner-spin-button,
      .epx-colorpicker__fmt-input::-webkit-outer-spin-button { -webkit-appearance: none; }
      .epx-colorpicker__fmt-input:not(:first-child) { border-left: 1px solid var(--epx-border-subtle); }
      .epx-colorpicker__alpha-field {
        display: flex; align-items: center; flex-shrink: 0;
        background: var(--epx-input-bg); border: 1px solid var(--epx-border);
        border-radius: 4px; padding: 0 5px; height: 26px; width: 50px;
      }
      .epx-colorpicker__alpha-field span { font-size: 11px; color: var(--epx-text-faint); }
      .epx-colorpicker__alpha-input {
        flex: 1; min-width: 0; border: none; background: transparent;
        color: var(--epx-text); font-size: 11px; text-align: right; outline: none;
        -moz-appearance: textfield;
      }
      .epx-colorpicker__alpha-input::-webkit-inner-spin-button,
      .epx-colorpicker__alpha-input::-webkit-outer-spin-button { -webkit-appearance: none; }

      .epx-json-array { display: flex; flex-direction: column; gap: 6px; }
      .epx-json-array__header { display: flex; align-items: center; justify-content: space-between; }
      .epx-json-array__count { font-size: 11px; color: var(--epx-text-faint); }
      .epx-json-array__list { display: flex; flex-direction: column; gap: 4px; }
      .epx-json-array__item { border: 1px solid var(--epx-border); border-radius: 6px; overflow: hidden; }
      .epx-json-array__item.is-expanded { border-color: var(--epx-accent-light); }
      .epx-json-array__item-header { display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; background: var(--epx-surface-2); cursor: pointer; user-select: none; }
      .epx-json-array__item-header:hover { background: var(--epx-hover-bg); }
      .epx-json-array__item-label { font-size: 12px; font-weight: 600; color: var(--epx-text-2); }
      .epx-json-array__item-actions { display: flex; gap: 2px; }
      .epx-json-array__item-body { padding: 10px; display: flex; flex-direction: column; gap: 10px; background: var(--epx-surface); }

      .epx-btn-add {
        padding: 6px 12px; border: 1px dashed var(--epx-accent-light); border-radius: 6px;
        background: var(--epx-accent-bg); color: var(--epx-accent); font-size: 12px; font-weight: 600;
        cursor: pointer; text-align: center; transition: background 0.1s;
      }
      .epx-btn-add:hover { background: var(--epx-accent-bg-hover); }

      .epx-icon-btn {
        width: 24px; height: 24px; border: none; background: none; cursor: pointer;
        border-radius: 4px; display: flex; align-items: center; justify-content: center;
        font-size: 14px; padding: 0; color: var(--epx-text-mid);
      }
      .epx-icon-btn:hover:not(:disabled) { background: var(--epx-border); }
      .epx-icon-btn.is-active { background: var(--epx-border); color: var(--epx-text); }
      .epx-icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      .epx-icon-btn--danger:hover:not(:disabled) { background: #fee2e2; color: #dc2626; }
      [data-mode="dark"] .epx-icon-btn--danger:hover:not(:disabled) { background: #3b0f0f; }
      .epx-icon-btn-group {
        display: flex; gap: 1px; margin-left: auto; flex-shrink: 0;
        border-radius: 5px; padding: 2px;
      }

      /* ── BackgroundControl ── */
      .epx-bg-ctrl__card {
        outline: 1px solid var(--epx-border);
        border-radius: 5px;
        background: var(--epx-input-bg);
      }
      .epx-bg-ctrl__type-tabs {
        display: flex; border-top: 1px solid var(--epx-border-subtle);
      }
      .epx-bg-ctrl__type-tab {
        flex: 1; height: 28px; border: none; background: none; cursor: pointer;
        color: var(--epx-text-faint); display: flex; align-items: center; justify-content: center;
        border-bottom: 2px solid transparent; transition: color 0.15s, border-color 0.15s;
      }
      .epx-bg-ctrl__type-tab:hover { color: var(--epx-text-mid); }
      .epx-bg-ctrl__type-tab.is-active { color: var(--epx-accent); border-bottom-color: var(--epx-accent); }
      .epx-bg-ctrl__body { border-top: 1px solid var(--epx-border-subtle); }
      .epx-layout-ctrl__body .epx-side-input:first-child { border-top: none; }
      .epx-layout-ctrl__body { container-type: inline-size; }
      @container (max-width: 280px) {
        .epx-layout-ctrl__body .epx-side-input { flex-wrap: wrap; height: auto; }
        .epx-layout-ctrl__body .epx-side-input__label--row { padding: 8px; }
        .epx-layout-ctrl__body .epx-icon-btn-group {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
          width: 100%; margin-left: 0;
        }
        .epx-layout-ctrl__body .epx-icon-btn { width: 100%; }
      }

      .epx-bg-ctrl__color-row {
        display: flex; align-items: center; gap: 6px; height: 28px;
        padding: 0 8px; position: relative; overflow: visible;
      }
      .epx-bg-ctrl__alpha-label { font-size: 10px; color: var(--epx-text-faint); flex-shrink: 0; }

      .epx-bg-ctrl__swatch {
        width: 14px; height: 14px; border-radius: 2px; flex-shrink: 0;
        border: 1px solid rgba(128,128,128,0.3); cursor: pointer; padding: 0;
        background-image: linear-gradient(45deg,#aaa 25%,transparent 25%),
          linear-gradient(-45deg,#aaa 25%,transparent 25%),
          linear-gradient(45deg,transparent 75%,#aaa 75%),
          linear-gradient(-45deg,transparent 75%,#aaa 75%);
        background-size: 6px 6px;
        background-position: 0 0, 0 3px, 3px -3px, -3px 0;
        overflow: hidden;
      }
      .epx-bg-ctrl__swatch-fill { width: 100%; height: 100%; display: block; }
      .epx-bg-ctrl__hex { font-size: 10px; color: var(--epx-text-muted); font-family: monospace; flex: 1; }

      .epx-bg-ctrl__stop {
        display: flex; align-items: center; gap: 5px; height: 28px;
        padding: 0 8px; border-top: 1px solid var(--epx-border-subtle);
        position: relative; overflow: visible;
      }
      .epx-bg-ctrl__stop-label {
        font-size: 10px; font-weight: 700; color: var(--epx-text-faint);
        text-transform: uppercase; letter-spacing: 0.05em; flex-shrink: 0;
      }
      .epx-bg-ctrl__stop-pos {
        width: 36px; border: none; background: transparent; color: var(--epx-text);
        font-size: 12px; text-align: right; outline: none; -moz-appearance: textfield;
        flex-shrink: 0;
      }
      .epx-bg-ctrl__stop-pos::-webkit-inner-spin-button,
      .epx-bg-ctrl__stop-pos::-webkit-outer-spin-button { -webkit-appearance: none; }
      .epx-bg-ctrl__stop-unit { font-size: 10px; color: var(--epx-text-faint); flex-shrink: 0; }
      .epx-bg-ctrl__stop-remove {
        background: none; border: none; cursor: pointer; color: var(--epx-text-faint);
        padding: 0; display: flex; align-items: center; transition: color 0.1s; flex-shrink: 0;
      }
      .epx-bg-ctrl__stop-remove:hover:not(:disabled) { color: #dc2626; }
      .epx-bg-ctrl__stop-remove:disabled { opacity: 0.3; cursor: not-allowed; }

      .epx-bg-ctrl__add-btn {
        margin: 5px 8px; padding: 5px 0; border: 1px dashed var(--epx-accent-light);
        border-radius: 5px; background: var(--epx-accent-bg); color: var(--epx-accent);
        font-size: 11px; font-weight: 600; cursor: pointer; text-align: center;
        transition: background 0.1s; width: calc(100% - 16px);
      }
      .epx-bg-ctrl__add-btn:hover:not(:disabled) { background: var(--epx-accent-bg-hover); }
      .epx-bg-ctrl__add-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .epx-bg-ctrl__add-btn--media { margin-top: 6px; }

      .epx-bg-ctrl__grad-preview {
        position: relative; height: 6px; margin: 8px 8px 14px; border-radius: 3px;
        border: 1px solid var(--epx-border-subtle); overflow: visible;
      }
      .epx-bg-ctrl__grad-marker {
        position: absolute; top: 50%; transform: translate(-50%, -50%);
        width: 10px; height: 16px; cursor: ew-resize; display: flex;
        flex-direction: column; align-items: center; gap: 1px;
        filter: drop-shadow(0 1px 2px rgba(120,120,120,0.5));
      }
      .epx-bg-ctrl__grad-marker-arrow {
        width: 0; height: 0; flex-shrink: 0;
      }
      .epx-bg-ctrl__grad-marker-arrow--top {
        border-left: 5px solid transparent; border-right: 5px solid transparent;
        border-bottom: 6px solid currentColor; margin-bottom: -1px;
      }
      .epx-bg-ctrl__grad-marker-arrow--bottom {
        border-left: 5px solid transparent; border-right: 5px solid transparent;
        border-top: 6px solid currentColor; margin-top: -1px;
      }

      .epx-bg-ctrl__media-row {
        display: flex; align-items: center; gap: 7px; min-height: 36px;
        padding: 4px 8px; border-top: 1px solid var(--epx-border-subtle);
      }
      .epx-bg-ctrl__thumb {
        width: 25px; height: 25px; border-radius: 3px; object-fit: cover; flex-shrink: 0;
        border: 1px solid var(--epx-border);
      }
      .epx-bg-ctrl__thumb-placeholder {
        width: 25px; height: 25px; border-radius: 3px; flex-shrink: 0;
        background: var(--epx-surface-2); border: 1px dashed var(--epx-border);
        display: flex; align-items: center; justify-content: center;
        color: var(--epx-text-faint);
      }
      .epx-bg-ctrl__media-name {
        flex: 1; font-size: 11px; color: var(--epx-text-2);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .epx-bg-ctrl__media-btn {
        flex-shrink: 0; padding: 3px 8px; border: 1px solid var(--epx-border);
        border-radius: 4px; background: var(--epx-input-bg); color: var(--epx-text-mid);
        font-size: 11px; font-weight: 600; cursor: pointer;
        transition: color 0.1s, border-color 0.1s;
      }
      .epx-bg-ctrl__media-btn:hover { color: var(--epx-accent); border-color: var(--epx-accent); }

      .epx-media-card {
        display: flex; flex-direction: column; gap: 6px;
        padding: 8px; border-top: 1px solid var(--epx-border-subtle);
      }
      .epx-media-card--boxed {
        border-top: none;
        outline: 1px solid var(--epx-border); border-radius: 5px;
        background: var(--epx-input-bg); width: 100%;
      }
      .epx-media-card__preview {
        width: 100%; aspect-ratio: 16 / 10;
        border-radius: 4px; border: 1px solid var(--epx-border);
        background: var(--epx-surface-2);
        overflow: hidden; display: flex; align-items: center; justify-content: center;
        padding: 0;
      }
      .epx-media-card__preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .epx-media-card__preview--empty {
        border: 1px dashed var(--epx-border);
        cursor: pointer; color: var(--epx-text-faint);
        transition: border-color 0.1s, color 0.1s, background 0.1s;
      }
      .epx-media-card__preview--empty:hover {
        border-color: var(--epx-accent); color: var(--epx-accent);
        background: var(--epx-accent-bg);
      }
      .epx-media-card__empty-inner {
        display: flex; flex-direction: column; align-items: center; gap: 6px;
      }
      .epx-media-card__empty-label { font-size: 11px; font-weight: 600; }
      .epx-media-card__name {
        font-size: 11px; color: var(--epx-text-2);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .epx-media-card__actions { display: flex; align-items: center; gap: 6px; }
      .epx-media-card__btn {
        flex: 1; padding: 5px 0; border: 1px solid var(--epx-border);
        border-radius: 4px; background: var(--epx-input-bg); color: var(--epx-text-mid);
        font-size: 11px; font-weight: 600; cursor: pointer;
        transition: color 0.1s, border-color 0.1s;
      }
      .epx-media-card__btn:hover { color: var(--epx-accent); border-color: var(--epx-accent); }
      .epx-media-card__remove {
        flex-shrink: 0; padding: 5px 8px;
        background: none; border: 1px solid var(--epx-border); border-radius: 4px;
        color: var(--epx-text-faint); cursor: pointer;
        display: flex; align-items: center; transition: color 0.1s, border-color 0.1s;
      }
      .epx-media-card__remove:hover { color: #dc2626; border-color: #dc2626; }

      .epx-bg-ctrl__src-toggle {
        display: flex; gap: 4px; padding: 6px 8px;
        border-top: 1px solid var(--epx-border-subtle);
      }
      .epx-bg-ctrl__src-btn {
        flex: 1; padding: 4px 0; border: 1px solid var(--epx-border); border-radius: 4px;
        background: var(--epx-input-bg); color: var(--epx-text-faint); font-size: 11px;
        font-weight: 600; cursor: pointer; transition: all 0.1s;
      }
      .epx-bg-ctrl__src-btn.is-active {
        background: var(--epx-accent-bg); color: var(--epx-accent);
        border-color: var(--epx-accent-light);
      }

      .epx-bg-ctrl__url-row {
        display: flex; align-items: center; height: 28px;
        padding: 0 8px; gap: 6px; border-top: 1px solid var(--epx-border-subtle);
      }
      .epx-bg-ctrl__url-input {
        flex: 1; border: none; background: transparent; color: var(--epx-text);
        font-size: 12px; outline: none; min-width: 0; text-align: right;
      }
      .epx-bg-ctrl__url-input::placeholder { color: var(--epx-text-faint); font-style: italic; }

      .epx-bg-ctrl__slides { display: flex; flex-direction: column; }
      .epx-bg-ctrl__slide {
        display: flex; align-items: center; gap: 6px; height: 36px;
        padding: 0 8px; border-top: 1px solid var(--epx-border-subtle);
      }
      .epx-bg-ctrl__slide-drag {
        color: var(--epx-text-faint); cursor: grab; flex-shrink: 0;
        display: flex; align-items: center; touch-action: none;
      }
      .epx-bg-ctrl__slide-drag:active { cursor: grabbing; }
      .epx-bg-ctrl__slide-name {
        flex: 1; font-size: 11px; color: var(--epx-text-2);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .epx-bg-ctrl__slide-remove {
        background: none; border: none; cursor: pointer; color: var(--epx-text-faint);
        padding: 0; display: flex; align-items: center; transition: color 0.1s; flex-shrink: 0;
      }
      .epx-bg-ctrl__slide-remove:hover { color: #dc2626; }

      /* ── Toggle switch ── */
      .epx-toggle { display: inline-flex; align-items: center; cursor: pointer; }
      .epx-toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
      .epx-toggle__track {
        position: relative; width: 28px; height: 16px;
        background: var(--epx-border); border-radius: 999px;
        transition: background 0.15s; flex-shrink: 0;
      }
      .epx-toggle input:checked ~ .epx-toggle__track { background: var(--epx-accent); }
      .epx-toggle__thumb {
        position: absolute; top: 2px; left: 2px;
        width: 12px; height: 12px; border-radius: 50%;
        background: #fff; transition: transform 0.15s;
        box-shadow: 0 1px 2px rgba(0,0,0,0.25);
      }
      .epx-toggle input:checked ~ .epx-toggle__track .epx-toggle__thumb { transform: translateX(12px); }

      /* ── MediaPicker modal ── */
      .epx-media-picker {
        position: fixed; inset: 0; z-index: 9998;
        background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center;
      }
      .epx-media-picker__panel {
        width: 540px; max-height: 72vh; background: var(--epx-surface);
        border: 1px solid var(--epx-border); border-radius: 10px;
        box-shadow: 0 16px 48px rgba(0,0,0,0.3);
        display: flex; flex-direction: column; overflow: hidden;
        position: relative;
      }
      .epx-media-picker__header {
        display: flex; align-items: center; gap: 8px; padding: 11px 14px;
        border-bottom: 1px solid var(--epx-border); flex-shrink: 0;
      }
      .epx-media-picker__title { font-size: 14px; font-weight: 700; color: var(--epx-text-strong); flex: 1; }
      .epx-media-picker__close {
        background: none; border: none; cursor: pointer; color: var(--epx-text-faint);
        padding: 4px; border-radius: 4px; display: flex; align-items: center;
        transition: color 0.1s;
      }
      .epx-media-picker__close:hover { color: var(--epx-text); }
      .epx-media-picker__body { flex: 1; overflow-y: auto; padding: 12px; scrollbar-width: thin; scrollbar-color: var(--epx-text-muted) transparent; }
      .epx-media-picker__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      .epx-media-picker__item {
        aspect-ratio: 1; border-radius: 6px; overflow: hidden; cursor: pointer;
        border: 2px solid transparent; position: relative;
        background: var(--epx-surface-2); transition: border-color 0.15s;
      }
      .epx-media-picker__item:hover { border-color: var(--epx-accent-light); }
      .epx-media-picker__item.is-selected { border-color: var(--epx-accent); }
      .epx-media-picker__item img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .epx-media-picker__item-check {
        position: absolute; top: 4px; right: 4px; width: 18px; height: 18px;
        background: var(--epx-accent); border-radius: 50%; display: flex;
        align-items: center; justify-content: center;
        opacity: 0; transition: opacity 0.15s;
      }
      .epx-media-picker__item.is-selected .epx-media-picker__item-check { opacity: 1; }
      .epx-media-picker__item-name {
        position: absolute; bottom: 0; left: 0; right: 0; padding: 4px 6px;
        background: rgba(0,0,0,0.6); color: #fff; font-size: 10px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .epx-media-picker__empty {
        text-align: center; color: var(--epx-text-faint); padding: 40px 0; font-size: 13px;
      }
      .epx-media-picker__load-more {
        width: 100%; margin-top: 10px; padding: 8px 0;
        border: 1px solid var(--epx-border); border-radius: 6px;
        background: var(--epx-input-bg); color: var(--epx-text-mid);
        font-size: 12px; font-weight: 600; cursor: pointer; transition: color 0.1s;
      }
      .epx-media-picker__load-more:hover { color: var(--epx-accent); }
      .epx-media-picker__footer {
        display: flex; align-items: center; justify-content: flex-end; gap: 8px;
        padding: 10px 14px; border-top: 1px solid var(--epx-border); flex-shrink: 0;
      }
      .epx-media-picker__confirm {
        padding: 6px 14px; background: var(--epx-accent); color: #fff;
        border: none; border-radius: 6px; font-size: 13px; font-weight: 600;
        cursor: pointer; transition: background 0.1s;
      }
      .epx-media-picker__confirm:hover { background: var(--epx-accent-hover); }
      .epx-media-picker__cancel {
        padding: 6px 14px; background: none; color: var(--epx-text-mid);
        border: 1px solid var(--epx-border); border-radius: 6px; font-size: 13px;
        cursor: pointer; transition: border-color 0.1s, color 0.1s;
      }
      .epx-media-picker__cancel:hover { color: var(--epx-text); border-color: var(--epx-text-muted); }

      /* upload button in header */
      .epx-media-picker__upload-btn {
        flex-shrink: 0; display: flex; align-items: center; padding: 4px 10px;
        border: 1px solid var(--epx-border); border-radius: 5px;
        background: var(--epx-input-bg); color: var(--epx-text-mid);
        font-size: 11px; font-weight: 600; cursor: pointer; transition: color 0.1s, border-color 0.1s;
      }
      .epx-media-picker__upload-btn:hover { color: var(--epx-accent); border-color: var(--epx-accent); }

      /* drag-over state */
      .epx-media-picker__panel--drag { outline: 2px dashed var(--epx-accent); outline-offset: -3px; }
      .epx-media-picker__drop-overlay {
        position: absolute; inset: 0; z-index: 10; border-radius: 10px;
        background: rgba(var(--epx-accent-rgb, 99,102,241), 0.12);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 8px; color: var(--epx-accent); font-size: 14px; font-weight: 600;
        pointer-events: none;
      }

      /* upload progress list */
      .epx-media-picker__uploads {
        border-bottom: 1px solid var(--epx-border); padding: 6px 12px;
        display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;
        max-height: 96px; overflow-y: auto;
      }
      .epx-media-picker__upload-item {
        display: flex; align-items: center; gap: 8px; min-height: 20px;
      }
      .epx-media-picker__upload-name {
        flex: 1; font-size: 11px; color: var(--epx-text-2);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .epx-media-picker__upload-bar {
        width: 80px; height: 4px; border-radius: 2px;
        background: var(--epx-border); overflow: hidden; flex-shrink: 0;
      }
      .epx-media-picker__upload-fill {
        height: 100%; border-radius: 2px;
        background: var(--epx-accent); transition: width 0.1s;
      }
      .epx-media-picker__upload-done { color: var(--epx-accent); font-size: 12px; font-weight: 700; flex-shrink: 0; }
      .epx-media-picker__upload-error { color: #dc2626; font-size: 11px; flex-shrink: 0; }

      /* video thumbnail placeholder in grid */
      .epx-media-picker__video-thumb {
        width: 100%; height: 100%;
        background: #1e293b; display: flex; align-items: center; justify-content: center;
        color: rgba(255,255,255,0.5);
      }

      .epx-builder--loading, .epx-builder--error {
        position: fixed; inset: 0; z-index: 9999; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 12px; color: var(--epx-text-muted); background: var(--epx-bg);
        color-scheme: light dark;
      }
      .epx-spinner {
        width: 32px; height: 32px; border: 3px solid var(--epx-spinner-track);
        border-top-color: var(--epx-accent); border-radius: 50%;
        animation: epx-spin 0.8s linear infinite;
      }
      @keyframes epx-spin { to { transform: rotate(360deg); } }
      .epx-error { color: #ef4444; }

      /* ── Breakpoint switcher ── */
      .epx-bp-switcher {
        display: flex;
        gap: 2px;
        align-items: center;
        background: var(--epx-input-bg);
        border: 1px solid var(--epx-input-border);
        border-radius: 6px;
        padding: 2px;
      }
      .epx-bp-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 26px;
        padding: 0;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 4px;
        cursor: pointer;
        color: var(--epx-text-muted);
        transition: background 0.1s, color 0.1s, border-color 0.1s;
        flex-shrink: 0;
      }
      .epx-bp-btn:hover {
        background: var(--epx-hover-bg);
        color: var(--epx-text);
      }
      .epx-bp-btn.is-active {
        background: var(--epx-accent);
        border-color: var(--epx-accent);
        color: #fff;
      }

      /* ── Canvas preview frame ── */
      .epx-canvas--preview {
        overflow-x: auto;
      }
      .epx-canvas__preview-frame {
        min-height: 100%;
      }
      .epx-canvas__list {
        position: relative;
        transform: translateZ(0);
      }
      body.epx-resizing,
      body.epx-resizing * { cursor: ew-resize !important; }
      body.epx-resizing .epx-canvas__preview-frame,
      body.epx-resizing .epx-canvas__list { pointer-events: none; }

      /* ── Canvas resizable (side drag handles) ── */
      .epx-canvas--resizable {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        overflow-x: auto;
        margin: 0 auto;
        justify-content: center;
      }
      .epx-canvas__side-handle {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        cursor: ew-resize;
        min-width: 18px;
        max-width: 18px;
        padding: 0 6px;
        position: relative;
        user-select: none;
      }
      .epx-canvas__side-handle--left {
        align-items: flex-end;
        border-right: 2px solid var(--epx-border);
      }
      .epx-canvas__side-handle--right {
        align-items: flex-start;
        border-left: 2px solid var(--epx-border);
      }
      .epx-canvas__side-handle:hover {
        background: var(--epx-hover-bg);
      }
      .epx-canvas__side-handle:hover .epx-canvas__side-grip {
        background: var(--epx-accent);
      }
      .epx-canvas__side-handle:hover + .epx-canvas__preview-frame,
      .epx-canvas__preview-frame + .epx-canvas__side-handle:hover {
        border-color: var(--epx-accent);
      }
      .epx-canvas__side-grip {
        width: 3px;
        height: 32px;
        background: var(--epx-border);
        border-radius: 2px;
        transition: background 0.15s;
        flex-shrink: 0;
      }
      .epx-canvas__size-label {
        font-size: 11px;
        color: var(--epx-text-muted);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        display: flex;
        align-items: center;
      }

      /* ── Settings panel (left panel page tab) ── */
      .epx-settings-panel {
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        overflow-y: auto;
        flex: 1;
      }
      .epx-settings-label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 27px;
        padding: 0 8px;
        border-bottom: 1px solid var(--epx-border-subtle);
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--epx-text-faint);
        opacity: 0.65;
      }
      .epx-settings-reset-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        padding: 0;
        background: transparent;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        color: var(--epx-text-muted);
        flex-shrink: 0;
      }
      .epx-settings-reset-btn:hover { color: var(--epx-accent); }
      .epx-bp-row {
        display: flex;
        align-items: center;
        min-height: 28px;
        border-top: 1px solid var(--epx-border-subtle);
        padding: 0 8px 0 0;
      }
      .epx-bp-row:first-child { border-top: none; }
      .epx-bp-row__label {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 1;
        min-width: 0;
        font-size: 11px;
        color: var(--epx-text);
        padding: 4px 8px;
        cursor: ew-resize;
        user-select: none;
      }
      .epx-bp-row__label:hover .epx-bp-row__name { color: var(--epx-accent); }
      .epx-bp-row__name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .epx-bp-row__check-wrap { display: flex; align-items: center; cursor: pointer; }
      .epx-bp-row__check {
        accent-color: var(--epx-accent);
        width: 12px;
        height: 12px;
        cursor: pointer;
        flex-shrink: 0;
      }
      .epx-bp-row__check-spacer { width: 12px; flex-shrink: 0; }
      .epx-bp-row .epx-side-input__num { width: 52px; flex-shrink: 0; }
      .epx-bp-row .epx-side-input__num:disabled { color: var(--epx-text-faint); }
      @container (max-width: 280px) {
        .epx-bp-row { flex-wrap: wrap; padding-right: 0; }
        .epx-bp-row__label { width: 100%; cursor: ew-resize; }
        .epx-bp-row .epx-side-input__num { max-width: 50px; }
      }
    `}</style>
  );
}
