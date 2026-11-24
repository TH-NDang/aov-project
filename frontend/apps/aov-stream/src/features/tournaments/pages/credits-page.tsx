import type { ReactNode } from "react"
import { StreamShell, WIKI_URL } from "../../../components/stream-shell"
import { useStreamLocale } from "../../../components/stream-locale"
import "./credits-page.css"

function Out({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

/** Whose the pictures, the data and the icons of the app are, and how their owners reach us. */
export function CreditsPage() {
  const { text } = useStreamLocale()
  return (
    <StreamShell>
      <title>{text("Bản quyền và nguồn — AOV Stream", "Rights and sources — AOV Stream")}</title>
      <article className="cp-container cr-page">
        <h1>{text("Bản quyền và nguồn", "Rights and sources")}</h1>
        <section>
          <h2>{text("Logo đội tuyển và giải đấu", "Team and tournament logos")}</h2>
          <p>
            {text(
              "Logo, tên và nhãn hiệu của đội tuyển, giải đấu và ban tổ chức thuộc về chủ sở hữu tương ứng. AOV Stream dùng chúng để người xem nhận ra đội và giải, không phải để nhận là của mình hay ngụ ý được bảo trợ.",
              "The logos, names and trademarks of teams, tournaments and organizers belong to their owners. AOV Stream shows them so viewers recognise a team or a tournament, not to claim them or to suggest an endorsement.",
            )}
          </p>
          <p>
            {text("Phần lớn logo lấy từ ", "Most logos come from ")}
            <Out href="https://liquipedia.net/honorofkings/Main_Page">Liquipedia</Out>
            {text(
              ", nơi ghi nguồn của từng tệp. Giấy phép của nội dung Liquipedia không bao gồm logo.",
              ", which records the source of each file. The licence of Liquipedia's content does not cover logos.",
            )}
          </p>
        </section>
        <section>
          <h2>{text("Dữ liệu giải đấu", "Tournament data")}</h2>
          <p>
            {text(
              "Lịch, kết quả, đội hình và thể thức được đối chiếu từ ban tổ chức và ",
              "Schedules, results, rosters and formats are checked against organizers and ",
            )}
            <Out href="https://liquipedia.net/honorofkings/Main_Page">Liquipedia</Out>
            {text(". Nội dung văn bản của Liquipedia theo giấy phép ", ". Liquipedia's text is available under ")}
            <Out href="https://creativecommons.org/licenses/by-sa/3.0/us/">CC BY-SA 3.0</Out>
            {text(
              ". Trang của mỗi giải có liên kết tới nguồn của giải đó.",
              ". Each tournament's page links to its own source.",
            )}
          </p>
        </section>
        <section>
          <h2>{text("Tuyển thủ và nhân sự", "Players and staff")}</h2>
          <p>
            {text(
              "AOV Stream không dùng ảnh tuyển thủ, huấn luyện viên và nhân sự phát sóng; mỗi người có một huy hiệu tạo từ tên thi đấu.",
              "AOV Stream uses no photos of players, coaches or broadcast crews; each has a mark drawn from the name they go by.",
            )}
          </p>
        </section>
        <section>
          <h2>{text("Trò chơi", "The game")}</h2>
          <p>
            {text(
              "Liên Quân Mobile (Arena of Valor), hình tướng, trang bị và biểu tượng trong game thuộc Garena, Tencent và các bên liên quan. AOV Stream do người hâm mộ làm, không thuộc các công ty này.",
              "Arena of Valor, its heroes, items and in-game icons belong to Garena, Tencent and their partners. AOV Stream is made by fans and is not affiliated with these companies.",
            )}
          </p>
          <p>
            {text("Biểu tượng mục từ ", "Section icons from ")}
            <Out href="https://game-icons.net">Game Icons</Out>,{" "}
            <Out href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</Out>.
          </p>
        </section>
        <section>
          <h2>{text("Bạn là chủ sở hữu?", "Are you the owner?")}</h2>
          <p>
            {text(
              "Nếu bạn sở hữu một logo và muốn sửa, thay hoặc gỡ, hãy gửi yêu cầu cho ban biên tập qua ",
              "If you own a logo and want it corrected, replaced or removed, send the editors a request through the ",
            )}
            <Out href={`${WIKI_URL}/contact`}>{text("trang liên hệ của AOV WiKi", "contact page of AOV WiKi")}</Out>.
          </p>
        </section>
      </article>
    </StreamShell>
  )
}
