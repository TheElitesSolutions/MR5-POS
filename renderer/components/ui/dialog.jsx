"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;
const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (<DialogPrimitive.Overlay ref={ref} className={cn("fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className)} {...props}/>));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;
const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => {
    const contentRef = React.useRef(null);
    React.useEffect(() => {
        // Remove aria-hidden from dialog when it's open to fix accessibility warning
        const dialogElement = contentRef.current?.closest('[role="dialog"]');
        if (dialogElement) {
            dialogElement.removeAttribute('aria-hidden');
            dialogElement.removeAttribute('data-aria-hidden');
        }
    }, []);
    return (<DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content ref={(node) => {
            if (typeof ref === 'function') {
                ref(node);
            }
            else if (ref) {
                ref.current = node;
            }
            if (contentRef) {
                contentRef.current = node;
            }
        }} className={cn("fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg", className)} onOpenAutoFocus={(e) => {
            // Prevent default auto-focus to avoid timing issues
            e.preventDefault();
            // Remove aria-hidden immediately when dialog opens
            const dialogElement = e.currentTarget.closest('[role="dialog"]');
            if (dialogElement) {
                dialogElement.removeAttribute('aria-hidden');
                dialogElement.removeAttribute('data-aria-hidden');
            }
            // Focus first input/button after a brief delay
            setTimeout(() => {
                if (e.currentTarget) {
                    const firstFocusable = e.currentTarget.querySelector('input, textarea, select, button');
                    if (firstFocusable && firstFocusable instanceof HTMLElement) {
                        firstFocusable.focus();
                    }
                }
            }, 50);
        }} {...props}>
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4"/>
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>);
});
DialogContent.displayName = DialogPrimitive.Content.displayName;
const DialogHeader = ({ className, ...props }) => (<div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props}/>);
DialogHeader.displayName = "DialogHeader";
const DialogFooter = ({ className, ...props }) => (<div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props}/>);
DialogFooter.displayName = "DialogFooter";
const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (<DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props}/>));
DialogTitle.displayName = DialogPrimitive.Title.displayName;
const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (<DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props}/>));
DialogDescription.displayName = DialogPrimitive.Description.displayName;
export { Dialog, DialogPortal, DialogOverlay, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, };
