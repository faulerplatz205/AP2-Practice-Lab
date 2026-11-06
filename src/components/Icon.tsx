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
    trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z" /><path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
    chevron: <path d="M6 9l6 6 6-6" />,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></>,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    edit: <path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4" />,
    attr: <><ellipse cx="10" cy="13" rx="7" ry="5" /><path d="M19 3v6M16 6h6" /></>,
    trash: <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />,
    external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />,
    download: <path d="M12 3v12M7 10l5 5 5-5M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4" />,
    upload: <path d="M12 15V3M7 8l5-5 5 5M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4" />,
    disk: <><path d="M5 4h11l3 3v12a1 1 0 01-1 1H6a1 1 0 01-1-1z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></>,
    folder: <path d="M3 7a1 1 0 011-1h5l2 2h9a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1z" />,
    view: <path d="M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4" />,
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
