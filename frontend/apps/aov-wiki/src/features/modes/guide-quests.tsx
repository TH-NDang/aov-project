import { GoldIcon } from "./gold-icon"
import { ModeHeading } from "./mode-ui"
import type { GuideIndex } from "./guide-ui"

/** A reward in gold reads with the game's coin; any other reward stays as the editor wrote it. */
function Reward({ text }: { text?: string | null }) {
  if (!text)
    return (
      <span className="quest-reward" data-missing="">
        Chưa ghi phần thưởng
      </span>
    )
  const gold = /^(\d+)\s*vàng$/iu.exec(text.trim())
  return (
    <span className="quest-reward">
      {gold ? (
        <>
          <GoldIcon size={16} />
          {gold[1]} vàng
        </>
      ) : (
        text
      )}
    </span>
  )
}

export function QuestsTab({ index }: { index: GuideIndex }) {
  const { quests } = index.content
  return (
    <section className="guide-tab-body" aria-label="Nhiệm vụ">
      <section className="mode-section" aria-labelledby="guide-quests">
        <ModeHeading
          id="guide-quests"
          title="Nhiệm vụ"
          count={quests.length}
          note="Nhiệm vụ trong trận và phần thưởng khi hoàn thành."
        />
        {quests.length ? (
          <ol className="guide-entries" data-columns="2">
            {quests.map((quest, at) => (
              <li key={quest.code} className="quest">
                <b aria-hidden="true">{at + 1}</b>
                <p>{quest.task}</p>
                <Reward text={quest.reward} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="mode-meta">Bản Bách khoa đã thu thập chưa có nhiệm vụ nào.</p>
        )}
      </section>
    </section>
  )
}
