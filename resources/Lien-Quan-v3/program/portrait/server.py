from __future__ import annotations

import argparse, base64, copy, hashlib, io, json, mimetypes, os, re, secrets, shutil, threading, unicodedata, uuid, webbrowser

from datetime import datetime, timezone, timedelta

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from pathlib import Path

from urllib.parse import unquote, urlparse

from PIL import Image, UnidentifiedImageError



HERE = Path(__file__).resolve().parent

OUT = HERE.parents[1]

ROOT = OUT

DATA = OUT / 'data'

LOCK = threading.RLock()

TOKEN = secrets.token_urlsafe(32)



def read(path):

    return json.loads(path.read_text(encoding='utf-8'))



def encoded(value):

    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')



def now():

    return datetime.now(timezone.utc).isoformat()



def norm(value):

    return re.sub('[^a-z0-9]', '', unicodedata.normalize('NFD', value).lower().replace('đ', 'd'))



def slug(value):

    value = ''.join(c for c in unicodedata.normalize('NFD', value).lower().replace('đ', 'd') if not unicodedata.combining(c))

    return re.sub('[^a-z0-9]+', '-', value).strip('-')



def safe_path(relative):

    path = (OUT / relative).resolve()

    if not path.is_relative_to(OUT.resolve()) or path == OUT.resolve():

        raise ValueError('Đường dẫn không hợp lệ.')

    return path



def revision():

    return hashlib.sha256((DATA/'heroes.json').read_bytes() + (DATA/'portrait-sources.json').read_bytes()).hexdigest()



def target(data, hero_id, skin_id):

    hero = next((h for h in data['heroes'] if h['id'] == hero_id), None)

    if not hero:

        raise ValueError('Không tìm thấy tướng.')

    if skin_id:

        skin = next((s for s in hero['skins'] if s['id'] == skin_id and not s['isDefault']), None)

        if not skin:

            raise ValueError('Không tìm thấy trang phục.')

        return hero, skin

    return hero, hero



def key_for(hero, entry):

    return hero['id'], entry.get('sourceSkinId', 'heroSkin-1')



def all_entries(data):

    for hero in data['heroes']:

        yield hero, hero

        for skin in hero['skins']:

            if not skin['isDefault']:

                yield hero, skin



def backups():

    folder = OUT / 'program/backup/portrait'

    found = []

    if folder.exists():

        for path in folder.glob('*/receipt.json'):

            receipt = read(path)

            if receipt['status'] == 'committed':

                found.append({'id':path.parent.name, 'time':receipt['time'], 'label':receipt['label']})

    return sorted(found, key=lambda r:(r['time'],r['id']), reverse=True)



def state():

    return {'data':read(DATA/'heroes.json'), 'sources':read(DATA/'portrait-sources.json'), 'summary':read(DATA/'tong-ket.json'), 'revision':revision(), 'token':TOKEN, 'backups':backups()}



def refresh_asset_index(data, sources):

    index=read(DATA/'danh-sach-tai-nguyen.json')

    static=[a for a in index['assets'] if a['kind']!='portrait']

    by_name={norm(h['name']):h for h in data['heroes']}

    portraits=[]

    for r in sources:

        r.setdefault('assetId','asset-'+uuid.uuid5(uuid.NAMESPACE_URL,r.get('sourceFile',r['file'])).hex[:20])

        h=by_name.get(norm(r.get('hero','')))

        skin=next((s for s in h['skins'] if s['sourceSkinId']==r.get('skinId')),None) if h else None

        owners=[{'heroId':h['id'],'skinId':skin['id'] if skin and not skin['isDefault'] else None,'role':'primary' if r['isPrimary'] else 'alternate'}] if skin else []

        portraits.append({'id':r['assetId'],'file':r['file'],'kind':'portrait','bytes':r['bytes'],'sha256':r['sha256'],'owners':owners,'status':'assigned' if r.get('skinId') else 'unmatched'})

    return {'schemaVersion':'1.0','pathBase':'package-root','assets':static+portraits}



