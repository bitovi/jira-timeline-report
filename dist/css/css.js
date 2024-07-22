import primitives from "./primitives.css" assert {type: 'css'};
import colors from "./colors.css" assert {type: 'css'};
import fonts from "./fonts.css" assert {type: 'css'};
import spacing from "./spacing.css" assert {type: 'css'};
import sheet from "./steerco-reporting.css" assert {type: 'css'};

document.adoptedStyleSheets = [primitives, colors,fonts, spacing, sheet];
