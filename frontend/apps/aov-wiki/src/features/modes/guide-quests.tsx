import { useWikiText } from "../../context/wiki-context"
import { GoldIcon } from "./gold-icon"
import { ModeHeading } from "./mode-ui"
import type { GuideIndex } from "./guide-ui"

/** A reward in gold reads with the game's coin; any other reward stays as the editor wrote it. */
function Reward({ text: reward }: { text?: string | null }) {
  const text = useWikiText()
  if (!reward)
    return (
      <span className="wiki-guide-quest-reward" data-missing="">
        {text("Chưa ghi phần thưởng", "Reward not recorded yet")}
      </span>
    )
  const gold = /^(\d+)\s*vàng$/iu.exec(reward.trim())
  return (
    <span className="wiki-guide-quest-reward">
      {gold ? (
        <>
          <GoldIcon size={16} />
          {text(`${gold[1]} vàng`, `${gold[1]} gold`)}
        </>
      ) : (
        reward
      )}
    </span>
  )
}

export function QuestsTab({ index }: { index: GuideIndex }) {
  const text = useWikiText()
  const { quests } = index.content
  return (
    <section className="wiki-guide-tab-body" aria-label={text("Nhiệm vụ", "Quests")}>
      <section className="wiki-mode-section" aria-labelledby="guide-quests">
        <ModeHeading
          id="guide-quests"
          title={text("Nhiệm vụ", "Quests")}
          count={quests.length}
          note={text(
            "Nhiệm vụ trong trận và phần thưởng khi hoàn thành.",
            "In-match quests and the rewards for completing them.",
          )}
        />
        {quests.length ? (
          <ol className="wiki-guide-entries" data-columns="2">
            {quests.map((quest, at) => (
              <li key={quest.code} className="wiki-guide-quest">
                <b aria-hidden="true">{at + 1}</b>
                <p>{quest.task}</p>
                <Reward text={quest.reward} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="wiki-mode-meta">
            {text(
              "Bản Bách khoa đã thu thập chưa có nhiệm vụ nào.",
              "The collected edition of the Encyclopedia has no quests yet.",
            )}
          </p>
        )}
      </section>
    </section>
  )
}
