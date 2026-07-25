import add from './svg/add.svg?url'
import alignBottom from './svg/align_vertical_bottom.svg?url'
import alignMiddle from './svg/align_vertical_center.svg?url'
import alignTop from './svg/align_vertical_top.svg?url'
import appGraph from './svg/app-graph.svg?url'
import arrowLeftRight from './svg/arrow_left_right.svg?url'
import arrowRight from './svg/arrow-right.svg?url'
import check from './svg/check.svg?url'
import chevronDown from './svg/chevron_down.svg?url'
import chevronLeft from './svg/chevron_left.svg?url'
import chevronRight from './svg/chevron_right.svg?url'
import chevronUp from './svg/chevron-top.svg?url'
import close from './svg/close.svg?url'
import copy from './svg/content_copy.svg?url'
import cut from './svg/content_cut.svg?url'
import deleteIcon from './svg/delete.svg?url'
import fillColor from './svg/format_color_fill.svg?url'
import textColor from './svg/format_color_text.svg?url'
import font from './svg/format_font.svg?url'
import italic from './svg/format_italic.svg?url'
import formatPaint from './svg/format_paint.svg?url'
import fontSize from './svg/format_size.svg?url'
import strikethrough from './svg/format_strikethrough.svg?url'
import underline from './svg/format_underlined.svg?url'
import bold from './svg/format_bold.svg?url'
import alignCenter from './svg/format_align_center.svg?url'
import alignLeft from './svg/format_align_left.svg?url'
import alignRight from './svg/format_align_right.svg?url'
import fitToScreen from './svg/fit_to_screen.svg?url'
import gridOff from './svg/grid_off.svg?url'
import gridOn from './svg/grid_on.svg?url'
import help from './svg/help.svg?url'
import redo from './svg/history_redo.svg?url'
import undo from './svg/history_undo.svg?url'
import magnet from './svg/magnet.svg?url'
import maximize from './svg/maximize.svg?url'
import minimize from './svg/minimize.svg?url'
import minus from './svg/minus.svg?url'
import paste from './svg/content_paste.svg?url'
import restore from './svg/restore.svg?url'
import search from './svg/search.svg?url'

export const iconUrls = {
  add, alignBottom, alignCenter, alignLeft, alignMiddle, alignRight, alignTop,
  appGraph, arrowLeftRight, arrowRight, bold, check, chevronDown, chevronLeft,
  chevronRight, chevronUp, close, copy, cut, delete: deleteIcon, fillColor,
  fitToScreen, font, fontSize, formatPaint, gridOff, gridOn, help, italic,
  magnet, maximize, minimize, minus, paste, redo, restore, search,
  strikethrough, textColor, underline, undo,
} as const

export type IconName = keyof typeof iconUrls
