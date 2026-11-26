/**
 * The songs Stream offers, all of them music videos that Garena, its esports channel or the singers put on YouTube
 * themselves, and that YouTube lets other sites play (checked on 2026-11-26: playable in embeds, family safe, in every
 * country). They are played only through YouTube's own player; nothing of them is copied or kept.
 */

export type MusicTrack = {
  /** The YouTube video id. */
  video: string
  title: string
  artist: string
  /** What it belongs to: an event, a hero or the year it came out. */
  tag?: string
  /** The length of the video, where it is known. */
  seconds?: number
}

export type MusicListCode = "SONGS" | "ARENA" | "HEROES" | "MINE"

export type MusicList = { code: MusicListCode; tracks: readonly MusicTrack[] }

/** Songs made with singers for the game, newest first. */
const SONGS: readonly MusicTrack[] = [
  { video: "qJn0uACPdG0", title: "Vẫn Ở Đây", artist: "Bích Phương ft. Cheng", tag: "AOV 10", seconds: 249 },
  { video: "rAzPwbYr8Oc", title: "Tiếng Con Tim (Echo)", artist: "HepiHepi", tag: "2026", seconds: 161 },
  {
    video: "u-Bd6w5hyfc",
    title: "Liên khúc Huyền Thoại Liên Quân",
    artist: "AOG All-star Band",
    tag: "2026",
    seconds: 245,
  },
  {
    video: "cSFCPeAF73o",
    title: "Chung Một Người",
    artist: "Anh Bằng ft. Mason Nguyễn, Pháo",
    tag: "2026",
    seconds: 249,
  },
  { video: "TvKNj7KSaEg", title: "Tan Chảy Vì Em", artist: "Hiderway ft. Hyden", tag: "2026", seconds: 218 },
  {
    video: "wcIB3uIedzo",
    title: "Đừng Lo",
    artist: "Bích Phương, Ánh Sáng AZA, Lamoon, Han Sara, LyLy",
    tag: "2025",
    seconds: 206,
  },
  { video: "t0y-qKDgyAQ", title: "Bản Sắc Nước Nam", artist: "Tuấn Cry x Minh Ngọc", tag: "2025", seconds: 262 },
  { video: "X_dtR8JK3xQ", title: "Định Mệnh Tình Yêu", artist: "Changg x Lemese", tag: "2022", seconds: 206 },
  { video: "Z-nITN5Co-4", title: "Birthday Thọt", artist: "JustaTee x MCK x tlinh", tag: "2020", seconds: 207 },
  {
    video: "PTl6AnnKLX0",
    title: "Lane Nào “Bá” Nhất?",
    artist: "LowG x Gừng x GDucky x RPT Orijinn x RPT T.C",
    tag: "2020",
    seconds: 230,
  },
  {
    video: "CIbunc1nnxs",
    title: "Vinh Quang Đang Chờ Ta",
    artist: "Soobin Hoàng Sơn x Rhymastic x Touliver",
    tag: "2017",
    seconds: 259,
  },
]