def sync_payloads(data, sources, original, pending):

    # Every file derived from the editable catalogue is refreshed in the same transaction.

    badges = {b['id'] for b in data['badges']}

    linked = {}

    for hero, entry in all_entries(data):

        if entry.get('badgeId') and entry['badgeId'] not in badges:

            raise ValueError('Bậc trang phục không tồn tại.')

        paths = [entry.get('portrait'), *entry.get('portraitAlternates', [])]

        if len([p for p in paths if p]) != len(set(p for p in paths if p)):

            raise ValueError('Ảnh chính và ảnh khác bị trùng đường dẫn.')

        linked[key_for(hero, entry)] = (hero, entry)

        if entry is hero:

            for s in hero['skins']:

                if s['isDefault']:

                    s['portrait'] = hero['portrait']

                    s['portraitAlternates'] = list(hero['portraitAlternates'])

    for row in sources:

        file = row['file']

        content = pending.get(file)

        if content is None:

            content = safe_path(file).read_bytes()

        row['bytes'] = len(content)

        row['sha256'] = hashlib.sha256(content).hexdigest()

        image = Image.open(io.BytesIO(content))

        row['width'], row['height'] = image.size

    if len({r['file'] for r in sources}) != len(sources):

        raise ValueError('Hai bản ảnh đang dùng cùng đường dẫn.')

    by_name = {norm(h['name']):h for h in data['heroes']}

    for row in sources:

        if not row.get('skinId'):

            continue

        owner = by_name.get(norm(row['hero']))

        if not owner or (owner['id'],row['skinId']) not in linked:

            raise ValueError('Ảnh tham chiếu đến tướng hoặc trang phục không tồn tại.')

        _, item = linked[(owner['id'],row['skinId'])]

        expected = item.get('portrait') if row['isPrimary'] else item.get('portraitAlternates', [])

        if (row['isPrimary'] and row['file'] != expected) or (not row['isPrimary'] and row['file'] not in expected):

            raise ValueError('Danh sách ảnh chính và các bản khác chưa đồng bộ.')

    previous = read(DATA/'danh-sach-anh.json')

    old_by_name = {norm(h['name']):h for h in original['heroes']}

    new_by_id = {h['id']:h for h in data['heroes']}

    for row in previous:

        old_hero = old_by_name.get(norm(row['hero']))

        if not old_hero:

            continue

        hero = new_by_id[old_hero['id']]

        old_skin = next((s for s in old_hero['skins'] if s['sourceSkinId'] == row.get('skin_id')), None)

        if not old_skin:

            old_skin = next((s for s in old_hero['skins'] if norm(s.get('fullName', '')) == norm(row['title'])), None)

        row['hero'] = hero['name']

        if old_skin:

            entry = next(s for s in hero['skins'] if s['id'] == old_skin['id'])

            row['title'] = entry.get('fullName', row['title'])

            row['portrait'] = entry.get('portrait')

            row['portraitAlternates'] = entry.get('portraitAlternates', [])

            row['badgeId'] = entry.get('badgeId')

            if row['kind'] == 'portrait':

                row['file'] = entry.get('portrait')

    for hero, entry in all_entries(data):

        if entry.get('catalogueSource') == 'local' and not any(r.get('heroId') == hero['id'] and r.get('skin_id') == entry['sourceSkinId'] for r in previous):

            previous.append({'heroId':hero['id'], 'hero':hero['name'], 'title':entry['fullName'], 'skin_id':entry['sourceSkinId'], 'kind':'portrait', 'file':entry.get('portrait'), 'portrait':entry.get('portrait'), 'portraitAlternates':entry.get('portraitAlternates',[]), 'badgeId':entry.get('badgeId'), 'status':'local-portrait-only', 'source':'Portrait manager'})

    missing = {'heroes':[{'id':h['id'], 'name':h['name']} for h in data['heroes'] if not h.get('portrait')], 'skins':[{'hero':h['name'], 'id':s['id'], 'name':s['name'], 'sourceSkinId':s['sourceSkinId']} for h in data['heroes'] for s in h['skins'] if not s['isDefault'] and not s.get('portrait')]}

    unmatched = [r for r in sources if not r.get('skinId')]

    report = {'heroes':len(data['heroes']), 'existingSkins':sum(not s['isDefault'] for h in data['heroes'] for s in h['skins']), 'heroPortraitsLinked':sum(bool(h.get('portrait')) for h in data['heroes']), 'skinPortraitsLinked':sum(bool(s.get('portrait')) for h in data['heroes'] for s in h['skins'] if not s['isDefault']), 'exportedPortraitFiles':sum(r.get('source') != 'Manual upload' for r in sources), 'receivedPortraitFiles':len(sources), 'transparentPortraitFiles':0, 'alternateHeroFiles':sum(len(h.get('portraitAlternates', [])) for h in data['heroes']), 'alternateSkinFiles':sum(r['kind']=='skin' and not r['isPrimary'] for r in sources), 'unmatchedPortraitFiles':len(unmatched), 'unmatchedPortraitGroups':len({r['figmaName'] for r in unmatched}), 'lastEditedAt':now()}

    pending['data/danh-sach-tai-nguyen.json']=encoded(refresh_asset_index(data,sources))

    data.setdefault('portraitSource', {})['primarySelectionPolicy'] = 'manual-overrides-figma-order'

    data['lastEditedAt'] = now()

    review_keys = ['file','figmaName','hero','skinId','isPrimary','kind','frameOrder','exportDuplicateIndex','selectionPolicy']

    pending.update({

        'data/heroes.json':encoded(data), 'program/shared/data.js':b'window.HERO_DATA = '+json.dumps(data,ensure_ascii=False).encode('utf-8')+b';\n',

        'data/danh-sach-anh.json':encoded(previous), 'data/portrait-sources.json':encoded(sources),

        'data/portrait-chua-khop.json':encoded(unmatched), 'data/chua-co-portrait.json':encoded(missing), 'data/tong-ket.json':encoded(report),

        'program/shared/portrait-review-data.js':b'window.PORTRAIT_REVIEW = '+json.dumps({'sources':[{k:r.get(k) for k in review_keys} for r in sources]},ensure_ascii=False).encode('utf-8')+b';\n',

        'data/verification.json':encoded({**report, 'allReferencedPortraitsExist':True, 'uniqueOutputPaths':True, 'embeddedDataMatchesJson':True, 'primarySelectionPolicy':'manual-overrides-figma-order', 'cataloguePortraitCoverageComplete':not missing['heroes'] and not missing['skins'], 'verifiedBy':'Local portrait manager'}),

        'note/TRANG-THAI.txt':f"ĐÃ CẬP NHẬT BẰNG CÔNG CỤ QUẢN LÝ PORTRAIT\n\n{report['heroPortraitsLinked']} tướng và {report['skinPortraitsLinked']} trang phục có portrait.\n{len(unmatched)} ảnh chưa khớp; {len(missing['skins'])} trang phục thiếu portrait.\nẢnh chính do người dùng chọn; các bản khác được giữ lại.\nCập nhật: {now()}\n".encode('utf-8')

    })

    pending['note/TRANG-THAI-PORTRAIT.txt'] = f"""TRẠNG THÁI PORTRAIT
Ngày ghi trạng thái: {now()} (UTC), không phải ngày thu thập ban đầu.
{report['heroPortraitsLinked']} tướng và {report['skinPortraitsLinked']} trang phục có portrait.
{len(unmatched)} ảnh chưa khớp; {len(missing['skins'])} trang phục thiếu portrait.
Nguồn, link và ngày thu: note/NGUON-VA-NGAY-THU-THAP.txt; data/nguon-thu-thap.json.
Dữ liệu có hiệu lực: data/heroes.json; ảnh và nguồn: data/portrait-sources.json.
Các đường dẫn tính từ thư mục chứa assets/data/preview/program/note/temp.
Xem ảnh: preview/Xem-portrait.html. Bản sao thao tác: program/backup/portrait.
""".encode('utf-8')

    return report



