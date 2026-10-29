import { createRoot } from "react-dom/client"
import { ImageCredit } from "@aov/ui/components/image-credit"
import "@aov/ui/styles.css"

createRoot(document.getElementById("root")!).render(
  <main className="min-h-screen bg-slate-950 p-8 text-white">
    <h1 className="mb-6 text-2xl">Nguồn ảnh</h1>
    <div className="relative w-72 overflow-hidden rounded-xl border border-white/20">
      <img
        src="/__resources/assets/hero/portrait/airi-1-portrait.png"
        alt="Airi"
        className="h-96 w-full object-cover"
      />
      <ImageCredit
        sources={[
          {
            type: "GAME_CLIENT",
            label: "Ảnh chụp Liên Quân — do người dùng cung cấp",
            ownerName: "Garena / Liên Quân Mobile",
            url: "https://lienquan.garena.vn/",
          },
        ]}
        contactHref="http://localhost:5173/contact?assetId=00000000-0000-0000-0000-000000000001&versionId=00000000-0000-0000-0000-000000000002"
      />
    </div>
    <p className="mt-5 text-sm text-white/60">Dữ liệu minh họa để kiểm tra giao diện, không gửi yêu cầu đến backend.</p>
  </main>,
)