/** The theme songs of the tournaments, newest first. */
const ARENA: readonly MusicTrack[] = [
  {
    video: "GTIQOzEYtwI",
    title: "Thập Kỷ Vinh Quang",
    artist: "Đấu Trường Danh Vọng",
    tag: "ĐTDV 2026",
    seconds: 275,
  },
  { video: "ZhK_ATynA3A", title: "Valor Rises", artist: "UPRIZE", tag: "APL 2026", seconds: 205 },
  { video: "xvjyt1vQlO4", title: "Burn Down The Shadow", artist: "Đào Tử A1J", tag: "AIC 2025", seconds: 193 },
  { video: "GV8Nx27YALE", title: "Go Get It", artist: "Obito", tag: "ĐTDV 2025", seconds: 205 },
  {
    video: "eZFJTmmChdA",
    title: "Born For This Moment",
    artist: "Galchanie ft. CDGuntee",
    tag: "APL 2025",
    seconds: 170,
  },
  { video: "iVb0GlsiOnw", title: "Bring It On", artist: "CHARLES., MinhLai, Liu Grace", tag: "AIC 2024", seconds: 225 },
  { video: "4TPInbPoQBk", title: "Outplay", artist: "Waii, Tomo Visava, SlimV", tag: "APL 2024", seconds: 189 },
  { video: "Ne3aQ_URSjw", title: "Mark Your Legacy", artist: "Myra Trần x SlimV", tag: "AIC 2023", seconds: 250 },
  { video: "G8GQ5MqXHIs", title: "Echo of Glory", artist: "Jannine Weigel x Botcash", tag: "APL 2023", seconds: 192 },
  { video: "wIafrr4gTwk", title: "New Rivals New Honor", artist: "Arena of Valor", tag: "AIC 2022", seconds: 191 },
  { video: "_HLJYsYCHfc", title: "No Limits", artist: "Orange x Gill", tag: "APL 2022", seconds: 222 },
  { video: "kkS_YR1Uc2I", title: "Time Makes Heroes", artist: "Yena", tag: "AIC 2021", seconds: 228 },
  { video: "1e-_ncHdjyQ", title: "Keep Fighting", artist: "Thành Draw", tag: "ĐTDV 2021", seconds: 217 },
  {
    video: "IZis5cqW0dM",
    title: "Let Victory Make History",
    artist: "Rhymastic ft. GDucky",
    tag: "AIC 2020",
    seconds: 238,
  },
  { video: "nNODXuOl3WI", title: "Đây Là Việt Nam", artist: "Rhymastic ft. Blacka", tag: "AIC 2018", seconds: 199 },
]

/** Songs sung by heroes, or made for a hero or a skin. */
const HEROES: readonly MusicTrack[] = [
  { video: "lYaNpdVY30M", title: "Listen", artist: "Sephera Nova Stardust", tag: "Sephera", seconds: 161 },
  { video: "rBTPC7cDp2M", title: "Ride On", artist: "WaVe", tag: "WaVe", seconds: 252 },
  { video: "FTuI8nkXCN0", title: "Wave Star", artist: "Điêu Thuyền WaVe", tag: "Điêu Thuyền", seconds: 318 },
  { video: "7iVkL_sAYMI", title: "Light The Dream", artist: "Florentino x Liliana", tag: "Florentino", seconds: 132 },
  { video: "2bUCDjsIX_w", title: "Đào Hoa", artist: "Hồng Dương ft. Soi Nguyen", tag: "Tachi", seconds: 284 },
  { video: "fzvV6gVfv4k", title: "Trái Tim Băng Giá", artist: "Sinestrea", tag: "Sinestrea", seconds: 171 },
  {
    video: "UAbPFt8ydUM",
    title: "Dưới Ánh Hào Quang",
    artist: "Liliana Thần Tượng Âm Nhạc",
    tag: "Liliana",
    seconds: 229,
  },
  { video: "KoNMpMFKA8E", title: "The One and Only", artist: "Nhạc Viện Ngôi Sao", tag: "Valentine", seconds: 182 },
]

/** The lists offered by the site, in the order they are shown; the reader's own links come after them. */
export const MUSIC_LISTS: readonly MusicList[] = [
  { code: "SONGS", tracks: SONGS },
  { code: "ARENA", tracks: ARENA },
  { code: "HEROES", tracks: HEROES },
]

/** The tracks of a list; the reader's own are given, as only the browser keeps them. */
export function tracksOf(code: MusicListCode, mine: readonly MusicTrack[]): readonly MusicTrack[] {
  if (code === "MINE") return mine
  return MUSIC_LISTS.find((list) => list.code === code)?.tracks ?? []
}

/** A length as the player writes it: 4:09. */
export function lengthWords(seconds: number) {
  const whole = Math.max(0, Math.round(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`
}