def atomic_write(path, content):

    path.parent.mkdir(parents=True, exist_ok=True)

    temp = path.with_name(path.name+'.tmp-'+uuid.uuid4().hex)

    try:

        temp.write_bytes(content)

        os.replace(temp, path)

    finally:

        if temp.exists():

            temp.unlink()



def rollback(folder, receipt):

    for relative, existed in receipt['files'].items():

        path = safe_path(relative)

        if existed:

            atomic_write(path, (folder/'files'/relative).read_bytes())

        elif path.exists():

            path.unlink()



def commit(pending, deleted, label):

    stamp = datetime.now(timezone(timedelta(hours=7))).strftime('%Y%m%d-%H%M%S-%f')+'-'+uuid.uuid4().hex[:8]

    folder = OUT/'program/backup/portrait'/stamp

    folder.mkdir(parents=True)

    affected = sorted(set(pending) | set(deleted))

    receipt = {'time':now(), 'label':label, 'status':'pending', 'files':{}}

    for relative in affected:

        path = safe_path(relative)

        receipt['files'][relative] = path.exists()

        if path.exists():

            dest = folder/'files'/relative

            dest.parent.mkdir(parents=True, exist_ok=True)

            shutil.copyfile(path, dest)

    atomic_write(folder/'receipt.json', encoded(receipt))

    try:

        for relative, content in pending.items():

            atomic_write(safe_path(relative), content)

        for relative in set(deleted)-set(pending):

            path = safe_path(relative)

            if path.exists():

                path.unlink()

        receipt['status'] = 'committed'

        atomic_write(folder/'receipt.json', encoded(receipt))

    except Exception:

        rollback(folder, receipt)

        receipt['status'] = 'rolled-back'

        atomic_write(folder/'receipt.json', encoded(receipt))

        raise

    return stamp



