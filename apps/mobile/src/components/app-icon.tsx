import {
  Anchor,
  Apple,
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  DoorOpen,
  Ellipsis,
  Eye,
  EyeOff,
  Grid2x2,
  House,
  Lightbulb,
  LockKeyhole,
  Mail,
  MessageCircle,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  Share2,
  Signal,
  Sparkles,
  Upload,
  UserRound,
  UsersRound,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react-native";

export type AppIconName =
  | "alert-circle"
  | "anchor"
  | "apple"
  | "arrow-left"
  | "book-open"
  | "calendar"
  | "check"
  | "chevron-right"
  | "clock"
  | "door-open"
  | "eye"
  | "eye-off"
  | "grid"
  | "house"
  | "lightbulb"
  | "lock"
  | "mail"
  | "message-circle"
  | "mic"
  | "mic-off"
  | "more"
  | "phone-off"
  | "refresh"
  | "share"
  | "signal"
  | "sparkles"
  | "upload"
  | "user"
  | "users"
  | "volume"
  | "volume-off";

const DEFAULT_SIZE = 20;
const DEFAULT_COLOR = "#174638";
const DEFAULT_STROKE_WIDTH = 1.75;

const ICONS = {
  "alert-circle": CircleAlert,
  anchor: Anchor,
  apple: Apple,
  "arrow-left": ArrowLeft,
  "book-open": BookOpen,
  calendar: Calendar,
  check: Check,
  "chevron-right": ChevronRight,
  clock: Clock3,
  "door-open": DoorOpen,
  eye: Eye,
  "eye-off": EyeOff,
  grid: Grid2x2,
  house: House,
  lightbulb: Lightbulb,
  lock: LockKeyhole,
  mail: Mail,
  "message-circle": MessageCircle,
  mic: Mic,
  "mic-off": MicOff,
  more: Ellipsis,
  "phone-off": PhoneOff,
  refresh: RefreshCw,
  share: Share2,
  signal: Signal,
  sparkles: Sparkles,
  upload: Upload,
  user: UserRound,
  users: UsersRound,
  volume: Volume2,
  "volume-off": VolumeX,
} satisfies Record<AppIconName, LucideIcon>;

export function AppIcon({
  color = DEFAULT_COLOR,
  decorative = true,
  name,
  size = DEFAULT_SIZE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  testID,
}: {
  color?: string;
  decorative?: boolean;
  name: AppIconName;
  size?: number;
  strokeWidth?: number;
  testID?: string;
}) {
  const Icon = ICONS[name];
  return (
    <Icon
      accessible={!decorative}
      color={color}
      size={size}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      testID={testID}
    />
  );
}
