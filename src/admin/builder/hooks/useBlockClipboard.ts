import { useCallback, useState } from "react";
import type { SectionBlock } from "../../../types.js";
import { findBlockById, deepCloneBlock } from "../../treeUtils.js";

/**
 * Block clipboard for copy / cut / paste / paste-settings. The full-block
 * clipboard stores a deep clone (with fresh ids) so paste produces a
 * disconnected branch. Settings clipboard stores just the config map.
 *
 * `sectionsRef` is read at copy-time, so the hook reads always see the
 * latest tree without re-creating callbacks on every dispatch.
 */
export function useBlockClipboard(sectionsRef: React.MutableRefObject<SectionBlock[]>) {
  const [clipboardBlock, setClipboardBlock] = useState<SectionBlock | null>(null);
  const [clipboardSettings, setClipboardSettings] = useState<Record<string, unknown> | null>(null);

  const copyBlock = useCallback((id: string) => {
    const block = findBlockById(id, sectionsRef.current);
    if (block) setClipboardBlock(deepCloneBlock(block));
  }, [sectionsRef]);

  const copySettings = useCallback((id: string) => {
    const block = findBlockById(id, sectionsRef.current);
    if (block) setClipboardSettings({ ...block.config });
  }, [sectionsRef]);

  return {
    clipboardBlock,
    clipboardSettings,
    copyBlock,
    copySettings,
    canPaste: clipboardBlock !== null,
    canPasteSettings: clipboardSettings !== null,
  };
}