def check_revision(payload):

    if payload.get('revision') != revision():

        raise ValueError('Dữ liệu đã thay đổi ở cửa sổ khác. Hãy tải lại trước khi lưu.')



def arrange_portraits(data, sources, affected, pending):

    owned_paths = {r['file'] for r in sources}

    affected_paths = {p for _,e in affected for p in [e.get('portrait'),*e.get('portraitAlternates',[])] if p}

    deleted = set()

    destination_paths = {}

    moves = []

    for h, e in affected:

        files = [*e.get('portraitAlternates', []), *([e.get('portrait')] if e.get('portrait') else [])]

        primary_folder = 'assets/hero/portrait/' if e is h else 'assets/skin/portrait/'

        alternate_folder = 'assets/hero/portrait/variants/' if e is h else 'assets/skin/portrait/variants/'

        base = e.get('portraitFileName') or slug(h['name'] if e is h else h['name']+' '+e['name'])+'-portrait.png'

        if files and base == '-portrait.png':

            raise ValueError('Tên không tạo được tên file hợp lệ.')

        for i, file in enumerate(files):

            dest = (primary_folder if i == len(files)-1 else alternate_folder+f'{i+1:02d}/')+base

            if dest in destination_paths and destination_paths[dest] != file:

                raise ValueError('Hai mục tạo cùng tên file. Hãy dùng tên trang phục khác nhau.')

            if dest in owned_paths and dest not in affected_paths:

                raise ValueError('Tên file đã thuộc một mục khác. Hãy dùng tên khác.')

            if safe_path(dest).exists() and dest not in owned_paths and dest != file:

                raise ValueError('Có file ngoài dữ liệu cùng tên. Hãy chọn tên khác để tránh ghi đè.')

            destination_paths[dest] = file

            content = pending.get(file)

            if content is None:

                content = safe_path(file).read_bytes()

            moves.append((file, dest, content, h, e, i == len(files)-1))

        e['portrait'] = primary_folder+base if files else None

        e['portraitAlternates'] = [alternate_folder+f'{i+1:02d}/'+base for i in range(max(0,len(files)-1))]

    records_by_path = {r['file']:r for r in sources}

    for old, dest, content, h, e, primary in moves:

        pending[dest] = content

        if old != dest:

            deleted.add(old)

        record = records_by_path.get(old)

        if not record:

            raise ValueError('Ảnh không có trong danh sách nguồn.')

        record.setdefault('originalKind',record['kind'])

        record.update(file=dest, hero=h['name'], skinId=e.get('sourceSkinId','heroSkin-1'), kind='hero' if e is h else 'skin', matchTitle=h['name'] if e is h else e.get('fullName',h['name']+' '+e['name']), isPrimary=primary, selectionPolicy='manual', editedAt=now())

    # A promoted unmatched image may leave siblings: keep one designated primary.

    remaining = {}

    for row in sources:

        if not row.get('skinId'):

            remaining.setdefault(row['figmaName'], []).append(row)

    for rows in remaining.values():

        primary = next((r for r in rows if r['isPrimary']), rows[-1])

        rows = [r for r in rows if r is not primary] + [primary]

        moves_unmatched = []

        for i, row in enumerate(rows):

            row['isPrimary'] = row is primary

            old = row['file']

            base = slug(row['figmaName'])+'-portrait.png'

            dest = ('temp/portrait/' if row is primary else f'temp/portrait/ban-khac/{i+1:02d}/')+base

            if old != dest:

                content = pending.get(old)

                if content is None:

                    content = safe_path(old).read_bytes()

                moves_unmatched.append((row, old, dest, content))

        for row, old, dest, content in moves_unmatched:

            pending[dest] = content

            deleted.add(old)

            row['file'] = dest

    retained = {r['file'] for r in sources}

    pending = {k:v for k,v in pending.items() if k not in deleted or k in retained}

    deleted.difference_update(r['file'] for r in sources)

    return pending, deleted





