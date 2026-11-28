/**
 * The songs Stream offers, all of them music videos that Garena, Riot, NoCopyrightSounds or the singers put on YouTube
 * themselves, and that YouTube lets other sites play (checked on 2026-11-26 and 2026-11-28: playable in embeds, family
 * safe, watchable in Vietnam). They are played only through YouTube's own player; nothing of them is copied or kept.
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
  /** Music with no words sung, which the list marks. */
  instrumental?: boolean
}

export type MusicListCode = "SONGS" | "ARENA" | "HEROES" | "GAMING" | "MINE"

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

/**
 * Music for playing to that gamers have kept for years: Vietnamese songs, electronic tracks and rock. Tracks without
 * sung words are marked.
 */
const GAMING: readonly MusicTrack[] = [
  // Vietnamese songs gamers have played for years.
  { video: "Jk38OqdAQxc", title: "Độ Tộc 2", artist: "Masew x Phúc Du x Pháo x Độ Mixi", tag: "2021", seconds: 211 },
  { video: "HOGfrOK9a84", title: "Tộc Ca", artist: "Phúc Du x SONBEAT", tag: "2019", seconds: 191 },
  { video: "EV-91JV4Fws", title: "Túy Âm", artist: "Xesi x Masew x Nhatnguyen", tag: "2017", seconds: 201 },
  { video: "1pquvJRgIMY", title: "Ái Nộ", artist: "Masew x Khôi Vũ", tag: "2021", seconds: 232 },
  { video: "qkPgUgkQE4Y", title: "Đế Vương", artist: "Đình Dũng", tag: "2021", seconds: 271 },
  { video: "WX7dUj14Z00", title: "Bạc Phận", artist: "K-ICM x Jack", tag: "2019", seconds: 256 },
  { video: "j8U06veqxdU", title: "Sóng Gió", artist: "K-ICM x Jack", tag: "2019", seconds: 350 },
  {
    video: "J1VzE0S-jzk",
    title: "Cô Thắm Không Về",
    artist: "Phát Hồ x JokeS Bii x Sinike ft. DinhLong",
    tag: "2019",
    seconds: 255,
  },
  { video: "Llw9Q6akRo4", title: "Lạc Trôi", artist: "Sơn Tùng M-TP", tag: "2017", seconds: 272 },
  { video: "32sYGCOYJUM", title: "Chạy Ngay Đi", artist: "Sơn Tùng M-TP", tag: "2018", seconds: 274 },
  {
    video: "knW7-x7Y7RE",
    title: "Hãy Trao Cho Anh",
    artist: "Sơn Tùng M-TP ft. Snoop Dogg",
    tag: "2019",
    seconds: 263,
  },
  { video: "mw7Y0jQ8_BU", title: "2 Phút Hơn (KAIZ Remix)", artist: "Pháo", tag: "2021", seconds: 190 },
  { video: "jgZkrA8E5do", title: "Bigcityboi", artist: "Binz x Touliver", tag: "2020", seconds: 224 },
  {
    video: "yET2SBRuNm0",
    title: "Thủ Đô Cypher",
    artist: "RPT Orijinn, Low G, RZ Mas, RPT MCK",
    tag: "2020",
    seconds: 175,
  },
  { video: "Q6ZNsHvspEg", title: "Gieo Quẻ", artist: "Hoàng Thùy Linh & Đen", tag: "2022", seconds: 260 },
  { video: "LaxkmhiECfM", title: "Bên Trên Tầng Lầu", artist: "Tăng Duy Tân", tag: "2022", seconds: 191 },
  { video: "vPz8ftK_4bk", title: "Đánh Đổi", artist: "Obito ft. MCK", tag: "2023", seconds: 227 },
  { video: "GpmOn4RyzZI", title: "Cắt Đôi Nỗi Sầu", artist: "Tăng Duy Tân ft. Drum7", tag: "2023", seconds: 203 },
  // Electronic tracks NoCopyrightSounds put out, the ones streamers may play live.
  { video: "K4DyBUG242c", title: "On & On", artist: "Cartoon, Jéja ft. Daniel Levi", tag: "NCS 2015", seconds: 208 },
  { video: "3nQNiWdeH2Q", title: "Heroes Tonight", artist: "Janji ft. Johnning", tag: "NCS 2015", seconds: 208 },
  { video: "yJg-Y5byMMw", title: "Mortals", artist: "Warriyo ft. Laura Brehm", tag: "NCS 2016", seconds: 230 },
  { video: "jK2aIUmmdP4", title: "My Heart", artist: "Different Heaven & EH!DE", tag: "NCS 2013", seconds: 267 },
  { video: "J2X5mJ3HDYE", title: "Invincible", artist: "DEAF KEV", tag: "NCS 2015", seconds: 273, instrumental: true },
  {
    video: "TW9d8vYrVFQ",
    title: "Sky High",
    artist: "Elektronomia",
    tag: "NCS 2017",
    seconds: 238,
    instrumental: true,
  },
  { video: "p7ZsBPK656s", title: "Blank", artist: "Disfigure", tag: "NCS 2013", seconds: 209 },
  { video: "S19UcWdOA-I", title: "Fearless pt.II", artist: "Lost Sky ft. Chris Linton", tag: "NCS 2017", seconds: 194 },
  {
    video: "__CRWE-L45k",
    title: "Symbolism",
    artist: "Electro-Light",
    tag: "NCS 2014",
    seconds: 291,
    instrumental: true,
  },
  { video: "LHvYrn3FAgI", title: "Superhero", artist: "Unknown Brain ft. Chris Linton", tag: "NCS 2016", seconds: 182 },
  // Electronic tracks from the artists' own channels (NCS took Fade and Candyland down, so these are the artists').
  { video: "60ItHLz5WEA", title: "Faded", artist: "Alan Walker", tag: "2015", seconds: 213 },
  { video: "1-xGerv5FOk", title: "Alone", artist: "Alan Walker", tag: "2016", seconds: 163 },
  { video: "wJnBTPUQS5A", title: "The Spectre", artist: "Alan Walker", tag: "2017", seconds: 206 },
  {
    video: "M-P4QBt-FWw",
    title: "Darkside",
    artist: "Alan Walker ft. Au/Ra, Tomine Harket",
    tag: "2018",
    seconds: 240,
  },
  {
    video: "dhYOPzcsbGM",
    title: "On My Way",
    artist: "Alan Walker, Sabrina Carpenter & Farruko",
    tag: "2019",
    seconds: 217,
  },
  { video: "vg95MYlTb3c", title: "Fade", artist: "Alan Walker", tag: "2014", seconds: 264, instrumental: true },
  { video: "IhchfhxvPKI", title: "Candyland", artist: "Tobu", tag: "2015", seconds: 199, instrumental: true },
  { video: "n8X9_MgEdCg", title: "Unity", artist: "TheFatRat", tag: "2014", seconds: 249, instrumental: true },
  { video: "B7xai5u_tnk", title: "Monody", artist: "TheFatRat ft. Laura Brehm", tag: "2015", seconds: 291 },
  { video: "cMg8KaMdDYo", title: "Fly Away", artist: "TheFatRat ft. Anjulie", tag: "2017", seconds: 194 },
  { video: "KR-eV7fHNbM", title: "The Calling", artist: "TheFatRat ft. Laura Brehm", tag: "2016", seconds: 234 },
  { video: "ALZHF5UqnU4", title: "Alone", artist: "Marshmello", tag: "2016", seconds: 200 },
  // Rock that has stood behind game montages for years.
  { video: "7wtfhZwyrcc", title: "Believer", artist: "Imagine Dragons", tag: "2017", seconds: 217 },
  { video: "kXYiU_JCYtU", title: "Numb", artist: "Linkin Park", tag: "2003", seconds: 187 },
  { video: "eVTXPUF4Oz4", title: "In The End", artist: "Linkin Park", tag: "2000", seconds: 218 },
  { video: "1mjlM_RnsVE", title: "Monster", artist: "Skillet", tag: "2009", seconds: 187 },
  { video: "LBr7kECsjcQ", title: "Centuries", artist: "Fall Out Boy", tag: "2014", seconds: 272 },
  { video: "_PBlykN4KIY", title: "Unstoppable", artist: "The Score", tag: "2017", seconds: 191 },
  {
    video: "hKRUPYrAQoE",
    title: "Victory",
    artist: "Two Steps From Hell",
    tag: "2015",
    seconds: 329,
    instrumental: true,
  },
]

/** The lists offered by the site, in the order they are shown; the reader's own links come after them. */
export const MUSIC_LISTS: readonly MusicList[] = [
  { code: "SONGS", tracks: SONGS },
  { code: "ARENA", tracks: ARENA },
  { code: "HEROES", tracks: HEROES },
  { code: "GAMING", tracks: GAMING },
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
