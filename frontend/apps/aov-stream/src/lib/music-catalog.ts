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
 * Music to play games to: tracks that recur in the most watched gaming and phonk mixes on YouTube (searched signed
 * out), whose own upload passed 80 million views (Vietnamese songs 50 million). Tracks without sung words are marked.
 */
const GAMING: readonly MusicTrack[] = [
  // Electronic tracks that come back again and again in the most watched gaming mixes, the most heard first.
  { video: "60ItHLz5WEA", title: "Faded", artist: "Alan Walker", tag: "2015", seconds: 213 },
  { video: "ALZHF5UqnU4", title: "Alone", artist: "Marshmello", tag: "2016", seconds: 200 },
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
  { video: "K4DyBUG242c", title: "On & On", artist: "Cartoon, Jéja ft. Daniel Levi", tag: "NCS 2015", seconds: 208 },
  { video: "3nQNiWdeH2Q", title: "Heroes Tonight", artist: "Janji ft. Johnning", tag: "NCS 2015", seconds: 208 },
  { video: "yJg-Y5byMMw", title: "Mortals", artist: "Warriyo ft. Laura Brehm", tag: "NCS 2016", seconds: 230 },
  { video: "jK2aIUmmdP4", title: "My Heart", artist: "Different Heaven & EH!DE", tag: "NCS 2013", seconds: 267 },
  { video: "J2X5mJ3HDYE", title: "Invincible", artist: "DEAF KEV", tag: "NCS 2015", seconds: 273, instrumental: true },
  { video: "n8X9_MgEdCg", title: "Unity", artist: "TheFatRat", tag: "2014", seconds: 249, instrumental: true },
  {
    video: "TW9d8vYrVFQ",
    title: "Sky High",
    artist: "Elektronomia",
    tag: "NCS 2017",
    seconds: 238,
    instrumental: true,
  },
  { video: "p7ZsBPK656s", title: "Blank", artist: "Disfigure", tag: "NCS 2013", seconds: 209 },
  { video: "B7xai5u_tnk", title: "Monody", artist: "TheFatRat ft. Laura Brehm", tag: "2015", seconds: 291 },
  { video: "lW9ep22YmlM", title: "Royalty", artist: "Egzod & Maestro Chives ft. Neoni", tag: "2021", seconds: 224 },
  { video: "S19UcWdOA-I", title: "Fearless pt.II", artist: "Lost Sky ft. Chris Linton", tag: "NCS 2017", seconds: 194 },
  { video: "cMg8KaMdDYo", title: "Fly Away", artist: "TheFatRat ft. Anjulie", tag: "2017", seconds: 194 },
  {
    video: "__CRWE-L45k",
    title: "Symbolism",
    artist: "Electro-Light",
    tag: "NCS 2014",
    seconds: 291,
    instrumental: true,
  },
  { video: "83RUhxsfLWs", title: "Grateful", artist: "NEFFEX", tag: "2018", seconds: 182 },
  { video: "WzQBAc8i73E", title: "Cold", artist: "NEFFEX", tag: "2018", seconds: 186 },
  { video: "AnMhdn0wJ4I", title: "Nevada", artist: "Vicetone ft. Cozi Zuehlsdorff", tag: "2016", seconds: 209 },
  { video: "q1ULJ92aldE", title: "Feel Good", artist: "Syn Cole", tag: "NCS 2016", seconds: 182 },
  { video: "LHvYrn3FAgI", title: "Superhero", artist: "Unknown Brain ft. Chris Linton", tag: "NCS 2016", seconds: 182 },
  { video: "KR-eV7fHNbM", title: "The Calling", artist: "TheFatRat ft. Laura Brehm", tag: "2016", seconds: 234 },
  { video: "L7kF4MXXCoA", title: "Dreams pt. II", artist: "Lost Sky ft. Sara Skinner", tag: "NCS 2018", seconds: 215 },
  {
    video: "bdE_SyHad90",
    title: "Light It Up",
    artist: "Robin Hustin x TobiMorrow ft. Jex",
    tag: "NCS 2018",
    seconds: 185,
  },
  { video: "3fxq7kqyWO8", title: "Time Lapse", artist: "TheFatRat", tag: "2015", seconds: 185, instrumental: true },
  { video: "0Wa_CR0H8g4", title: "Best of Me", artist: "NEFFEX", tag: "2017", seconds: 239 },
  { video: "U9pGr6KMdyg", title: "Where We Started", artist: "Lost Sky ft. Jex", tag: "NCS 2019", seconds: 222 },
  { video: "kRauptdx_Is", title: "Walk Thru Fire", artist: "Vicetone ft. Meron Ryan", tag: "2018", seconds: 194 },
  { video: "fzNMd3Tu1Zw", title: "Energy", artist: "Elektronomia", tag: "NCS 2016", seconds: 198, instrumental: true },
  { video: "tcHJodG5hX8", title: "Why Do I?", artist: "Unknown Brain ft. Bri Tolani", tag: "NCS 2018", seconds: 223 },
  // Phonk, the sound of today's gaming mixes.
  { video: "w-sQRS-Lc9k", title: "Murder In My Mind", artist: "Kordhell", tag: "Phonk 2022", seconds: 145 },
  { video: "qlzcHe_gusE", title: "SLAY!", artist: "Eternxlkz", tag: "Phonk 2024", seconds: 107 },
  { video: "PTZgxW_3LIQ", title: "RAVE", artist: "Dxrk ダーク", tag: "Phonk 2022", seconds: 169 },
  { video: "ao4RCon11eY", title: "Close Eyes", artist: "DVRST", tag: "Phonk 2021", seconds: 133 },
  { video: "pIZ0QRWK0zg", title: "Sahara", artist: "Hensonn", tag: "Phonk 2021", seconds: 171, instrumental: true },
  // Vietnamese songs Vietnamese gamers have played for years.
  { video: "j8U06veqxdU", title: "Sóng Gió", artist: "K-ICM x Jack", tag: "2019", seconds: 350 },
  { video: "WX7dUj14Z00", title: "Bạc Phận", artist: "K-ICM x Jack", tag: "2019", seconds: 256 },
  { video: "EV-91JV4Fws", title: "Túy Âm", artist: "Xesi x Masew x Nhatnguyen", tag: "2017", seconds: 201 },
  { video: "qkPgUgkQE4Y", title: "Đế Vương", artist: "Đình Dũng", tag: "2021", seconds: 271 },
  { video: "1pquvJRgIMY", title: "Ái Nộ", artist: "Masew x Khôi Vũ", tag: "2021", seconds: 232 },
  { video: "Jk38OqdAQxc", title: "Độ Tộc 2", artist: "Masew x Phúc Du x Pháo x Độ Mixi", tag: "2021", seconds: 211 },
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