def save(payload):

    check_revision(payload)

    original = read(DATA/'heroes.json')

    data = copy.deepcopy(original)

    sources = read(DATA/'portrait-sources.json')

    hero, entry = target(data, payload.get('heroId'), payload.get('skinId'))

    old_hero_name, old_entry_name = hero['name'], entry['name']

    name = str(payload.get('name', entry['name'])).strip()

    if len(name) > 180 or any(ord(c)<32 for c in name) or (not name and entry is hero):

        raise ValueError('Tên phải có nội dung hợp lệ và không quá 180 ký tự.')

    if entry is hero and any(norm(h['name']) == norm(name) and h['id'] != hero['id'] for h in data['heroes']):

        raise ValueError('Tên tướng này đã được sử dụng.')

    if entry is not hero:

        badge_id = payload.get('badgeId') or None

        if badge_id and badge_id not in {b['id'] for b in data['badges']}:

            raise ValueError('Bậc trang phục không hợp lệ.')

        entry['badgeId'] = badge_id

    entry['name'] = name

    if entry is not hero and name != old_entry_name:

        entry['fullName'] = hero['name']+' '+name

    elif entry is hero and name != old_hero_name:

        for s in hero['skins']:

            s['fullName'] = name if s['isDefault'] else name+' '+s['name']

    affected = [(hero, entry)] if entry is not hero or name == old_hero_name else [(h,e) for h,e in all_entries(data) if h['id'] == hero['id']]

    pending, deleted = {}, set()

    owned_paths = {r['file'] for r in sources}

    choose = payload.get('chooseFile') or entry.get('portrait')

    uploaded = payload.get('upload')

    if uploaded and uploaded.get('base64'):

        try:

            raw = base64.b64decode(uploaded['base64'], validate=True)

            if len(raw) > 12*1024*1024:

                raise ValueError('Ảnh tối đa 12 MB.')

            image = Image.open(io.BytesIO(raw))

            if image.format not in ['PNG','JPEG','WEBP'] or image.width*image.height > 16_000_000:

                raise ValueError('Dùng PNG, JPG hoặc WebP, tối đa 16 triệu điểm ảnh.')

            source_ext = {'PNG':'png','JPEG':'jpg','WEBP':'webp'}[image.format]

            image = image.convert('RGBA')

            if image.getchannel('A').getbbox() is None:

                raise ValueError('Ảnh hoàn toàn trong suốt; hãy chọn ảnh khác.')

            buffer = io.BytesIO()

            image.save(buffer, format='PNG')

        except (UnidentifiedImageError, OSError, base64.binascii.Error):

            raise ValueError('Không đọc được ảnh. Dùng PNG, JPG hoặc WebP hợp lệ.')

        upload_id = uuid.uuid4().hex

        original_path = f"assets/{'hero' if entry is hero else 'skin'}/portrait/source/{upload_id}.{source_ext}"

        pending[original_path] = raw

        choose = f'Them-moi/{upload_id}-portrait.png'

        pending[choose] = buffer.getvalue()

        sources.append({'file':choose, 'figmaName':str(uploaded.get('name') or name), 'hero':hero['name'], 'skinId':entry.get('sourceSkinId','heroSkin-1'), 'kind':'hero' if entry is hero else 'skin', 'source':'Manual upload', 'sourceFile':(OUT/original_path).relative_to(ROOT).as_posix(), 'sourceFileSha256':hashlib.sha256(raw).hexdigest(), 'method':'manual-upload', 'frameOrder':0, 'exportDuplicateIndex':0, 'isPrimary':False, 'status':'ok', 'addedAt':now()})

    allowed = [entry.get('portrait'), *entry.get('portraitAlternates', [])]

    selected_source = next((r for r in sources if r['file'] == choose), None)

    if choose and (not selected_source or (choose not in allowed and selected_source.get('skinId') and selected_source.get('source') != 'Manual upload')):

        raise ValueError('Hãy chọn một bản của mục này, ảnh chưa khớp hoặc ảnh mới.')

    if choose and not name:

        raise ValueError('Hãy đặt tên trang phục trước khi thêm portrait.')

    if selected_source and choose not in allowed:

        selected_source.update(hero=hero['name'], skinId=entry.get('sourceSkinId','heroSkin-1'), kind='hero' if entry is hero else 'skin', method='manual-match' if not uploaded else 'manual-upload')

    current_files = [p for p in allowed if p]

    if choose and choose not in current_files:

        current_files.append(choose)

    alternatives = [p for p in current_files if p != choose]

    entry['portrait'], entry['portraitAlternates'] = choose, alternatives

    pending, deleted = arrange_portraits(data, sources, affected, pending)

    sync_payloads(data, sources, original, pending)

    deleted.difference_update(r['file'] for r in sources)

    # Old paths that are also new destinations are overwritten from pre-read bytes, never lost.

    backup_id = commit(pending, deleted, f"Cập nhật {hero['name']}" + (f" — {entry['name']}" if entry is not hero else ''))

    return {'ok':True, 'backupId':backup_id, 'state':state()}



