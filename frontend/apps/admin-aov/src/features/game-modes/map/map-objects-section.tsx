import { useState } from "react"
import { X } from "lucide-react"
import { CATEGORIES, type MapContent, type MapObject } from "@aov/ui/lib/battle-map"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Textarea } from "@aov/ui/components/textarea"
import { NativeSelect } from "@/components/native-select"
import { named } from "../guide-codes"
import { duplicateAt } from "../auto-chess/guide-model"
import { FormBlock, IconUpload, Segmented } from "../auto-chess/guide-fields"
import { DetailHeader, MasterDetail } from "../auto-chess/master-detail"
import { CATEGORY_LABEL, emptyObject, fixedMapCodes, renameObject } from "./map-edit-model"
import { ObjectPlaces } from "./map-object-places"
import { ObjectChange, ObjectSections, ObjectTimings } from "./map-object-texts"
import { CATEGORY_COLOR, GlyphPicker, ObjectThumb } from "./map-thumbs"

export interface MapSectionProps {
  content: MapContent
  /** The draft as last saved; its codes no longer follow a name. */
  saved: MapContent | null
  setContent: (content: MapContent) => void
  image: (id?: string | null) => string | undefined
  upload: (file: File, kind: "MAP_ICON" | "GAME_MODE_ART", label: string) => Promise<string>
}

/** An uploaded picture with a way to take it off again, so the Wiki falls back to its drawing. */
function PictureField({
  title,
  hint,
  src,
  round,
  onFile,
  onClear,
}: {
  title: string
  hint: string
  src?: string
  round?: boolean
  onFile: (file: File) => Promise<void>
  onClear: () => void
}) {
  return (
    <div className="flex items-center gap-3">
      <IconUpload src={src} onFile={onFile} round={round} size="lg" label={`Tải ${title.toLowerCase()}`} />
      <div className="grid min-w-0 gap-1">
        <span className="type-label">{title}</span>
        <span className="type-meta">{hint}</span>
        {src && (
          <Button type="button" size="sm" variant="ghost" className="justify-self-start" onClick={onClear}>
            <X /> Bỏ ảnh
          </Button>
        )}
      </div>
    </div>
  )
}

