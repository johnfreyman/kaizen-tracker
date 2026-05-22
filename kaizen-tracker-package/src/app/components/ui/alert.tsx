import * as React from "react";
import { useState } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Info, CheckCircle2, AlertTriangle, AlertCircle, X } from "lucide-react";

import { cn } from "./utils";

const alertVariants = cva(
  "relative w-full rounded-2xl border p-4 shadow-sm flex items-start gap-3.5 transition-all duration-300 transform backdrop-blur-md will-change-all hover:-translate-y-[1px] hover:shadow-md animate-in fade-in-0 slide-in-from-top-3 ease-out",
  {
    variants: {
      variant: {
        default: "bg-white/80 border-slate-200/60 text-slate-800",
        info: "bg-gradient-to-br from-blue-50/80 via-blue-50/40 to-indigo-50/50 border-blue-200/60 text-blue-900",
        success: "bg-gradient-to-br from-emerald-50/80 via-emerald-50/40 to-teal-50/50 border-emerald-200/60 text-emerald-900",
        warning: "bg-gradient-to-br from-amber-50/80 via-amber-50/40 to-yellow-50/50 border-amber-200/60 text-amber-900",
        destructive: "bg-gradient-to-br from-rose-50/80 via-rose-50/40 to-red-50/50 border-rose-200/60 text-rose-900",
        outline: "bg-transparent border-slate-300 text-slate-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const iconMap = {
  default: <Info className="size-5 text-slate-500 shrink-0 mt-0.5" />,
  info: <Info className="size-5 text-blue-600 shrink-0 mt-0.5 animate-pulse" />,
  success: <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />,
  destructive: <AlertCircle className="size-5 text-rose-600 shrink-0 mt-0.5" />,
  outline: <Info className="size-5 text-slate-500 shrink-0 mt-0.5" />,
};

export interface AlertProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof alertVariants> {
  dismissible?: boolean;
  onClose?: () => void;
  customIcon?: React.ReactNode;
  title?: string;
  description?: string;
}

function Alert({
  className,
  variant = "default",
  dismissible = false,
  onClose,
  customIcon,
  title,
  description,
  children,
  ...props
}: AlertProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsDismissed(true);
      if (onClose) onClose();
    }, 300);
  };

  const selectedVariant = variant || "default";
  const icon = customIcon !== undefined ? customIcon : iconMap[selectedVariant];

  const transitionStyles = isClosing
    ? "opacity-0 scale-95 max-h-0 p-0 m-0 border-transparent overflow-hidden pointer-events-none transition-all duration-300 ease-in-out"
    : "max-h-[500px] transition-all duration-300 ease-in-out";

  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(
        alertVariants({ variant }),
        transitionStyles,
        className
      )}
      {...props}
    >
      {icon && <div className="flex-shrink-0">{icon}</div>}
      
      <div className="flex-1 min-w-0 space-y-1">
        {title && <AlertTitle>{title}</AlertTitle>}
        {description && <AlertDescription>{description}</AlertDescription>}
        {children}
      </div>

      {(dismissible || onClose) && (
        <button
          onClick={handleClose}
          aria-label="Dismiss alert"
          className="flex-shrink-0 p-1 -mr-1 -mt-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 active:bg-slate-200/50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400/20"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-bold text-sm tracking-tight text-slate-900 leading-snug",
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-xs font-medium text-slate-600 leading-relaxed mt-0.5",
        className,
      )}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
