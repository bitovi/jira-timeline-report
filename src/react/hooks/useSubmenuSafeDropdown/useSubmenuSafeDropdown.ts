import { useEffect, useRef, useState } from 'react';

/**
 * Open state for an @atlaskit `DropdownMenu` that contains a nested submenu.
 *
 * Atlaskit only closes the top layer on an outside click or item pick, so with a submenu open the
 * parent menu stays open. This closes it on any click outside its trigger (wrap the trigger in
 * `triggerContainerRef`) and outside every open dropdown popup, or on a submenu item pick.
 */
export const useSubmenuSafeDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Bubble phase so the clicked item's own onClick runs before the menu unmounts.
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (triggerContainerRef.current?.contains(target)) return;
      const isItemPick = !!target.closest('[role="menuitem"]:not([aria-haspopup])');
      if (target.closest('[id^="ds--dropdown--"]') && !isItemPick) return;
      setIsOpen(false);
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [isOpen]);

  return {
    triggerContainerRef,
    isOpen,
    onOpenChange: ({ isOpen }: { isOpen: boolean }) => setIsOpen(isOpen),
  };
};
