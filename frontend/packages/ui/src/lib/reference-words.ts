/**
 * Words a running text uses all the time, which are also names of teams, players or heroes in the records. A name on
 * one of these lists is never taken for a reference without a word before it that says what it is.
 */

const list = (words: string) => new Set(words.trim().split(/\s+/))

/**
 * Everyday words in lower case: those players took as nicknames, given names that are also heroes, and the words that
 * open sentences. The last ones also tell a capital letter at the start of a sentence from the first word of a name.
 */
export const everydayWords: ReadonlySet<string> = list(`
  a an and the this that these those his her their its my me your you we our us they he she it all any some none both
  each every one two three four five six seven eight nine ten twenty hundred zero first second third last next new old
  in on at by to of as if or so but for from with without after before then than while when where why what who how
  yes no not now here there still just only even ever never always again also too very more most much many few less
  do did does done be been am is are was were will would can could may might must let get got give gives take takes
  make makes go goes going come comes see look say says tell need want know think find keep put run runs ran fly play
  plays played playing begin begins start starts end ends stop stops win wins won winner winning lose loses lost loser
  fail failure missing miss note notes rest rush case clear key core guard peak near far top mid bottom jungle lane
  carry support roam roamer tank mage captain leader owner boss king queen prince princess royal emperor empire dynasty
  legacy hero heroes legend legends champion master pro rookie coach player team teams game games match matches series
  season round group final finals cup league stage draft pick ban buff nerf meta ace solo duo power energy force speed
  soul spirit ghost devil demon angel god heaven hell hidden shadow dark darkness light bright night day dawn dusk
  morning summer winter spring autumn april may june july august monday sunday sun moon star stars sky sea river rain
  snow ice fire water wind storm cloud thunder earth world forest tree flower rose lily lotus mars venus saturn black
  white red blue green orange silver gold pink gray grey purple yellow violet big small little long short high low good
  bad best better great nice easy hard real true false fake free fast slow happy sad lonely crazy angry sleepy lazy
  cool hot cold young love lover lovers heart dream hope faith secret miracle magic monster beast dragon wolf wolves
  fox bear bird fish rabbit cat dog tiger lion leopard shark panda puppy bunny mouse owl apple mango milk coffee cake
  candy cookie pudding noodle rice sorry thanks hello smile cry pain kiss crush blank empty silence song music melody
  blade sword shield knife arrow gun bomb ship car jet train phone book letter card box window door house home city
  town street road school university nobody someone everyone friend friends family brother sister mother father baby
  kid boy boys girl girls man woman men women genius smart wise curious worthless invincible outlaw outcast trouble
  blood fight club over
  discord diablo wildcat wildcard mirage eclipse phoenix crystal omega alpha butterfly superman joker max ming yan yue
  ata aya alice arthur charlotte helen stuart bonnie richter raz qi mina zip omen paine erin enzo astrid celica thane
  vietnam thailand germany korea japan china taiwan indonesia malaysia singapore philippines india america europe asia
  khi và với theo sau trước nếu tại từ của cùng còn trong ngoài nhờ do vì để đến rồi thì mà nhưng tuy dù các những mỗi
  cả ở là được bị đã đang sẽ có không chỉ cũng vẫn hôm nay lần trận ván giải mùa cặp ngôi tân cựu cấm chọn nhìn bên
  dưới trên giữa cuối đầu lúc này đó đây kia như hay hoặc nên cần phải rất quá nhiều ít hơn nhất mới cũ thêm lại nữa
  một hai ba bốn năm sáu bảy tám chín mười nam bắc đông tây trung việt long phong hải sơn giang hà lâm dương minh quang
  huy hùng dũng cường mạnh thắng bại thua quân tướng vương đế thần thánh tiên ma quỷ rồng hổ báo sói gấu mèo chó vịt gà
  cá chim thỏ khỉ chuột cáo trâu bò nắng mưa gió bão mây trời đất biển núi sông lửa nước khói tuyết hoa lá cỏ cây gạo
  lúa khoai bánh kẹo kem trà sữa đỏ xanh vàng trắng đen tím hồng cam nâu lên xuống vào ra đi về bay vui buồn yêu thương
  nhớ anh em chị cô chú bác ông bà bạn tôi nó họ chúng mai ngày đêm sáng trưa chiều tối tuần tháng xuân hạ thu vua chúa
  lính tâm triết khoa lan râu nấm nện dậu lanh bờm cung
`)

