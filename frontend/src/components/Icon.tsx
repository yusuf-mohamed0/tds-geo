import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faDashboard, faFileLines, faGear, faUsers, faChartLine, faDollarSign,
  faChartBar, faListCheck, faStar, faBrain, faMicrophone, faCheck,
  faShield, faMessage, faBuilding, faGlobe, faImage, faKey,
  faPuzzlePiece, faWrench, faRobot, faLink, faUserShield,
  faRocket, faPen, faEye, faSearch, faBell, faClock,
  faCircleCheck, faCircleXmark, faTriangleExclamation, faSpinner,
  faTrash, faArrowLeft, faArrowRight, faPlus, faXmark,
  faThumbsUp, faThumbsDown, faComment, faEnvelope, faLock,
  faBook, faHome, faInfo, faCopy, faDownload, faUpload,
  faPlay, faPause, faStop, faRefresh, faFilter, faSort,
  faBars, faChevronLeft, faChevronRight, faChevronDown, faChevronUp,
  faCalendar, faPaperPlane, faMagic,
  faCube, faCubes, faDatabase, faCloud, faServer, faCode,
  faPalette, faLightbulb, faFlag, faTag, faTags, faFolder,
  faFolderOpen, faFile, faFileExport, faFileImport, faPrint,
  faQuestionCircle, faExclamationCircle, faCheckCircle,
  faArrowUp, faArrowDown, faMinus, faCircle, faSquare,
  faCheckSquare, faClipboard, faClipboardCheck, faHistory,
  faUndo, faRedo, faSave, faEdit, faExternalLink,
  faSignOutAlt, faUserCircle, faCog, faSlidersH,
  faChartPie, faChartSimple, faEllipsisV, faEllipsisH,
  faTimes, faBolt, faFire, faLayerGroup, faTree,
  faBullseye, faBroom, faBullhorn, faFloppyDisk,
  faForwardStep, faWandMagicSparkles, faShieldHalved,
  faQuestion, faArrowsRotate, faCircleNotch, faHourglassHalf,
  faPlug, faStore, faPaintBrush, faFlask, faCheckDouble,
  faHandshake, faShop, faScaleBalanced, faHammer,
  faGavel, faBug, faCodeBranch, faTerminal, faWindowRestore,
  faFeather, faScrewdriverWrench, faRepeat, faTrashCan,
  faArrowsLeftRight, faArrowsUpDown,
  faExpand, faCompress, faMoon, faSun, faCircleHalfStroke,
  faArrowUpFromBracket,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'

