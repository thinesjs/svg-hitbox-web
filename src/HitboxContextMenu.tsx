import type { ReactNode } from "react";
import type { Hitbox } from "./types";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface HitboxContextMenuProps {
  children: ReactNode;
  selectedIds: string[];
  hitboxes: Hitbox[];
  clipboard: Hitbox[];
  onCopy: () => void;
  onPaste: (cursorSvgPoint?: { x: number; y: number }) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onBringToFront: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onSendToBack: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  onContextTarget: (e: React.MouseEvent) => void;
  contextSvgPoint: { x: number; y: number } | null;
}

export default function HitboxContextMenu({
  children,
  selectedIds,
  hitboxes,
  clipboard,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onBringToFront,
  onBringForward,
  onSendBackward,
  onSendToBack,
  onLock,
  onUnlock,
  onFlipHorizontal,
  onFlipVertical,
  onContextTarget,
  contextSvgPoint,
}: HitboxContextMenuProps) {
  const selectedHitboxes = hitboxes.filter((h) => selectedIds.includes(h.id));
  const hasSelection = selectedIds.length > 0;
  const isMulti = selectedIds.length > 1;
  const allLocked = selectedHitboxes.length > 0 && selectedHitboxes.every((h) => h.locked);
  const anyLocked = selectedHitboxes.some((h) => h.locked);
  const anyUnlocked = selectedHitboxes.some((h) => !h.locked);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={onContextTarget}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {hasSelection && (
          <ContextMenuItem onSelect={onCopy}>
            Copy<ContextMenuShortcut>⌘C</ContextMenuShortcut>
          </ContextMenuItem>
        )}
        {clipboard.length > 0 && (
          <ContextMenuItem onSelect={() => onPaste(contextSvgPoint ?? undefined)}>
            Paste<ContextMenuShortcut>⌘V</ContextMenuShortcut>
          </ContextMenuItem>
        )}
        {hasSelection && (
          <ContextMenuItem onSelect={onDuplicate}>
            Duplicate<ContextMenuShortcut>⌘D</ContextMenuShortcut>
          </ContextMenuItem>
        )}

        {hasSelection && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={onBringToFront}>Bring to Front</ContextMenuItem>
            <ContextMenuItem onSelect={onBringForward}>Bring Forward</ContextMenuItem>
            <ContextMenuItem onSelect={onSendBackward}>Send Backward</ContextMenuItem>
            <ContextMenuItem onSelect={onSendToBack}>Send to Back</ContextMenuItem>
          </>
        )}

        {isMulti && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={onFlipHorizontal}>Flip Horizontal</ContextMenuItem>
            <ContextMenuItem onSelect={onFlipVertical}>Flip Vertical</ContextMenuItem>
          </>
        )}

        {hasSelection && (
          <>
            <ContextMenuSeparator />
            {anyUnlocked && (
              <ContextMenuItem onSelect={onLock}>
                {isMulti ? "Lock All" : "Lock"}
              </ContextMenuItem>
            )}
            {anyLocked && (
              <ContextMenuItem onSelect={onUnlock}>
                {isMulti ? "Unlock All" : "Unlock"}
              </ContextMenuItem>
            )}
          </>
        )}

        {hasSelection && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={allLocked ? undefined : onDelete}
              disabled={allLocked}
              className={allLocked ? "text-muted-foreground" : "text-destructive"}
            >
              Delete<ContextMenuShortcut>⌫</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}

        {!hasSelection && clipboard.length === 0 && (
          <ContextMenuItem disabled className="text-muted-foreground">
            No actions available
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