/** Capitals every esports text is full of, though a team or a circuit may use them as its short name. */
export const everydayCapitals: ReadonlySet<string> = list(`
  MVP FMVP SVP KDA CEO VIP BLV HLV CLB BTC TOP MID JUG JGL ADC SUP GPM DPM VND USD THB EUR HCM TPHCM SEA ASEAN USA UAE
  FHD LIVE NEW HOT FAQ AFK AOE DPS OMG LOL GGWP WIN LOSE NPC PVP PVE ULTI MMR ELO VAR ACE BAN PICK META BUFF NERF GANK
  FPS MOBA RPG VPN SMS SIM ATM COVID THE AND FOR YOU ALL ONE TWO DAY NIGHT GAME TEAM SOLO DUO TRIO NEWS GDP WHO VPS API
  URL PDF FULL SHOW BEST LAST NEXT OPEN BIG POST LINK
`)

/** Places, which provincial and national teams are named after. */
export const placeNames: ReadonlySet<string> = new Set(
  `an giang, bà rịa - vũng tàu, vũng tàu, bạc liêu, bắc giang, bắc kạn, bắc ninh, bến tre, bình dương, bình định, bình phước,
  bình thuận, cà mau, cao bằng, cần thơ, đà lạt, đà nẵng, đắk lắk, đắk nông, điện biên, đồng nai, đồng tháp, gia lai,
  hà giang, hà nam, hà nội, hà tĩnh, hải dương, hải phòng, hậu giang, hòa bình, hồ chí minh, huế, hưng yên, khánh hòa,
  kiên giang, kon tum, lai châu, lạng sơn, lào cai, lâm đồng, long an, nam định, nghệ an, nha trang, ninh bình,
  ninh thuận, phú thọ, phú yên, quảng bình, quảng nam, quảng ngãi, quảng ninh, quảng trị, sài gòn, sóc trăng, sơn la,
  tây ninh, thái bình, thái nguyên, thanh hóa, thừa thiên huế, tiền giang, trà vinh, tuyên quang, vĩnh long, vĩnh phúc,
  yên bái, hanoi, saigon, ho chi minh, bangkok, taipei, hong kong, macau, manila, jakarta, kuala lumpur, seoul, tokyo,
  việt nam, thái lan, đài loan, hàn quốc, trung quốc, nhật bản, hồng kông, ma cao, campuchia, lào, myanmar, vietnam,
  thailand, taiwan, chinese taipei, south korea, korea, china, japan, indonesia, malaysia, singapore, philippines,
  cambodia, laos, lao pdr, brunei, mongolia, india, pakistan, bangladesh, nepal, sri lanka, turkey, egypt, dubai,
  north america, south america, latin america, europe, asia, southeast asia, đông nam á, châu á, châu âu`
    .split(",")
    .map((name) => name.trim().replace(/\s+/g, " ")),
)

/**
 * The game itself. Some organizations use it as their short name, but a text that says it speaks of the game.
 */
export const gameNames: ReadonlySet<string> = new Set([
  "aov",
  "rov",
  "arena of valor",
  "realm of valor",
  "liên quân",
  "liên quân mobile",
  "penta storm",
  "honor of kings",
  "vương giả vinh diệu",
  "傳說對決",
  "펜타스톰",
])

/** The words before a name that say what it is, per kind; teams and people are often introduced so. */
const people =
  "tuyển thủ|đội trưởng|bình luận viên|blv|huấn luyện viên|hlv|phân tích viên|người dẫn chương trình|mc|player|captain|caster|coach|host|analyst"

export const introductions: Readonly<Record<string, string>> = {
  team: "đội tuyển|đội|câu lạc bộ|clb|team",
  player: people,
  person: people,
  organization: "ban tổ chức|tổ chức|nhà phát hành|công ty|đơn vị|organizer|publisher",
  circuit: "hệ thống giải|giải đấu|giải|league|tournament",
  competition: "giải đấu|giải|league|tournament",
  hero: "tướng|hero|champion",
  item: "trang bị|item",
  enchantment: "phù hiệu|enchantment",
  arcana: "bảng ngọc|ngọc|arcana",
  spell: "phép bổ trợ|phụ trợ|bổ trợ|spell",
  mode: "chế độ chơi|chế độ|mode",
}