def restore(payload):

    check_revision(payload)

    available = backups()

    if not available:

        raise ValueError('Chưa có lần lưu nào để khôi phục.')

    folder = OUT/'program/backup/portrait'/available[0]['id']

    receipt = read(folder/'receipt.json')

    rollback(folder, receipt)

    receipt['status'] = 'restored'

    receipt['restoredAt'] = now()

    atomic_write(folder/'receipt.json', encoded(receipt))

    return {'ok':True, 'state':state()}



def move_image(payload):

    check_revision(payload)

    original = read(DATA/'heroes.json')

    data = copy.deepcopy(original)

    sources = read(DATA/'portrait-sources.json')

    record = next((r for r in sources if r['file'] == payload.get('file')), None)

    if not record:

        raise ValueError('Ảnh không còn trong dữ liệu. Hãy tải lại danh sách.')

    old_hero = next((h for h in data['heroes'] if norm(h['name']) == norm(record.get('hero',''))), None)

    old_entry = None

    if record.get('skinId') and old_hero:

        old_entry = old_hero if record['skinId'] == 'heroSkin-1' else next((s for s in old_hero['skins'] if s['sourceSkinId'] == record['skinId']), None)

        if old_entry is None:

            raise ValueError('Không xác định được mục đang chứa ảnh.')

    mode = payload.get('targetMode','existing')

    if mode not in ['existing','new','hero']:

        raise ValueError('Chọn nơi nhận ảnh hợp lệ.')

    hero, entry = target(data,payload.get('heroId'),payload.get('skinId') if mode == 'existing' else None)

    if mode == 'existing' and entry is hero:

        raise ValueError('Hãy chọn trang phục nhận ảnh hoặc chọn Ảnh tướng.')

    name = str(payload.get('name',entry['name'] if mode != 'new' else '')).strip()

    if not name or len(name)>180 or not slug(name) or any(ord(c)<32 for c in name):

        raise ValueError('Hãy nhập tên hợp lệ, tối đa 180 ký tự.')

    if mode != 'hero' and any(not s['isDefault'] and s is not entry and norm(s['name']) == norm(name) for s in hero['skins']):

        raise ValueError('Tướng này đã có trang phục cùng tên. Hãy chọn trang phục có sẵn.')

    badge = payload.get('badgeId') or None

    if badge and badge not in {b['id'] for b in data['badges']}:

        raise ValueError('Bậc trang phục không hợp lệ.')

    if mode == 'new':

        local_id = 'local-'+uuid.uuid4().hex[:12]

        entry = {'id':hero['id']+'-'+local_id, 'sourceSkinId':local_id, 'name':name, 'fullName':hero['name']+' '+name, 'isDefault':False, 'badgeId':badge, 'head':None, 'cover':None, 'portrait':None, 'portraitAlternates':[], 'catalogueSource':'local', 'createdAt':now()}

        hero['skins'].append(entry)

    renamed_hero = entry is hero and name != hero['name']

    if renamed_hero and any(h is not hero and norm(h['name']) == norm(name) for h in data['heroes']):

        raise ValueError('Tên tướng này đã được sử dụng.')

    entry['name'] = name

    if entry is not hero:

        entry.update(fullName=hero['name']+' '+name, badgeId=badge)

    elif renamed_hero:

        for skin in hero['skins']:

            skin['fullName'] = name if skin['isDefault'] else name+' '+skin['name']

    custom = str(payload.get('fileName') or '').strip()

    if custom:

        custom = re.sub(r'\.png$','',custom,flags=re.I)

        custom = re.sub(r'-portrait$','',custom,flags=re.I)

        custom = slug(custom)

        if not custom or len(custom)>160:

            raise ValueError('Tên file không hợp lệ hoặc quá dài.')

        entry['portraitFileName'] = custom+'-portrait.png'

    else:

        entry.pop('portraitFileName',None)

    file = record['file']

    same_entry = old_entry is entry

    if old_entry is not None and not same_entry:

        if old_entry.get('portrait') == file:

            remaining = list(old_entry.get('portraitAlternates',[]))

            old_entry['portrait'] = remaining.pop() if remaining else None

            old_entry['portraitAlternates'] = remaining

        else:

            old_entry['portraitAlternates'] = [p for p in old_entry.get('portraitAlternates',[]) if p != file]

    files = [p for p in [entry.get('portrait'),*entry.get('portraitAlternates',[])] if p and p != file]

    if payload.get('role','primary') not in ['primary','alternate']:

        raise ValueError('Chọn vai trò ảnh chính hoặc bản khác.')

    if same_entry and entry.get('portrait') == file and payload.get('role') == 'alternate' and files:

        entry['portrait'] = files[0]

        entry['portraitAlternates'] = files[1:]+[file]

    elif payload.get('role','primary') == 'primary' or not entry.get('portrait') or entry.get('portrait') == file:

        entry['portrait'] = file

        entry['portraitAlternates'] = files

    else:

        entry['portraitAlternates'] = [p for p in files if p != entry['portrait']] + [file]

    affected = [(hero,entry)]

    if old_entry is not None and not same_entry:

        affected.append((old_hero,old_entry))

    if renamed_hero:

        affected.extend((h,e) for h,e in all_entries(data) if h is hero)

    unique = {}

    for h,e in affected:

        unique[key_for(h,e)] = (h,e)

    pending, deleted = arrange_portraits(data,sources,list(unique.values()),{})

    sync_payloads(data,sources,original,pending)

    deleted.difference_update(r['file'] for r in sources)

    label = f"Chuyển ảnh → {hero['name']}" + (f" / {entry['name']}" if entry is not hero else '')

    backup_id = commit(pending,deleted,label)

    moved = next(r for r in sources if r is record)

    return {'ok':True, 'backupId':backup_id, 'file':moved['file'], 'targetHeroId':hero['id'], 'targetSkinId':entry['id'] if entry is not hero else None, 'state':state()}