/** The objects of the map by kind; the selected one is edited beside the list, its places on a small map. */
export function MapObjectsSection({ content, saved, setContent, image, upload }: MapSectionProps) {
  const [selected, setSelected] = useState(0)
  const fixed = fixedMapCodes(saved, content)
  const object = content.objects[selected]
  const update = (next: MapObject) =>
    setContent({ ...content, objects: content.objects.map((row, index) => (index === selected ? next : row)) })
  const heads = content.objects.filter((other) => !other.family && other !== object)
  const forms = object ? content.objects.filter((other) => other.family === object.code) : []
  const background = image(content.backgroundAssetId)

  return (
    <MasterDetail
      title="Đối tượng"
      addLabel="Thêm đối tượng"
      selected={selected}
      onSelect={setSelected}
      onAdd={() => {
        setContent({ ...content, objects: [...content.objects, emptyObject(object?.category ?? "MONSTER")] })
        setSelected(content.objects.length)
      }}
      groups={CATEGORIES.map((category) => ({
        key: category,
        label: (
          <span className="flex items-center gap-1.5" style={{ color: CATEGORY_COLOR[category] }}>
            <span className="size-2 rounded-full bg-current" /> {CATEGORY_LABEL[category]}
          </span>
        ),
        rows: content.objects
          .map((entry, index) => ({ entry, index }))
          .filter(({ entry }) => entry.category === category)
          .map(({ entry, index }) => ({
            key: `${entry.code}-${index}`,
            index,
            title: entry.name,
            icon: <ObjectThumb object={entry} src={image(entry.iconAssetId)} />,
            meta: entry.family
              ? `Dạng của ${content.objects.find((head) => head.code === entry.family)?.name ?? entry.family}`
              : `${entry.positions.length} vị trí${entry.iconAssetId ? "" : " · chưa có biểu tượng"}`,
            warn: !entry.family && entry.positions.length === 0,
          })),
      }))}
    >
      {object ? (
        <>
          <DetailHeader
            icon={<ObjectThumb object={object} src={image(object.iconAssetId)} size="lg" />}
            title={object.name || "Đối tượng mới"}
            code={object.code}
            onRename={(code) => setContent(renameObject(content, object.code, code))}
            onDuplicate={() => {
              setContent({ ...content, objects: duplicateAt(content.objects, selected) })
              setSelected(selected + 1)
            }}
            deleteLabel={`Xóa ${object.name || "đối tượng"}?`}
            onDelete={() => {
              setContent({
                ...content,
                objects: content.objects
                  .filter((_, index) => index !== selected)
                  .map((other) => (other.family === object.code ? { ...other, family: null } : other)),
                tempo: content.tempo.map((moment) => ({
                  ...moment,
                  callouts: moment.callouts.map((callout) =>
                    callout.objectCode === object.code ? { ...callout, objectCode: null, spotKey: null } : callout,
                  ),
                })),
              })
              setSelected(0)
            }}
          />
          <FormBlock title="Ảnh" hint="Ảnh tải lên thay cho ký hiệu vẽ sẵn. Bỏ ảnh thì Wiki dùng lại ký hiệu.">
            <div className="grid gap-4 sm:grid-cols-2">
              <PictureField
                title="Biểu tượng"
                hint="Hình tròn trên bản đồ và trong danh sách."
                round
                src={image(object.iconAssetId)}
                onFile={async (file) => update({ ...object, iconAssetId: await upload(file, "MAP_ICON", object.code) })}
                onClear={() => update({ ...object, iconAssetId: null })}
              />
              <PictureField
                title="Ảnh minh họa"
                hint="Ảnh lớn ở đầu phần chi tiết."
                src={image(object.pictureAssetId)}
                onFile={async (file) =>
                  update({ ...object, pictureAssetId: await upload(file, "GAME_MODE_ART", object.code) })
                }
                onClear={() => update({ ...object, pictureAssetId: null })}
              />
            </div>
            <div className="grid gap-1">
              <span className="type-label">Ký hiệu khi chưa có biểu tượng</span>
              <GlyphPicker value={object.glyph} onChange={(glyph) => update({ ...object, glyph })} />
            </div>
          </FormBlock>
          <FormBlock title="Thông tin">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="type-label">Tên</span>
                <Input value={object.name} onChange={(event) => update(named(object, event.target.value, fixed))} />
              </label>
              <label className="grid gap-1">
                <span className="type-label">Là dạng khác của</span>
                <NativeSelect
                  value={object.family ?? ""}
                  disabled={forms.length > 0}
                  onChange={(event) => update({ ...object, family: event.target.value || null })}
                >
                  <option value="">Không, tự đứng trên bản đồ</option>
                  {heads.map((head) => (
                    <option key={head.code} value={head.code}>
                      {head.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            </div>
            <div className="grid gap-1">
              <span className="type-label">Loại</span>
              <Segmented
                label="Loại"
                value={object.category}
                onChange={(category) => update({ ...object, category })}
                options={CATEGORIES.map((category) => ({
                  value: category,
                  label: CATEGORY_LABEL[category],
                  color: CATEGORY_COLOR[category],
                }))}
              />
            </div>
            <label className="grid gap-1">
              <span className="type-label">Nhãn (cách nhau bởi dấu phẩy)</span>
              <Input
                value={object.tags.join(", ")}
                placeholder="vd. Quái to, Đẩy đường"
                onChange={(event) =>
                  update({ ...object, tags: event.target.value.split(",").map((tag) => tag.trimStart()) })
                }
                onBlur={() => update({ ...object, tags: object.tags.map((tag) => tag.trim()).filter(Boolean) })}
              />
            </label>
            <label className="grid gap-1">
              <span className="type-label">Tóm tắt</span>
              <Textarea
                value={object.summary ?? ""}
                placeholder="Một câu, vd. Bùa xanh"
                onChange={(event) => update({ ...object, summary: event.target.value || null })}
              />
            </label>
          </FormBlock>
          <FormBlock
            title="Thời gian"
            hint="Có thời điểm thì đồng hồ trên Wiki dùng được; lời trong game giữ nguyên chữ."
          >
            <ObjectTimings object={object} onChange={update} />
          </FormBlock>
          {object.family ? (
            <p className="type-body text-muted-foreground">
              Dạng này hiện cùng đối tượng chính trên bản đồ, không có vị trí riêng.
            </p>
          ) : (
            <FormBlock
              title="Vị trí"
              hint="Ghi chú ở nơi khác (vd. giao tranh tại trụ ngoài đỏ đường giữa) gọi vị trí bằng tham chiếu. Đừng đổi khóa đã xuất bản."
            >
              <ObjectPlaces content={content} object={object} background={background} onChange={setContent} />
            </FormBlock>
          )}
          <FormBlock title="Giới thiệu">
            <ObjectSections object={object} onChange={update} />
          </FormBlock>
          <FormBlock title="Thay đổi" hint="Ghi chú thay đổi mới nhất của game; để trống nếu không có.">
            <ObjectChange object={object} onChange={update} />
          </FormBlock>
        </>
      ) : (
        <p className="type-body text-muted-foreground">Chọn hoặc thêm một đối tượng.</p>
      )}
    </MasterDetail>
  )
}
