"use client";

import { Tooltip } from "antd";
import type { ComponentPropsWithoutRef } from "react";

type Props = Omit<ComponentPropsWithoutRef<"button">, "title" | "aria-label"> & {
  label: string;
  tooltip?: string;
};

export default function IconAction({ label, tooltip = label, disabled, children, ...props }: Props) {
  const button = <button type="button" {...props} aria-label={label} disabled={disabled}>{children}</button>;

  return <Tooltip title={tooltip} trigger={["hover", "focus"]} getPopupContainer={trigger => trigger.closest("dialog") ?? document.body}>
    {disabled
      ? <span className="inline-flex shrink-0 cursor-not-allowed [&>button]:pointer-events-none" tabIndex={0} aria-label={tooltip}>{button}</span>
      : button}
  </Tooltip>;
}