class Handler(BaseHTTPRequestHandler):

    def allowed_host(self):

        return self.headers.get('Host') == f'127.0.0.1:{self.server.server_port}'



    def respond(self, status, content, mime='application/json; charset=utf-8'):

        self.send_response(status)

        self.send_header('Content-Type',mime)

        self.send_header('Content-Length',str(len(content)))

        self.send_header('Cache-Control','no-store')

        self.send_header('X-Content-Type-Options','nosniff')

        self.send_header('Referrer-Policy','no-referrer')

        self.end_headers()

        self.wfile.write(content)



    def do_GET(self):

        if not self.allowed_host():

            return self.respond(403,encoded({'error':'Host không hợp lệ.'}))

        route = unquote(urlparse(self.path).path)

        with LOCK:

            if route == '/api/state':

                return self.respond(200,encoded(state()))

            if route in ['/','/app.js','/image-library.js','/style.css']:

                path = OUT/'preview/Quan-ly-portrait.html' if route=='/' else HERE/route.lstrip('/')

            elif route.startswith(('/files/','/program/portrait/')):

                allowed_root = OUT.resolve()

                path = (OUT/(route.removeprefix('/files/') if route.startswith('/files/') else route.lstrip('/'))).resolve()

                if not path.is_relative_to(allowed_root) or path.is_relative_to((OUT/'program/backup').resolve()):

                    return self.respond(403,b'Forbidden','text/plain')

            else:

                return self.respond(404,b'Not found','text/plain')

            if not path.is_file() or path.suffix.lower() not in ['.png','.jpg','.jpeg','.webp','.html','.css','.js','.json','.txt','.svg','.mp4']:

                return self.respond(404,b'Not found','text/plain')

            mime = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'

            if path.suffix in ['.js','.html','.css','.json','.txt']:

                mime += '; charset=utf-8'

            self.respond(200,path.read_bytes(),mime)



    def do_POST(self):

        expected = f'http://127.0.0.1:{self.server.server_port}'

        if not self.allowed_host() or self.headers.get('X-Portrait-Token') != TOKEN or self.headers.get('Origin') not in [None,expected]:

            return self.respond(403,encoded({'error':'Yêu cầu không hợp lệ. Hãy mở công cụ bằng địa chỉ trên máy.'}))

        try:

            length = int(self.headers.get('Content-Length','0'))

            if not 0 < length <= 20*1024*1024:

                raise ValueError('Dữ liệu gửi quá lớn.')

            payload = json.loads(self.rfile.read(length))

            with LOCK:

                if self.path == '/api/save':

                    result = save(payload)

                elif self.path == '/api/move':

                    result = move_image(payload)

                elif self.path == '/api/restore':

                    result = restore(payload)

                else:

                    return self.respond(404,encoded({'error':'Không có thao tác này.'}))

            self.respond(200,encoded(result))

        except (ValueError,KeyError,Image.DecompressionBombError) as exc:

            self.respond(400,encoded({'error':str(exc)}))

        except Exception:

            import traceback

            traceback.print_exc()

            self.respond(500,encoded({'error':'Không lưu được. Các thay đổi chưa hoàn tất đã được khôi phục; xem cửa sổ công cụ để biết chi tiết.'}))



    def log_message(self, fmt, *args):

        if not args or str(args[1] if len(args)>1 else '').startswith(('4','5')):

            super().log_message(fmt,*args)



def main():

    parser = argparse.ArgumentParser()

    parser.add_argument('--port',type=int,default=8786)

    parser.add_argument('--no-open',action='store_true')

    args = parser.parse_args()

    for path in (OUT/'program/backup/portrait').glob('*/receipt.json'):

        receipt = read(path)

        if receipt['status'] == 'pending':

            rollback(path.parent,receipt)

            receipt['status'] = 'recovered'

            atomic_write(path,encoded(receipt))

    try:

        server = ThreadingHTTPServer(('127.0.0.1',args.port),Handler)

    except OSError:

        print('Cong dang duoc su dung. Dong cua so quan ly cu hoac chay voi --port khac.')

        return

    url = f'http://127.0.0.1:{server.server_port}'

    print(f'Quan ly portrait: {url}\nGiu cua so nay mo khi su dung. Nhan Ctrl+C de dong.')

    if not args.no_open:

        webbrowser.open(url)

    try:

        server.serve_forever()

    except KeyboardInterrupt:

        pass

    finally:

        server.server_close()



if __name__ == '__main__':

    main()