const iconMap: Record<string, IconDefinition> = {
  // Navigation & Layout
  dashboard: faDashboard,
  articles: faFileLines,
  pipeline: faWrench,
  copywriter: faPen,
  editorial: faUsers,
  analytics: faChartLine,
  'api-usage': faDollarSign,
  observability: faChartBar,
  queues: faListCheck,
  evaluation: faStar,
  'content-intel': faBrain,
  'brand-voice': faMicrophone,
  'fact-check': faCheck,
  security: faShield,
  chat: faMessage,
  clients: faBuilding,
  cms: faGlobe,
  pexels: faImage,
  'api-keys': faKey,
  plugins: faPuzzlePiece,
  config: faGear,
  settings: faCog,
  improvements: faRobot,
  webhooks: faLink,
  admin: faUserShield,
  prompts: faClipboard,
  home: faHome,
  team: faUsers,
  globe: faGlobe,
  user: faUserCircle,
  menu: faBars,
  keyword: faKey,
  book: faBook,

  // Actions
  approve: faThumbsUp,
  reject: faThumbsDown,
  publish: faRocket,
  generate: faMagic,
  regenerate: faRefresh,
  save: faSave,
  edit: faEdit,
  delete: faTrash,
  cancel: faXmark,
  close: faTimes,
  back: faArrowLeft,
  next: faArrowRight,
  add: faPlus,
  search: faSearch,
  filter: faFilter,
  sort: faSort,
  copy: faCopy,
  download: faDownload,
  upload: faUpload,
  print: faPrint,
  export: faFileExport,
  import: faFileImport,
  send: faPaperPlane,
  comment: faComment,
  notify: faBell,
  login: faSignOutAlt,
  logout: faSignOutAlt,
  lock: faLock,
  link: faExternalLink,
  refresh: faArrowsRotate,
  gear: faGear,
  magic: faWandMagicSparkles,
  eye: faEye,
  bell: faBell,
  floppy: faFloppyDisk,
  plug: faPlug,
  store: faStore,
  paint: faPaintBrush,
  flask: faFlask,
  handshake: faHandshake,
  scale: faScaleBalanced,
  hammer: faHammer,
  bug: faBug,
  terminal: faTerminal,
  feather: faFeather,
  repeat: faRepeat,

  // Status
  success: faCircleCheck,
  error: faCircleXmark,
  warning: faTriangleExclamation,
  info: faInfo,
  loading: faSpinner,
  pending: faClock,
  running: faArrowsRotate,
  completed: faCheckCircle,
  failed: faCircleXmark,
  skipped: faForwardStep,
  active: faBolt,
  inactive: faCircle,
  queued: faHourglassHalf,
  'dead-lettered': faBug,
  delayed: faClock,

  // Media & Content
  image: faImage,
  video: faPlay,
  file: faFile,
  folder: faFolder,
  'folder-open': faFolderOpen,
  calendar: faCalendar,
  history: faHistory,
  undo: faUndo,
  redo: faRedo,
  bookmark: faBook,
  tag: faTag,
  tags: faTags,
  flag: faFlag,
  clock: faClock,

  // Data & Analytics
  database: faDatabase,
  server: faServer,
  cloud: faCloud,
  code: faCode,
  chart: faChartBar,
  'chart-pie': faChartPie,
  'chart-line': faChartLine,
  'chart-simple': faChartSimple,
  stats: faChartLine,
  metric: faChartSimple,
  report: faFileExport,
  seo: faSearch,
  traffic: faChartLine,

  // Misc
  star: faStar,
  heart: faStar,
  sliders: faSlidersH,
  bolt: faBolt,
  fire: faFire,
  layers: faLayerGroup,
  tree: faTree,
  cube: faCube,
  cubes: faCubes,
  palette: faPalette,
  question: faQuestionCircle,
  exclamation: faExclamationCircle,
  ellipsis: faEllipsisH,
  'ellipsis-v': faEllipsisV,
  chevronLeft: faChevronLeft,
  chevronRight: faChevronRight,
  chevronDown: faChevronDown,
  chevronUp: faChevronUp,
  arrowUp: faArrowUp,
  arrowDown: faArrowDown,
  check: faCheck,
  'check-square': faCheckSquare,
  square: faSquare,
  clip: faClipboard,
  'clip-check': faClipboardCheck,
  play: faPlay,
  pause: faPause,
  stop: faStop,
  plus: faPlus,
  subtract: faMinus,
  xmark: faXmark,
  expand: faExpand,
  compress: faCompress,
  moon: faMoon,
  sun: faSun,
  'half-stroke': faCircleHalfStroke,

  // Pipeline stages
  'pipeline-stage': faScrewdriverWrench,
  'keyword-discovery': faKey,
  'search-intent': faBullseye,
  'serp-analysis': faSearch,
  'semantic-dedup': faBroom,
  'title-gen': faFeather,
  'outline-gen': faListCheck,
  'article-gen': faPen,
  'seo-enhance': faChartLine,
  'quality-gate': faShieldHalved,
  'fact-check-double': faCheckDouble,
  'brand-consistency': faBullseye,
  'cannibalization': faTriangleExclamation,
  'content-safety': faShield,
  'html-conversion': faCode,
  'internal-linking': faLink,
  'pexels-images': faImage,
  'faq-schema': faQuestion,
  'cta-insertion': faBullhorn,
  'article-storage': faDatabase,
  'vector-embedding': faBrain,
  'quality-eval': faStar,
  'topic-saturation': faChartBar,
  'editorial-workflow': faUsers,
  'webhook-notify': faBell,

  // Job types
  'article-generation': faPen,
  'multi-cms-publish': faGlobe,
  'cost-optimization': faDollarSign,
  'content-intelligence': faBrain,
  'ai-evaluation': faStar,
  'plugin': faPuzzlePiece,
  'shopify': faShop,
  'cms-connection': faGlobe,

  // default fallback
  default: faCircle,
}

export type IconName = keyof typeof iconMap

interface IconProps {
  name: IconName | string
  className?: string
  style?: React.CSSProperties
  size?: 'xs' | 'sm' | 'lg' | 'xl' | '2x' | '3x' | '4x' | '5x'
  fixedWidth?: boolean
  spin?: boolean
  pulse?: boolean
  rotation?: 90 | 180 | 270
  flip?: 'horizontal' | 'vertical' | 'both'
  color?: string
  onClick?: () => void
}

export default function Icon({
  name,
  className = '',
  style,
  size = 'sm',
  fixedWidth = true,
  spin = false,
  pulse = false,
  rotation,
  flip,
  color,
  onClick,
}: IconProps) {
  const icon = iconMap[name] || iconMap.default

  return (
    <span
      className={`fa-icon-wrapper ${className}`}
      style={{ ...(color ? { color } : {}), ...style }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <FontAwesomeIcon
        icon={icon}
        size={size}
        fixedWidth={fixedWidth}
        spin={spin}
        pulse={pulse}
        rotation={rotation}
        flip={flip}
      />
    </span>
  )
}

// Re-export for convenience
export { FontAwesomeIcon, iconMap }
