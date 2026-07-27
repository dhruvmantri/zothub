import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Toasts are a dark panel pill in BOTH themes (component-library §06). Holding
 * one fixed register makes a toast read as something floating over the page
 * rather than another card that happens to be on top of it — and it means the
 * undo affordance keeps one appearance everywhere.
 *
 * `theme="dark"` is deliberate and not a bug: the panel tokens are
 * theme-independent, so letting sonner recolour per theme would fight them.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="bottom-center"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-panel group-[.toaster]:text-panel-ink group-[.toaster]:border-panel-line group-[.toaster]:rounded-pill group-[.toaster]:shadow-e3 group-[.toaster]:px-4 group-[.toaster]:py-3",
          description: "group-[.toast]:text-panel-ink-2",
          actionButton:
            "group-[.toast]:bg-transparent group-[.toast]:text-panel-accent-text group-[.toast]:font-semibold",
          cancelButton: "group-[.toast]:bg-panel-2 group-[.toast]:text-panel-ink-2",
          error: "group-[.toaster]:text-panel-ink",
          success: "group-[.toaster]:text-panel-ink",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
