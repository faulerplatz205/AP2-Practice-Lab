import type { ReactElement } from "react";

/** Icon paths (24x24, stroke width 2). */
const PATHS = {
    select: <path d="M5 3l14 8-6 2-3 6z" />,
    arrow: <path d="M4 12h15M14 7l5 5-5 5" />,
    undo: <><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 010 12h-3" /></>,
    redo: <><path d="M15 14l5-5-5-5" /><path d="M20 9H10a6 6 0 000 12h3" /></>,
    check: <path d="M5 12l5 5L20 7" />,
    calc: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2" /></>,
    layout: <><rect x="3" y="4" width="6" height="5" /><rect x="15" y="4" width="6" height="5" /><rect x="15" y="15" width="6" height="5" /><path d="M9 6.5h6M12 6.5v11h3" /></>,
    image: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 16l5-5 4 4 3-3 6 6" /></>,
    save: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
    open: <path d="M12 20V9M7 14l5-5 5 5M5 4h14" />,
    trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z" /><path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
    chevron: <path d="M6 9l6 6 6-6" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    moon: <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" />,
    auto: <><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 010 16z" fill="currentColor" /></>,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></>,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    logo: <><rect x="3" y="4" width="7" height="6" rx="1" /><rect x="14" y="14" width="7" height="6" rx="1" /><path d="M10 7h4v10" /></>,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size }: { name: IconName; size?: number }): ReactElement {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {PATHS[name]}
        </svg>
    );
}
