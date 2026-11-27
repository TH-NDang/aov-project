-- Publishes the 5v5 battlefield map transcribed from the game's battlefield encyclopedia (screenshots and a screen
-- recording taken on 2026-11-27). Positions were measured on the in-game minimap; which small monster sits in which
-- jungle camp is a best guess that editors can correct in Admin.
-- A database without the 5v5 mode, or one whose 5v5 mode already has a map, is left unchanged.
INSERT INTO gamemode.map_guide_revision (id, mode_id, revision_no, state, version, content, change_note, published_at,
    created_at, created_by_issuer, created_by_subject, updated_at, updated_by_issuer, updated_by_subject)
SELECT '5c0b7f3e-2f8d-4c7a-9d43-1f6a2b8e7c51', mode.id, 1, 'PUBLISHED', 1, $json${
  "name": "Bách khoa chiến trường",
  "observedOn": "2026-11-27",
  "summary": null,
  "backgroundAssetId": null,
  "objects": [
    {
      "code": "te-dan",
      "name": "Tế đàn",
      "category": "STRUCTURE",
      "glyph": "ALTAR",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": null,
      "tags": [
        "Công trình"
      ],
      "summary": "Nơi tướng xuất hiện và hồi sinh",
      "firstSpawn": null,
      "respawn": null,
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "- Là nơi tướng xuất hiện đầu trận và hồi sinh\n- Tướng phe ta trong tế đàn sẽ được hồi nhanh máu và năng lượng\n- Tế đàn có thể bảo vệ tướng phe ta, gây sát thương khủng khiếp cho địch trong phạm vi"
        }
      ],
      "change": null,
      "positions": [
        {
          "key": "xanh",
          "side": "BLUE",
          "label": null,
          "x": 3.5,
          "y": 96.5
        },
        {
          "key": "do",
          "side": "RED",
          "label": null,
          "x": 96.5,
          "y": 3.5
        }
      ]
    },
    {
      "code": "nha-chinh",
      "name": "Nhà chính",
      "category": "STRUCTURE",
      "glyph": "BASE",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": null,
      "tags": [
        "Công trình"
      ],
      "summary": "Phá hủy nhà chính địch để thắng",
      "firstSpawn": null,
      "respawn": null,
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Bảo hộ nhà chính không bị địch tấn công, phá hủy nhà chính địch sẽ giành chiến thắng.\nĐiều kiện tấn công nhà chính: Phá hủy trụ trong trên đường bất kỳ phe địch là có thể tấn công nhà chính\nNhà chính hồi phục: Nhà chính rời giao tranh sẽ hồi máu dần dần."
        },
        {
          "title": "Đặc tính",
          "body": "Trụ tấn công: Mỗi lần bắn ra gây sát thương vật lý và liên tục công kích 1 tướng địch, sát thương mỗi lần bắn tăng 60%, tối đa tăng đến 300% và bỏ qua giáp\nTrụ đề kháng: Khi không có lính phe địch trong phạm vi, trụ ngoài sẽ được giảm 80% sát thương phải chịu.\nTầm nhìn chuẩn: Nhà chính và trụ có thể cung cấp tầm nhìn chuẩn cho tướng giúp phát hiện các kẻ địch tàng hình trong phạm vi.\nMiễn chí mạng: Nhà chính và trụ sẽ không phải chịu sát thương chí mạng từ tướng địch."
        }
      ],
      "change": null,
      "positions": [
        {
          "key": "xanh",
          "side": "BLUE",
          "label": null,
          "x": 8.5,
          "y": 91.4
        },
        {
          "key": "do",
          "side": "RED",
          "label": null,
          "x": 91.5,
          "y": 8.6
        }
      ]
    },
    {
      "code": "tru-trong",
      "name": "Trụ trong",
      "category": "STRUCTURE",
      "glyph": "TOWER",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": null,
      "tags": [
        "Công trình"
      ],
      "summary": null,
      "firstSpawn": null,
      "respawn": null,
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Làm mới lính siêu cấp: Sau khi phá hủy trụ trong của địch, đường tương ứng phe ta sẽ có lính siêu cấp xuất chiến\nLàm mới lính siêu cấp cường hóa: Sau khi phá hủy trụ trong trên cả 3 đường của địch, lính siêu cấp cường hóa sẽ xuất chiến và di chuyển theo đường giữa phe ta đồng thời trực chỉ nhà chính phe địch\nTrụ trong bị phá hủy sẽ kích hoạt hiệu ứng làm chậm tốc chạy tất cả lính địch trong phạm vi 90%, kéo dài 5 giây"
        },
        {
          "title": "Đặc tính",
          "body": "Bảo vệ dưới trụ: Trong 4 phút đầu tướng địch trong phạm vi trụ phe ta sẽ bị giảm 10% sát thương gây ra.\nTrụ tấn công: Mỗi lần bắn ra gây sát thương vật lý và liên tục công kích 1 tướng địch, sát thương mỗi lần bắn tăng 60%, tối đa tăng đến 300% và bỏ qua giáp\nTrụ đề kháng: Khi không có lính phe địch trong phạm vi, trụ trong sẽ được giảm 70% sát thương phải chịu.\nTầm nhìn chuẩn: Trụ trong có thể cung cấp tầm nhìn chuẩn giúp phát hiện các kẻ địch tàng hình trong phạm vi\nMiễn chí mạng: Trụ trong sẽ không phải chịu sát thương chí mạng từ tướng địch"
        }
      ],
      "change": null,
      "positions": [
        {
          "key": "xanh-caesar",
          "side": "BLUE",
          "label": "Đường Caesar",
          "x": 3.8,
          "y": 75.7
        },
        {
          "key": "xanh-giua",
          "side": "BLUE",
          "label": "Đường giữa",
          "x": 17.9,
          "y": 82.9
        },
        {
          "key": "xanh-rong",
          "side": "BLUE",
          "label": "Đường Rồng",
          "x": 24.6,
          "y": 96.4
        },
        {
          "key": "do-rong",
          "side": "RED",
          "label": "Đường Rồng",
          "x": 96.2,
          "y": 24.3
        },
        {
          "key": "do-giua",
          "side": "RED",
          "label": "Đường giữa",
          "x": 82.1,
          "y": 17.1
        },
        {
          "key": "do-caesar",
          "side": "RED",
          "label": "Đường Caesar",
          "x": 75.4,
          "y": 3.6
        }
      ]
    },
    {
      "code": "tru-giua",
      "name": "Trụ giữa",
      "category": "STRUCTURE",
      "glyph": "TOWER",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": null,
      "tags": [
        "Công trình"
      ],
      "summary": null,
      "firstSpawn": null,
      "respawn": null,
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Trụ giữa bị hủy sẽ làm chậm tốc chạy tất cả lính địch trong phạm vi 60% trong 5 giây"
        },
        {
          "title": "Đặc tính",
          "body": "Bảo vệ dưới trụ: Trong 4 phút đầu tướng địch trong phạm vi trụ phe ta sẽ bị giảm 10% sát thương gây ra.\nTrụ tấn công: Mỗi lần bắn ra gây sát thương vật lý và liên tục công kích 1 tướng địch, sát thương mỗi lần bắn tăng 60%, tối đa tăng đến 300% và bỏ qua giáp\nTrụ đề kháng: Khi không có lính phe địch trong phạm vi, trụ ngoài sẽ được giảm 60% sát thương phải chịu.\nTầm nhìn chuẩn: Nhà chính và trụ có thể cung cấp tầm nhìn chuẩn giúp phát hiện các kẻ địch tàng hình trong phạm vi\nMiễn chí mạng: Nhà chính và trụ sẽ không phải chịu sát thương chí mạng từ tướng địch"
        }
      ],
      "change": null,
      "positions": [
        {
          "key": "xanh-caesar",
          "side": "BLUE",
          "label": "Đường Caesar",
          "x": 3.0,
          "y": 56.7
        },
        {
          "key": "xanh-giua",
          "side": "BLUE",
          "label": "Đường giữa",
          "x": 31.8,
          "y": 70.5
        },
        {
          "key": "xanh-rong",
          "side": "BLUE",
          "label": "Đường Rồng",
          "x": 47.5,
          "y": 96.5
        },
        {
          "key": "do-rong",
          "side": "RED",
          "label": "Đường Rồng",
          "x": 97.0,
          "y": 43.3
        },
        {
          "key": "do-giua",
          "side": "RED",
          "label": "Đường giữa",
          "x": 68.2,
          "y": 29.5
        },
        {
          "key": "do-caesar",
          "side": "RED",
          "label": "Đường Caesar",
          "x": 52.5,
          "y": 3.5
        }
      ]
    },
    {
      "code": "tru-ngoai",
      "name": "Trụ ngoài",
      "category": "STRUCTURE",
      "glyph": "TOWER",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": null,
      "tags": [
        "Công trình"
      ],
      "summary": null,
      "firstSpawn": null,
      "respawn": null,
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Đầu trận trụ ngoài sẽ có phòng tuyến bảo hộ giúp tướng yên tâm farm\nTrước 4 phút trụ ngoài được tăng miễn thương, được giảm 60% sát thương phải chịu (tối đa được giảm đến 90%)\nTrụ ngoài bị hủy sẽ gây ra hiệu ứng làm chậm tốc chạy của tất cả lính địch trong phạm vi 30%, kéo dài 5 giây"
        },
        {
          "title": "Đặc tính",
          "body": "Bảo vệ dưới trụ: Trong 4 phút đầu tướng địch trong phạm vi trụ phe ta sẽ bị giảm 10% sát thương gây ra.\nTrụ tấn công: Mỗi lần bắn ra gây sát thương vật lý và liên tục công kích 1 tướng địch, sát thương mỗi lần bắn tăng 60%, tối đa tăng đến 300% và bỏ qua giáp\nTrụ đề kháng: Khi không có lính phe địch trong phạm vi, trụ ngoài sẽ được giảm 60% sát thương phải chịu.\nTầm nhìn chuẩn: Nhà chính và trụ có thể cung cấp tầm nhìn chuẩn giúp phát hiện các kẻ địch tàng hình trong phạm vi\nMiễn chí mạng: Nhà chính và trụ sẽ không phải chịu sát thương chí mạng từ tướng địch"
        }
      ],
      "change": null,
      "positions": [
        {
          "key": "xanh-caesar",
          "side": "BLUE",
          "label": "Đường Caesar",
          "x": 2.7,
          "y": 27.9
        },
        {
          "key": "xanh-giua",
          "side": "BLUE",
          "label": "Đường giữa",
          "x": 39.1,
          "y": 58.3
        },
        {
          "key": "xanh-rong",
          "side": "BLUE",
          "label": "Đường Rồng",
          "x": 72.1,
          "y": 96.8
        },
        {
          "key": "do-rong",
          "side": "RED",
          "label": "Đường Rồng",
          "x": 97.3,
          "y": 72.1
        },
        {
          "key": "do-giua",
          "side": "RED",
          "label": "Đường giữa",
          "x": 60.9,
          "y": 41.7
        },
        {
          "key": "do-caesar",
          "side": "RED",
          "label": "Đường Caesar",
          "x": 27.9,
          "y": 3.2
        }
      ]
    },
    {
      "code": "linh-can-chien",
      "name": "Lính cận chiến",
      "category": "MINION",
      "glyph": "MINION",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": null,
      "tags": [
        "Lính"
      ],
      "summary": null,
      "firstSpawn": {
        "seconds": 10,
        "note": "Giây thứ 10"
      },
      "respawn": {
        "seconds": 33,
        "note": "Mỗi 33 giây"
      },
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Mỗi đợt lính có 1 lính cận chiến (đường giữa có 2 lính), máu khá cao nhưng công bình thường.\nMỗi tuyến đường của cả 2 phe đều có lính, đây là nguồn chủ yếu cung cấp vàng và kinh nghiệm cho tướng."
        },
        {
          "title": "Thuộc tính",
          "body": "Tăng tốc lính: Vào phút thứ 4/8/12/15, lính sẽ được tăng tốc chạy.\nTăng sức mạnh: Sau 15 phút, lính được tăng thuộc tính, đẩy trụ sẽ nhanh hơn"
        },
        {
          "title": "Các lợi ích khác",
          "body": "Hạ giúp tướng nhận được vàng và kinh nghiệm."
        }
      ],
      "change": null,
      "positions": [
        {
          "key": null,
          "side": null,
          "label": null,
          "x": 50,
          "y": 50
        }
      ]
    },
    {
      "code": "linh-danh-xa",
      "name": "Lính đánh xa",
      "category": "MINION",
      "glyph": "RANGED",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": "linh-can-chien",
      "tags": [
        "Lính"
      ],
      "summary": null,
      "firstSpawn": {
        "seconds": 10,
        "note": "Giây thứ 10"
      },
      "respawn": {
        "seconds": 33,
        "note": "Mỗi 33 giây"
      },
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Mỗi đợt lính có 2 lính đánh xa, máu thấp nhưng công cao hơn lính cận chiến."
        },
        {
          "title": "Thuộc tính",
          "body": "Tăng tốc lính: Vào phút thứ 4/8/12/15, lính sẽ được tăng tốc chạy.\nTăng sức mạnh: Sau 15 phút, lính được tăng thuộc tính, đẩy trụ sẽ nhanh hơn"
        },
        {
          "title": "Các lợi ích khác",
          "body": "Hạ giúp tướng nhận được vàng và kinh nghiệm."
        }
      ],
      "change": null,
      "positions": []
    },
    {
      "code": "no-cong-thanh",
      "name": "Nỏ công thành",
      "category": "MINION",
      "glyph": "SIEGE",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": "linh-can-chien",
      "tags": [
        "Lính"
      ],
      "summary": null,
      "firstSpawn": {
        "seconds": 240,
        "note": "Phút thứ 4"
      },
      "respawn": {
        "seconds": 30,
        "note": "Mỗi 30 giây"
      },
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Nỏ công thành sẽ xuất kích vào phút thứ 4 và mỗi đợt lính sẽ gồm có 1 lính cận chiến, 1 lính đánh xa và 1 xe nỏ.\nNỏ công thành có thuộc tính mạnh hơn lính đánh xa nhiều và có lực sát thương nhất định lên trụ, khả năng đẩy đường ổn.\n- Sát thương nỏ công thành gây lên trụ: 200%\n- Sát thương trụ gây lên nỏ công thành: 50%"
        },
        {
          "title": "Thuộc tính",
          "body": "Tăng tốc lính: Vào phút thứ 4/8/12/15, lính sẽ được tăng tốc chạy.\nTăng sức mạnh: Sau 15 phút, lính được tăng thuộc tính, đẩy trụ sẽ nhanh hơn"
        },
        {
          "title": "Các lợi ích khác",
          "body": "Hạ giúp tướng nhận được vàng và kinh nghiệm."
        }
      ],
      "change": null,
      "positions": []
    },
    {
      "code": "phao-cong-thanh",
      "name": "Pháo công thành",
      "category": "MINION",
      "glyph": "SIEGE",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": "linh-can-chien",
      "tags": [
        "Lính"
      ],
      "summary": null,
      "firstSpawn": {
        "seconds": 480,
        "note": "Phút thứ 8"
      },
      "respawn": {
        "seconds": 30,
        "note": "Mỗi 30 giây"
      },
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Sau 8 phút, Pháo công thành xuất chiến thay thế nỏ công thành và có thuộc tính mạnh hơn nỏ công thành đồng thời có lực sát thương đáng gờm lên trụ, khả năng đẩy đường khá mạnh.\n- Sát thương pháo công thành gây lên trụ: 200%\n- Sát thương trụ gây lên pháo công thành: 50%"
        },
        {
          "title": "Thuộc tính",
          "body": "Tăng tốc lính: Vào phút thứ 4/8/12/15, lính sẽ được tăng tốc chạy.\nTăng sức mạnh: Sau 15 phút, lính được tăng thuộc tính, đẩy trụ sẽ nhanh hơn"
        },
        {
          "title": "Các lợi ích khác",
          "body": "Hạ giúp tướng nhận được vàng và kinh nghiệm."
        }
      ],
      "change": null,
      "positions": []
    },
    {
      "code": "linh-sieu-cap",
      "name": "Lính siêu cấp",
      "category": "MINION",
      "glyph": "SUPER",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": "linh-can-chien",
      "tags": [
        "Lính"
      ],
      "summary": null,
      "firstSpawn": {
        "seconds": null,
        "note": "Sau khi phá trụ trong của địch trên đường đó"
      },
      "respawn": {
        "seconds": 30,
        "note": "Mỗi 30 giây"
      },
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Sau khi phá hủy trụ trong của địch, đường tương ứng phe ta sẽ có lính siêu cấp xuất chiến."
        },
        {
          "title": "Thuộc tính",
          "body": "Tăng tốc lính: Vào phút thứ 4/8/12/15, lính sẽ được tăng tốc chạy.\nTăng sức mạnh: Sau 15 phút, lính được tăng thuộc tính, đẩy trụ sẽ nhanh hơn"
        },
        {
          "title": "Các lợi ích khác",
          "body": "Hạ giúp tướng nhận được vàng và kinh nghiệm."
        }
      ],
      "change": null,
      "positions": []
    },
    {
      "code": "linh-sieu-cap-cuong-hoa",
      "name": "Lính siêu cấp cường hóa",
      "category": "MINION",
      "glyph": "SUPER",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": "linh-can-chien",
      "tags": [
        "Lính"
      ],
      "summary": null,
      "firstSpawn": {
        "seconds": null,
        "note": "Sau khi phá hủy trụ trong trên cả 3 đường của địch, lính siêu cấp cường hóa sẽ xuất chiến và di chuyển theo đường giữa phe ta"
      },
      "respawn": {
        "seconds": 30,
        "note": "Mỗi 30 giây"
      },
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Lính siêu cấp cường hóa có công vật lý và máu cao hơn, đẩy đường mạnh hơn so với lính siêu cấp"
        },
        {
          "title": "Thuộc tính",
          "body": "Tăng tốc lính: Vào phút thứ 4/8/12/15, lính sẽ được tăng tốc chạy.\nTăng sức mạnh: Sau 15 phút, lính được tăng thuộc tính, đẩy trụ sẽ nhanh hơn"
        },
        {
          "title": "Các lợi ích khác",
          "body": "Hạ giúp tướng nhận được vàng và kinh nghiệm."
        }
      ],
      "change": null,
      "positions": []
    },
    {
      "code": "caesar-tien-phong",
      "name": "Caesar tiên phong",
      "category": "MINION",
      "glyph": "VANGUARD",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": "linh-can-chien",
      "tags": [
        "Lính",
        "Đẩy đường"
      ],
      "summary": null,
      "firstSpawn": {
        "seconds": null,
        "note": "Sau khi hạ Caesar, Caesar hắc ám, Caesar bạo chúa"
      },
      "respawn": {
        "seconds": 30,
        "note": "Mỗi 30 giây"
      },
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Sau khi hạ Caesar, Caesar hắc ám, Caesar bạo chúa, 3 đường phe ta sẽ gọi ra 2 đợt/2 đợt/3 đợt Caesar tiên phong/Caesar tiên phong/Caesar tiên phong bạo chúa. Caesar tiên phong có máu và lực công kích rất cao, có thể đánh xa và vàng hạ lính sẽ chia sẻ cho đồng đội. Caesar tiên phong bạo chúa còn có khả năng làm choáng trụ khiến trụ không thể bắn trong 2.5 giây.\n- Sát thương của Caesar tiên phong lên lính là 150%."
        },
        {
          "title": "Các lợi ích khác",
          "body": "Hạ giúp tướng nhận được vàng và kinh nghiệm."
        }
      ],
      "change": {
        "title": "Cơ chế mới của Caesar tiên phong",
        "body": "Vàng từ lính do Caesar tiên phong và Caesar bạo chúa tiên phong hạ sẽ được chia sẻ cho đồng đội phe mình"
      },
      "positions": []
    },
    {
      "code": "khi-ba-tieu",
      "name": "Khỉ ba tiêu",
      "category": "MONSTER",
      "glyph": "MONSTER",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": null,
      "tags": [
        "Quái rừng"
      ],
      "summary": null,
      "firstSpawn": {
        "seconds": 30,
        "note": "Giây thứ 30"
      },
      "respawn": {
        "seconds": 70,
        "note": "70 giây"
      },
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Quái rừng cận chiến"
        },
        {
          "title": "Các lợi ích khác",
          "body": "Hạ xong được hồi lượng máu nhất định\nHạ giúp tướng nhận được vàng và kinh nghiệm."
        }
      ],
      "change": null,
      "positions": [
        {
          "key": "xanh",
          "side": "BLUE",
          "label": null,
          "x": 17.5,
          "y": 30.1
        },
        {
          "key": "do",
          "side": "RED",
          "label": null,
          "x": 82.5,
          "y": 69.9
        }
      ]
    },
    {
      "code": "tho-nhay-nhot",
      "name": "Thỏ nhảy nhót",
      "category": "MONSTER",
      "glyph": "MONSTER",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": null,
      "tags": [
        "Quái rừng"
      ],
      "summary": null,
      "firstSpawn": {
        "seconds": 30,
        "note": "Giây thứ 30"
      },
      "respawn": {
        "seconds": 70,
        "note": "70 giây"
      },
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Quái rừng cận chiến"
        },
        {
          "title": "Các lợi ích khác",
          "body": "Hạ xong được hồi lượng máu nhất định\nHạ giúp tướng nhận được vàng và kinh nghiệm."
        }
      ],
      "change": null,
      "positions": [
        {
          "key": "xanh",
          "side": "BLUE",
          "label": null,
          "x": 13.4,
          "y": 45.0
        },
        {
          "key": "do",
          "side": "RED",
          "label": null,
          "x": 86.6,
          "y": 55.0
        }
      ]
    },
    {
      "code": "ech-xanh",
      "name": "Ếch xanh",
      "category": "MONSTER",
      "glyph": "MONSTER",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": null,
      "tags": [
        "Quái rừng"
      ],
      "summary": null,
      "firstSpawn": {
        "seconds": 30,
        "note": "Giây thứ 30"
      },
      "respawn": {
        "seconds": 70,
        "note": "70 giây"
      },
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Quái rừng cận chiến"
        },
        {
          "title": "Các lợi ích khác",
          "body": "Hạ xong được hồi lượng máu nhất định\nHạ giúp tướng nhận được vàng và kinh nghiệm."
        }
      ],
      "change": null,
      "positions": [
        {
          "key": "xanh",
          "side": "BLUE",
          "label": null,
          "x": 21.1,
          "y": 59.7
        },
        {
          "key": "do",
          "side": "RED",
          "label": null,
          "x": 78.9,
          "y": 40.3
        }
      ]
    },
    {
      "code": "than-lan-da-quang",
      "name": "Thằn lằn dạ quang",
      "category": "MONSTER",
      "glyph": "MONSTER",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": null,
      "tags": [
        "Quái rừng"
      ],
      "summary": null,
      "firstSpawn": {
        "seconds": 30,
        "note": "Giây thứ 30"
      },
      "respawn": {
        "seconds": 70,
        "note": "70 giây"
      },
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Quái rừng đánh xa"
        },
        {
          "title": "Các lợi ích khác",
          "body": "Hạ xong được hồi lượng máu nhất định\nHạ giúp tướng nhận được vàng và kinh nghiệm."
        }
      ],
      "change": null,
      "positions": [
        {
          "key": "xanh",
          "side": "BLUE",
          "label": null,
          "x": 47.0,
          "y": 67.7
        },
        {
          "key": "do",
          "side": "RED",
          "label": null,
          "x": 53.0,
          "y": 32.3
        }
      ]
    },
    {
      "code": "cua-ky-cuc",
      "name": "Cua kỳ cục",
      "category": "MONSTER",
      "glyph": "MONSTER",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": null,
      "tags": [
        "Quái rừng"
      ],
      "summary": null,
      "firstSpawn": {
        "seconds": 30,
        "note": "Giây thứ 30"
      },
      "respawn": {
        "seconds": 70,
        "note": "70 giây"
      },
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Quái rừng đánh xa"
        },
        {
          "title": "Các lợi ích khác",
          "body": "Hạ xong được hồi lượng máu nhất định\nHạ giúp tướng nhận được vàng và kinh nghiệm."
        }
      ],
      "change": null,
      "positions": [
        {
          "key": "xanh",
          "side": "BLUE",
          "label": null,
          "x": 36.8,
          "y": 80.2
        },
        {
          "key": "do",
          "side": "RED",
          "label": null,
          "x": 63.2,
          "y": 19.8
        }
      ]
    },
    {
      "code": "linh-quy",
      "name": "Linh quy",
      "category": "MONSTER",
      "glyph": "MONSTER",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": null,
      "tags": [
        "Quái rừng"
      ],
      "summary": null,
      "firstSpawn": {
        "seconds": 30,
        "note": "Giây thứ 30"
      },
      "respawn": {
        "seconds": 70,
        "note": "70 giây"
      },
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Quái rừng cận chiến"
        },
        {
          "title": "Các lợi ích khác",
          "body": "Hạ xong được hồi lượng máu nhất định\nHạ giúp tướng nhận được vàng và kinh nghiệm."
        }
      ],
      "change": null,
      "positions": [
        {
          "key": "xanh",
          "side": "BLUE",
          "label": null,
          "x": 66.8,
          "y": 86.8
        },
        {
          "key": "do",
          "side": "RED",
          "label": null,
          "x": 33.2,
          "y": 13.2
        }
      ]
    },
    {
      "code": "bo-anh-sang",
      "name": "Bọ ánh sáng",
      "category": "MONSTER",
      "glyph": "MONSTER",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": null,
      "tags": [
        "Quái rừng",
        "Tầm nhìn"
      ],
      "summary": null,
      "firstSpawn": {
        "seconds": 30,
        "note": "Giây thứ 30"
      },
      "respawn": {
        "seconds": 60,
        "note": "Giây thứ 60"
      },
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Sau khi bị hạ, Bọ ánh sáng sẽ biến thành mắt tinh linh và bay thẳng đến khu rừng của kẻ địch, rọi sáng tầm nhìn dọc đường đồng thời xua tan Hoa Linh hồn cùng Tinh linh điểu.\nBọ ánh sáng sẽ làm mới ở gần sông đường Rồng và đường Caesar, sau phút thứ 4 sẽ không làm mới nữa"
        }
      ],
      "change": null,
      "positions": [
        {
          "key": "caesar",
          "side": null,
          "label": "Phía Caesar",
          "x": 19.6,
          "y": 19.9
        },
        {
          "key": "rong",
          "side": null,
          "label": "Phía Rồng",
          "x": 80.4,
          "y": 80.1
        }
      ]
    },
    {
      "code": "rong-tieu-lam",
      "name": "Rồng tiểu lam",
      "category": "MONSTER",
      "glyph": "DRAGON",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": null,
      "tags": [
        "Quái rừng"
      ],
      "summary": null,
      "firstSpawn": {
        "seconds": 30,
        "note": "Giây thứ 30"
      },
      "respawn": {
        "seconds": null,
        "note": "Chỉ xuất hiện 1 lần"
      },
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Rồng tiểu lam sinh ra ở vùng đất bên ngoài đường Rồng, chỉ xuất hiện 1 lần trong cả trận.\nRồng tiểu lam không thể tấn công.\nSau khi hạ con rồng, phe hạ được sẽ nhận được 90 vàng, chia đều cho tất cả tướng trong phe."
        },
        {
          "title": "Các lợi ích khác",
          "body": "Hạ giúp tướng nhận được vàng và kinh nghiệm."
        }
      ],
      "change": null,
      "positions": [
        {
          "key": null,
          "side": null,
          "label": null,
          "x": 97.0,
          "y": 97.5
        }
      ]
    },
    {
      "code": "cong-dich-chuyen",
      "name": "Cổng dịch chuyển & Linh vũ thú",
      "category": "MONSTER",
      "glyph": "PORTAL",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": null,
      "tags": [
        "Quái rừng",
        "Dịch chuyển"
      ],
      "summary": null,
      "firstSpawn": {
        "seconds": 60,
        "note": "Giây thứ 60"
      },
      "respawn": {
        "seconds": 60,
        "note": "60 giây"
      },
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Linh vũ thú là quái rừng cận chiến, sau phút thứ 4 sẽ không làm mới nữa.\nSau khi hạ Linh vũ thú, phe hạ được sẽ nhận 50 vàng, chia đều cho tất cả tướng trong phe.\nCổng dịch chuyển sẽ kích hoạt sau khi hạ Linh vũ thú lần đầu và sẽ đóng vào phút thứ 8.\nTướng bước vào cổng dịch chuyển có thể dịch chuyển đến cạnh trụ hoặc lính của phe ta.\n- Thời gian dịch chuyển là 3 giây, quá trình dịch chuyển có thể bị gián đoạn và sau khi bị gián đoạn tướng không thể sử dụng kỹ năng dịch chuyển trong vòng 15 giây.\n- Sau khi dịch chuyển thành công, tướng không thể sử dụng lại kỹ năng dịch chuyển trong vòng 60 giây.\n- Cổng dịch chuyển chỉ có thể hỗ trợ một tướng dịch chuyển tức thời tại một thời điểm, khi một tướng đang sử dụng dịch chuyển tức thời thì các tướng khác không thể sử dụng kỹ năng dịch chuyển."
        },
        {
          "title": "Các lợi ích khác",
          "body": "Hạ giúp tướng nhận được vàng và kinh nghiệm."
        }
      ],
      "change": {
        "title": "Hồi chiêu Cổng dịch chuyển",
        "body": "90 giây -> 60 giây"
      },
      "positions": [
        {
          "key": null,
          "side": null,
          "label": null,
          "x": 2.5,
          "y": 2.5
        }
      ]
    },
    {
      "code": "khong-lo-thuat-si",
      "name": "Khổng lồ Thuật sĩ",
      "category": "EPIC",
      "glyph": "GIANT",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": null,
      "tags": [
        "Quái to",
        "Hồi máu"
      ],
      "summary": "Bùa xanh",
      "firstSpawn": {
        "seconds": 30,
        "note": "Giây thứ 30"
      },
      "respawn": {
        "seconds": 90,
        "note": "90 giây"
      },
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Sức mạnh phù hợp cho tướng đi rừng nâng cao hiệu suất farm. Sau 10 phút, khổng lồ thuật sĩ sẽ tiến hóa thành khổng lồ thuật sĩ cường hóa. Sau khi bị hạ, linh hồn của bùa cường hóa sẽ theo sát tướng đã hạ gục và truyền sang cho tướng đồng đội lân cận gần nhất đồng thời buff thêm cho đồng đội đó Bùa xanh (hiệu ứng chia sẻ sẽ không được tướng đồng đội đó kế thừa)."
        },
        {
          "title": "Lợi ích hạ",
          "body": "Sau khi tung đòn dứt điểm khổng lồ thuật sĩ, tướng sẽ nhận được Bùa xanh trong 70 giây\n- Giảm hồi chiêu 20%.\n- Mỗi giây hồi 3% năng lượng.\n- Chuyển giao bùa: Hạ tướng địch có bùa sẽ nhận được bùa của địch và thời gian hiệu lực của bùa được tính lại từ đầu"
        },
        {
          "title": "Các lợi ích khác",
          "body": "Hạ xong được hồi lượng máu nhất định\nHạ giúp tướng nhận được vàng và kinh nghiệm."
        }
      ],
      "change": null,
      "positions": [
        {
          "key": "xanh",
          "side": "BLUE",
          "label": null,
          "x": 27.4,
          "y": 47.5
        },
        {
          "key": "do",
          "side": "RED",
          "label": null,
          "x": 72.6,
          "y": 52.5
        }
      ]
    },
    {
      "code": "khong-lo-luc-si",
      "name": "Khổng lồ Lực sĩ",
      "category": "EPIC",
      "glyph": "GIANT",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": null,
      "tags": [
        "Quái to",
        "Sát thương"
      ],
      "summary": "Bùa đỏ",
      "firstSpawn": {
        "seconds": 30,
        "note": "Giây thứ 30"
      },
      "respawn": {
        "seconds": 90,
        "note": "90 giây"
      },
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Sức mạnh phù hợp cho tướng đi rừng bắt lẻ, có thể làm chậm tốc chạy địch và gây sát thương chuẩn. Sau 10 phút, khổng lồ lực sĩ sẽ tiến hóa thành khổng lồ lực sĩ cường hóa. Sau khi bị hạ, linh hồn của bùa cường hóa sẽ theo sát tướng đã hạ gục và truyền sang cho tướng đồng đội lân cận gần nhất đồng thời buff thêm cho đồng đội đó Bùa đỏ (hiệu ứng chia sẻ sẽ không được tướng đồng đội đó kế thừa)."
        },
        {
          "title": "Lợi ích hạ",
          "body": "Sau khi tung đòn dứt điểm khổng lồ lực sĩ, tướng sẽ nhận được Bùa đỏ trong 70 giây\n- Các đòn đánh thường của tướng đốt cháy đơn vị quái rừng gây 40-96 St chuẩn (sát thương tăng theo cấp tướng, giảm nửa sát thương cho đơn vị không phải quái), kéo dài 2 giây.\n- Đánh thường kèm hiệu ứng làm chậm 15% tốc chạy tướng địch, kéo dài 2 giây.\n- Chuyển giao bùa: Hạ tướng địch có bùa sẽ nhận được bùa của địch và thời gian hiệu lực của bùa được tính lại từ đầu"
        },
        {
          "title": "Các lợi ích khác",
          "body": "Hạ xong được hồi lượng máu nhất định\nHạ giúp tướng nhận được vàng và kinh nghiệm."
        }
      ],
      "change": null,
      "positions": [
        {
          "key": "xanh",
          "side": "BLUE",
          "label": null,
          "x": 53.6,
          "y": 79.0
        },
        {
          "key": "do",
          "side": "RED",
          "label": null,
          "x": 46.4,
          "y": 21.0
        }
      ]
    },
    {
      "code": "rong",
      "name": "Rồng",
      "category": "EPIC",
      "glyph": "DRAGON",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": null,
      "tags": [
        "Quái to",
        "Sát thương"
      ],
      "summary": "Bùa Rồng Quang lôi",
      "firstSpawn": {
        "seconds": 120,
        "note": "Phút thứ 2"
      },
      "respawn": {
        "seconds": 180,
        "note": "3 phút"
      },
      "sections": [
        {
          "title": "Lợi ích hạ",
          "body": "Tướng kết liễu Rồng sẽ giúp phe mình nhận được bùa Rồng Quang lôi trong 90 giây.\n- Đánh thường hoặc tung chiêu sẽ tạo ra lưới sét gây 30 (+30* mỗi cấp tướng) sát thương phép lên lính và quái, gây 15 (+15* mỗi cấp tướng) sát thương phép lên tướng địch, hồi chiêu 3 giây.\n- Lưới sét tối đa đánh lên 3 mục tiêu, tối đa phủ trong bán kính 4m, vô hiệu với trụ\n- Hạ Rồng sẽ chịu bùa hại Khế ước quang ám I trong 90 giây.\n- Sát thương lên Caesar và Rồng sẽ bị giảm 50%.\n- Tướng mang theo bùa hại tương tác trên sẽ bị Caesar và Rồng khóa mục tiêu kèm tung Ma lực cuồng nộ gây sát thương cực lớn."
        },
        {
          "title": "Các lợi ích khác",
          "body": "Hạ giúp tướng nhận được vàng và kinh nghiệm."
        }
      ],
      "change": {
        "title": "Khế ước Quang ám I",
        "body": "Thêm hiệu ứng mới: Tướng mang theo liên kết sẽ hấp dẫn Caesar và Rồng tung ra ma lực cuồng nộ, gây sát thương khổng lồ"
      },
      "positions": [
        {
          "key": null,
          "side": null,
          "label": null,
          "x": 67.1,
          "y": 71.9
        }
      ]
    },
    {
      "code": "rong-anh-sang",
      "name": "Rồng ánh sáng",
      "category": "EPIC",
      "glyph": "DRAGON",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": "rong",
      "tags": [
        "Quái to",
        "Sát thương"
      ],
      "summary": "Bùa Rồng Thánh lôi",
      "firstSpawn": {
        "seconds": 480,
        "note": "Phút thứ 8"
      },
      "respawn": {
        "seconds": 180,
        "note": "3 phút"
      },
      "sections": [
        {
          "title": "Lợi ích hạ",
          "body": "Tướng kết liễu Rồng ánh sáng sẽ giúp phe mình nhận được bùa Rồng Thánh lôi trong 90 giây.\n- Đánh thường hoặc tung chiêu sẽ tạo ra lưới sét gây 60 (+40* mỗi cấp tướng) sát thương phép lên lính và quái, gây 30 (+20* mỗi cấp tướng) sát thương phép lên tướng địch, hồi chiêu 3 giây.\n- Lưới sét tối đa đánh lên 3 mục tiêu, tối đa phủ trong bán kính 4m, vô hiệu với trụ\n- Nhận thêm tăng tốc chạy 5%\n- Hạ Rồng sẽ chịu bùa hại Khế ước quang ám II trong 90 giây.\n- Sát thương lên Caesar hắc ám, bạo chúa và Rồng ánh sáng sẽ bị giảm 50%.\n- Tướng mang theo bùa hại tương tác trên sẽ bị Caesar và Rồng khóa mục tiêu và tung Ma lực cuồng nộ, gây sát thương cực lớn."
        },
        {
          "title": "Các lợi ích khác",
          "body": "Hạ giúp tướng nhận được vàng và kinh nghiệm."
        }
      ],
      "change": {
        "title": "Khế ước Quang ám",
        "body": "Thêm hiệu ứng mới: Tướng mang theo liên kết sẽ hấp dẫn Caesar và Rồng tung ra ma lực cuồng nộ, gây sát thương khổng lồ"
      },
      "positions": []
    },
    {
      "code": "caesar",
      "name": "Caesar",
      "category": "EPIC",
      "glyph": "CAESAR",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": null,
      "tags": [
        "Quái to",
        "Đẩy đường"
      ],
      "summary": "Gọi Caesar tiên phong",
      "firstSpawn": {
        "seconds": 120,
        "note": "Phút thứ 2"
      },
      "respawn": {
        "seconds": 180,
        "note": "3 phút"
      },
      "sections": [
        {
          "title": "Lợi ích hạ",
          "body": "Tướng kết liễu Caesar sẽ giúp phe mình gọi ra 2 đợt Caesar tiên phong thay cho lính tấn công trên cả 3 đường.\n- Caesar tiên phong có năng lực đẩy đường rất mạnh. Hạ Caesar sẽ chịu bùa hại Khế ước quang ám I trong 90 giây.\n- Sát thương lên Caesar và Rồng sẽ bị giảm 50%.\n- Tướng mang theo bùa hại tương tác trên sẽ bị Caesar và Rồng khóa mục tiêu kèm tung Ma lực cuồng nộ gây sát thương cực lớn."
        },
        {
          "title": "Các lợi ích khác",
          "body": "Hạ giúp toàn đội nhận được vàng và kinh nghiệm"
        }
      ],
      "change": {
        "title": "Khế ước Quang ám I",
        "body": "Thêm hiệu ứng mới: Tướng mang theo liên kết sẽ hấp dẫn Caesar và Rồng tung ra ma lực cuồng nộ, gây sát thương khổng lồ"
      },
      "positions": [
        {
          "key": null,
          "side": null,
          "label": null,
          "x": 32.9,
          "y": 28.1
        }
      ]
    },
    {
      "code": "caesar-hac-am",
      "name": "Caesar hắc ám",
      "category": "EPIC",
      "glyph": "CAESAR",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": "caesar",
      "tags": [
        "Quái to",
        "Đẩy đường"
      ],
      "summary": "Gọi Caesar hắc ám đẩy đường",
      "firstSpawn": {
        "seconds": 480,
        "note": "Phút thứ 8"
      },
      "respawn": {
        "seconds": 180,
        "note": "3 phút"
      },
      "sections": [
        {
          "title": "Lợi ích hạ",
          "body": "Tướng kết liễu Caesar sẽ giúp phe mình gọi ra 1 đợt Caesar tiên phong thay cho lính tấn công trên cả 3 đường.\n- Caesar tiên phong có năng lực đẩy đường rất mạnh.\n- Tướng kết liễu được sở hữu kỹ năng chủ động gọi ra Caesar hắc ám đẩy đường\n- Hạ Caesar hắc ám sẽ chịu bùa hại Khế ước quang ám II trong 90 giây.\n- Sát thương lên Caesar hắc ám, bạo chúa và Rồng ánh sáng sẽ bị giảm 50%.\n- Tướng mang theo bùa hại tương tác trên sẽ bị Caesar và Rồng khóa mục tiêu và tung Ma lực cuồng nộ, gây sát thương cực lớn."
        },
        {
          "title": "Gọi Caesar hắc ám",
          "body": "- Tướng hạ Caesar hắc ám có thể ở vị trí bất kỳ trên bản đồ ấn triệu hồi boss, kích hoạt chủ động này được lưu trong 60 giây và sẽ tự động kích hoạt nếu hết thời gian hoặc tướng hạ Caesar bị tiêu diệt.\n- Sau khi kích hoạt, Caesar hắc ám sẽ xuất phát từ tế đàn phe gọi ra và đồng thời sẽ có 1 sóng năng lượng bắn ra chạy dọc theo đường đi của Caesar hắc ám đến tận nhà chính phe địch. Đại lộ Caesar đi đến đâu sẽ diệt lính phe địch đến đấy. (Giá trị vàng hạ lính sẽ bằng 150% của tổng vàng hạ được và chia đều cho các tướng đồng minh)\n- Tướng đồng minh di chuyển trên Đại lộ Caesar sẽ được miễn thương 10% và tăng 10% sát thương lên trụ địch tại đường đó. Con đường tồn tại 1 phút."
        },
        {
          "title": "Các lợi ích khác",
          "body": "Hạ giúp toàn đội nhận được vàng và kinh nghiệm"
        }
      ],
      "change": {
        "title": "Khế ước Quang ám",
        "body": "Thêm hiệu ứng mới: Tướng mang theo liên kết sẽ hấp dẫn Caesar và Rồng tung ra ma lực cuồng nộ, gây sát thương khổng lồ"
      },
      "positions": []
    },
    {
      "code": "caesar-bao-chua",
      "name": "Caesar bạo chúa",
      "category": "EPIC",
      "glyph": "BOSS",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": null,
      "tags": [
        "Quái boss",
        "Đẩy đường"
      ],
      "summary": "Buff Lôi lực Caesar",
      "firstSpawn": {
        "seconds": 900,
        "note": "Phút thứ 15"
      },
      "respawn": {
        "seconds": 180,
        "note": "3 phút · Ngẫu nhiên tại hang Caesar hoặc hang Rồng"
      },
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Caesar bạo chúa là quái boss mạnh nhất bản đồ. Khi tướng tấn công Caesar bạo chúa sẽ phải chịu hiệu ứng bất lợi, cần tập hợp đồng đội cùng phối hợp để hạ gục.\nDi chứng hắc ám: Khi tướng tấn công Caesar bạo chúa sẽ nhận hiệu ứng bất lợi. Mỗi cộng dồn giảm 12.5% hiệu quả hồi máu của mục tiêu, đồng thời giảm 10% giáp và giáp phép, tối đa cộng dồn 4 tầng, kéo dài 5 giây.\nDi chứng hắc ám II: Đòn đánh thường của Caesar bạo chúa sẽ gây hiệu ứng bất lợi lên mục tiêu chính, giảm 40% hiệu quả hồi máu của mục tiêu, kéo dài 5 giây."
        },
        {
          "title": "Phần thưởng khi hạ",
          "body": "Tướng tung đòn kết liễu Caesar bạo chúa sẽ khiến 3 đợt lính tiếp theo trên cả 3 đường của phe mình được thay thế bằng Caesar bạo chúa tiên phong.\nCaesar bạo chúa tiên phong có thể gây hiệu ứng choáng lên trụ, khiến trụ không thể tấn công trong 2.5 giây.\nToàn bộ tướng phe mình sẽ nhận được buff Lôi lực Caesar, kéo dài 90 giây.\nLôi lực Caesar sẽ tự động công kích lên đơn vị địch trong phạm vi xung quanh, mỗi lần gây sát thương chuẩn bằng 4% máu tối đa của đơn vị đó. Đối với đơn vị không phải tướng, sát thương này tăng lên 20%.\nLôi lực Caesar cung cấp cho tướng một lá chắn bằng 12% máu tối đa. Lá chắn này sẽ được làm mới mỗi khi rời giao tranh.\nTại phút thứ 20, Caesar bạo chúa sẽ thức tỉnh và cường hóa thành Caesar bạo chúa viễn cổ cùng trở lại chiến trường thông qua Vết Nứt Truy Nguyên đồng thời tuần tra trên sông. Sau khi hạ sẽ nhận được buff mạnh hơn (hiệu quả của Lôi lực Caesar tăng 50%)."
        },
        {
          "title": "Phần thưởng khác",
          "body": "Sau khi hạ, toàn đội nhận được một lượng kinh nghiệm và vàng."
        }
      ],
      "change": null,
      "positions": [
        {
          "key": "caesar",
          "side": null,
          "label": "Hang Caesar",
          "x": 32.9,
          "y": 28.1
        },
        {
          "key": "rong",
          "side": null,
          "label": "Hang Rồng",
          "x": 67.1,
          "y": 71.9
        }
      ]
    },
    {
      "code": "rong-bao-chua",
      "name": "Rồng bạo chúa",
      "category": "EPIC",
      "glyph": "BOSS",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": "caesar-bao-chua",
      "tags": [
        "Quái boss",
        "Đẩy đường"
      ],
      "summary": "Quyền năng hắc ám, buff theo vai trò",
      "firstSpawn": {
        "seconds": 900,
        "note": "Phút thứ 15"
      },
      "respawn": {
        "seconds": 180,
        "note": "3 phút · Ngẫu nhiên tại hang Caesar hoặc hang Rồng"
      },
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Rồng bạo chúa là rồng viễn cổ ẩn nấp trong khe nứt thời không. Khi tướng tấn công Rồng bạo chúa sẽ phải chịu hiệu ứng bất lợi, cần tập hợp đồng đội cùng phối hợp để hạ gục.\nDi chứng hắc ám I: Khi tướng tấn công Rồng bạo chúa sẽ nhận hiệu ứng bất lợi. Mỗi cộng dồn giảm 12.5% hiệu quả hồi máu của mục tiêu, đồng thời giảm 10% giáp và giáp phép, tối đa cộng dồn 4 lần, kéo dài 5 giây.\nDi chứng hắc ám II: Đòn đánh thường của Rồng bạo chúa sẽ gây hiệu ứng bất lợi lên mục tiêu chính, giảm 40% hiệu quả hồi máu của mục tiêu, kéo dài 5 giây."
        },
        {
          "title": "Phần thưởng khi hạ",
          "body": "Tướng tung đòn kết liễu Rồng bạo chúa sẽ khiến 3 đợt lính tiếp theo trên cả 3 đường của phe mình được thay thế bằng Caesar bạo chúa tiên phong.\nCaesar bạo chúa tiên phong có thể gây hiệu ứng choáng lên trụ, khiến trụ không thể tấn công trong 2.5 giây.\nSau khi hạ Rồng bạo chúa, bùa tương tác Quyền năng hắc ám sẽ xuất hiện tại vị trí nó bị hạ. Mọi thành viên phe hạ gục đều có thể nhặt và lập tức nhận hiệu ứng: Khi chịu sát thương chí tử sẽ được miễn tử lần này và xóa toàn bộ hiệu ứng bất lợi kèm nhận 1 giây miễn sát thương cùng tăng 20% tốc chạy đồng thời hồi 50% máu tối đa.\nTướng phe mình sẽ nhận được buff phe tương ứng theo vai trò, kéo dài 90 giây.\nTại phút thứ 20, Rồng bạo chúa sẽ thức tỉnh và cường hóa thành Rồng bạo chúa viễn cổ cùng trở lại chiến trường thông qua Vết Nứt Truy Nguyên đồng thời tuần tra trên sông. Sau khi hạ sẽ nhận được buff mạnh hơn, hiệu quả của buff phe và Quyền năng hắc ám tăng 50%."
        },
        {
          "title": "Buff phe theo vai trò",
          "body": "Đỡ đòn: Mỗi giây hồi 1% máu tối đa, giáp và giáp phép +150.\nĐấu sĩ: +50 công vật lý, +10% công vật lý cộng thêm.\nSát thủ: +100 xuyên giáp, +75 xuyên giáp phép, +20 tốc chạy.\nPháp sư: +75 công phép, +15% công phép cộng thêm.\nXạ thủ: +10% tỷ lệ chí mạng, +15% tỷ lệ xuyên giáp.\nTrợ thủ: Mỗi 5 giây hồi 300 máu và 100 năng lượng cho tướng đồng minh xung quanh."
        },
        {
          "title": "Phần thưởng khác",
          "body": "Sau khi hạ, toàn đội nhận được một lượng kinh nghiệm và vàng."
        }
      ],
      "change": null,
      "positions": []
    },
    {
      "code": "king-kong",
      "name": "King Kong",
      "category": "EPIC",
      "glyph": "KONG",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": "caesar-bao-chua",
      "tags": [
        "Quái boss",
        "Đẩy đường"
      ],
      "summary": "Triệu hồi King Kong",
      "firstSpawn": {
        "seconds": 900,
        "note": "Phút thứ 15"
      },
      "respawn": {
        "seconds": 180,
        "note": "3 phút · Ngẫu nhiên tại hang Caesar hoặc hang Rồng"
      },
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "King Kong là hồng hoang cự thú đang ngủ say sâu thẳm trong chiến trường, có thể gây hiệu ứng bùa hại, cần tập hợp đồng đội để tiêu diệt hắn.\n- Di chứng hắc ám: Tướng công kích King Kong sẽ dính hiệu ứng bùa hại, mỗi cộng dồn sẽ khiến giảm 12.5% hiệu quả hồi máu và giảm 10% song giáp, tối đa cộng dồn 4 lần, kéo dài 5 giây.\n- Di chứng hắc ám II: King Kong đánh thường khiến mục tiêu chính chịu bùa hại và giảm 40% hiệu quả hồi máu, kéo dài 5 giây."
        },
        {
          "title": "Lợi ích hạ",
          "body": "- Tướng kết liễu King Kong giúp phe mình gọi ra 3 đợt Caesar bạo chúa tiên phong thay cho lính tấn công trên cả 3 đường.\n- Caesar bạo chúa tiên phong có thể khiến trụ bị choáng và không thể công kích trong 2.5 giây.\n- Ngoài ra hạ Caesar bạo chúa còn giúp các tướng đồng minh nhận được bùa lôi lực Caesar trong 90 giây.\n- Tướng hạ King Kong sẽ nhận được chiêu Triệu hồi King Kong giúp phe mình chiến đấu."
        },
        {
          "title": "Chiêu Triệu hồi King Kong",
          "body": "Gọi ra King Kong nhảy đến vị trí chỉ định gây 2000 sát thương vật lý và hất tung kẻ địch trong phạm vi kèm tung chiêu 3 lần.\nĐợt 1: Đập mạnh xuống đất, gây 2000 sát thương vật lý lên các đơn vị địch xung quanh và làm choáng trong 0.5 giây.\nĐợt 2: Gầm thét tạo chấn động trong 2 giây, mỗi 0.3 giây gây 500 sát thương vật lý lên kẻ địch xung quanh và giảm 15% tốc chạy của chúng trong 0.5 giây.\nĐợt 3: Dồn lực nện mạnh xuống đất. Sau 0.9 giây tụ lực, hất tung đơn vị địch và gây 2000 sát thương vật lý lớn.\nTại phút thứ 20, King Kong sẽ thức tỉnh và cường hóa thành King Kong bạo chúa, trở lại chiến trường thông qua Vết Nứt Truy Nguyên và tuần tra trên sông. Sau khi hạ sẽ nhận được bùa mạnh hơn (hiệu quả của chiêu biến thân và Xung Kích Địa Mạch tăng 50%)."
        },
        {
          "title": "Phần thưởng khác",
          "body": "Sau khi hạ, toàn đội nhận được một lượng kinh nghiệm và vàng."
        }
      ],
      "change": null,
      "positions": []
    },
    {
      "code": "mat-tinh-linh",
      "name": "Mắt tinh linh",
      "category": "MECHANIC",
      "glyph": "EYE",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": null,
      "tags": [
        "Cơ chế",
        "Tầm nhìn"
      ],
      "summary": null,
      "firstSpawn": {
        "seconds": null,
        "note": "Khi trụ ngoài đường giữa phe ta bị phá hủy, mắt tinh linh sẽ bay về phía khu vực giáp tướng ngoài gần trụ trong của cả 2 đường bên và tụ thành 2 đốm sáng. Kích hoạt đốm sáng mỗi bên sẽ giúp mắt tinh linh bay vào rừng soi sáng lấy tầm nhìn."
      },
      "respawn": {
        "seconds": 120,
        "note": "Mỗi 120 giây"
      },
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Kéo dài soi sáng: 40 giây.\nMắt tinh linh có hiệu quả soi sáng liên tục trong rừng.\nNếu tướng phe ta chạm vào mắt tinh linh trong rừng tiếp. Mắt sẽ hóa thành vùng soi sáng bay tiếp đến khu vực hang rồng để thám thính địa hình trong thoáng chốc và bay mất khỏi bản đồ"
        }
      ],
      "change": null,
      "positions": [
        {
          "key": "xanh-caesar",
          "side": "BLUE",
          "label": "Đường Caesar",
          "x": 9.0,
          "y": 70.0
        },
        {
          "key": "xanh-rong",
          "side": "BLUE",
          "label": "Đường Rồng",
          "x": 30.0,
          "y": 91.0
        },
        {
          "key": "do-rong",
          "side": "RED",
          "label": "Đường Rồng",
          "x": 91.0,
          "y": 30.0
        },
        {
          "key": "do-caesar",
          "side": "RED",
          "label": "Đường Caesar",
          "x": 70.0,
          "y": 9.0
        }
      ]
    },
    {
      "code": "goi-mau",
      "name": "Gói máu",
      "category": "MECHANIC",
      "glyph": "HEAL",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": null,
      "tags": [
        "Vật phẩm",
        "Hồi máu"
      ],
      "summary": null,
      "firstSpawn": {
        "seconds": 60,
        "note": "Giây thứ 60"
      },
      "respawn": {
        "seconds": 60,
        "note": "60 giây"
      },
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Hạt hồi phục (gói máu) sau trụ ngoài, ăn sẽ giúp hồi lại 250 máu và 35 năng lượng, kéo dài 5 giây (Hạt hồi phục sau trụ ngoài đường giữa sau khi ăn lập tức hồi 200 năng lượng)\nĂn xong sẽ đếm ngược thời gian để làm mới"
        }
      ],
      "change": null,
      "positions": [
        {
          "key": "xanh-caesar",
          "side": "BLUE",
          "label": "Đường Caesar",
          "x": 2.2,
          "y": 38.7
        },
        {
          "key": "xanh-giua",
          "side": "BLUE",
          "label": "Đường giữa",
          "x": 36.5,
          "y": 65.6
        },
        {
          "key": "xanh-rong",
          "side": "BLUE",
          "label": "Đường Rồng",
          "x": 68.8,
          "y": 96.6
        },
        {
          "key": "do-rong",
          "side": "RED",
          "label": "Đường Rồng",
          "x": 97.8,
          "y": 61.3
        },
        {
          "key": "do-giua",
          "side": "RED",
          "label": "Đường giữa",
          "x": 63.5,
          "y": 34.4
        },
        {
          "key": "do-caesar",
          "side": "RED",
          "label": "Đường Caesar",
          "x": 31.2,
          "y": 3.4
        }
      ]
    },
    {
      "code": "bui-co",
      "name": "Bụi cỏ",
      "category": "MECHANIC",
      "glyph": "BUSH",
      "iconAssetId": null,
      "pictureAssetId": null,
      "family": null,
      "tags": [
        "Cây cối",
        "Tầm nhìn"
      ],
      "summary": null,
      "firstSpawn": null,
      "respawn": null,
      "sections": [
        {
          "title": "Giới thiệu",
          "body": "Bụi cỏ là nơi tướng có thể ẩn mình mai phục khiến tướng địch bên ngoài không nhìn thấy\nDù đứng trong bụi cỏ nhưng khi tấn công kẻ địch bên ngoài thì sẽ bị lộ diện"
        }
      ],
      "change": null,
      "positions": [
        {
          "key": "caesar",
          "side": null,
          "label": "Phía Caesar",
          "x": 42.0,
          "y": 47.0
        },
        {
          "key": "rong",
          "side": null,
          "label": "Phía Rồng",
          "x": 58.0,
          "y": 53.0
        }
      ]
    }
  ],
  "areas": [
    {
      "code": "nha-xanh",
      "name": "Nhà xanh",
      "side": "BLUE",
      "summary": null,
      "outline": [
        {
          "x": 0,
          "y": 68
        },
        {
          "x": 12,
          "y": 70
        },
        {
          "x": 22,
          "y": 80
        },
        {
          "x": 30,
          "y": 88
        },
        {
          "x": 32,
          "y": 100
        },
        {
          "x": 0,
          "y": 100
        }
      ]
    },
    {
      "code": "nha-do",
      "name": "Nhà đỏ",
      "side": "RED",
      "summary": null,
      "outline": [
        {
          "x": 100,
          "y": 32
        },
        {
          "x": 88,
          "y": 30
        },
        {
          "x": 78,
          "y": 20
        },
        {
          "x": 70,
          "y": 12
        },
        {
          "x": 68,
          "y": 0
        },
        {
          "x": 100,
          "y": 0
        }
      ]
    },
    {
      "code": "rung-xanh-caesar",
      "name": "Rừng xanh phía Caesar",
      "side": "BLUE",
      "summary": null,
      "outline": [
        {
          "x": 7,
          "y": 15
        },
        {
          "x": 43,
          "y": 51
        },
        {
          "x": 27,
          "y": 67
        },
        {
          "x": 7,
          "y": 67
        }
      ]
    },
    {
      "code": "rung-xanh-rong",
      "name": "Rừng xanh phía Rồng",
      "side": "BLUE",
      "summary": null,
      "outline": [
        {
          "x": 33,
          "y": 73
        },
        {
          "x": 49,
          "y": 57
        },
        {
          "x": 85,
          "y": 93
        },
        {
          "x": 33,
          "y": 93
        }
      ]
    },
    {
      "code": "rung-do-caesar",
      "name": "Rừng đỏ phía Caesar",
      "side": "RED",
      "summary": null,
      "outline": [
        {
          "x": 67,
          "y": 27
        },
        {
          "x": 51,
          "y": 43
        },
        {
          "x": 15,
          "y": 7
        },
        {
          "x": 67,
          "y": 7
        }
      ]
    },
    {
      "code": "rung-do-rong",
      "name": "Rừng đỏ phía Rồng",
      "side": "RED",
      "summary": null,
      "outline": [
        {
          "x": 93,
          "y": 85
        },
        {
          "x": 57,
          "y": 49
        },
        {
          "x": 73,
          "y": 33
        },
        {
          "x": 93,
          "y": 33
        }
      ]
    },
    {
      "code": "song",
      "name": "Sông",
      "side": null,
      "summary": null,
      "outline": [
        {
          "x": 4,
          "y": 12
        },
        {
          "x": 12,
          "y": 4
        },
        {
          "x": 96,
          "y": 88
        },
        {
          "x": 88,
          "y": 96
        }
      ]
    },
    {
      "code": "hang-caesar",
      "name": "Hang Caesar",
      "side": null,
      "summary": null,
      "outline": [
        {
          "x": 39.9,
          "y": 28.1
        },
        {
          "x": 36.4,
          "y": 34.2
        },
        {
          "x": 29.4,
          "y": 34.2
        },
        {
          "x": 25.9,
          "y": 28.1
        },
        {
          "x": 29.4,
          "y": 22.0
        },
        {
          "x": 36.4,
          "y": 22.0
        }
      ]
    },
    {
      "code": "hang-rong",
      "name": "Hang Rồng",
      "side": null,
      "summary": null,
      "outline": [
        {
          "x": 74.1,
          "y": 71.9
        },
        {
          "x": 70.6,
          "y": 78.0
        },
        {
          "x": 63.6,
          "y": 78.0
        },
        {
          "x": 60.1,
          "y": 71.9
        },
        {
          "x": 63.6,
          "y": 65.8
        },
        {
          "x": 70.6,
          "y": 65.8
        }
      ]
    }
  ],
  "lanes": [
    {
      "code": "duong-caesar",
      "name": "Đường Caesar",
      "glyph": "LANE",
      "heroCodes": [],
      "body": "Đại đa số, các đấu sĩ hoặc đỡ đòn sẽ đi đường này và địa hình của tuyến đường sẽ nguy hiểm hơn và cần được farm một cách thận trọng.\nTrong giai đoạn đầu, hạ Linh vũ thú đường tà thần sẽ giúp nhận nhiều kinh nghiệm hơn đồng thời tạo cơ hội phối hợp với tướng đi rừng hoặc tướng mid để mai phục kẻ địch",
      "positions": [
        {
          "x": 3.0,
          "y": 44.0
        }
      ],
      "path": [
        {
          "x": 4.0,
          "y": 88.0
        },
        {
          "x": 3.0,
          "y": 3.0
        },
        {
          "x": 88.0,
          "y": 3.0
        }
      ]
    },
    {
      "code": "di-rung",
      "name": "Đi rừng",
      "glyph": "JUNGLE",
      "heroCodes": [],
      "body": "Đại đa số, sát thủ hoặc đấu sĩ sẽ đi đường này. Họ có khả năng hỗ trợ mạnh mẽ\nTrong giai đoạn đầu, tiền và kinh nghiệm chủ yếu nhận được thông qua việc hạ quái, và đây cũng là vị trí lên cấp nhanh nhất trong giai đoạn đầu\nSau khi đạt cấp 4 và được mở khóa chiêu 3, bạn có thể phối hợp với đồng đội của mình để phục kích kẻ thù",
      "positions": [
        {
          "x": 24.0,
          "y": 52.0
        }
      ],
      "path": []
    },
    {
      "code": "duong-giua",
      "name": "Đường giữa",
      "glyph": "MID",
      "heroCodes": [],
      "body": "Đại đa số, pháp sư sẽ đi đường này. Lính đường giữa có cự ly ngắn nhất và giáp cao nhưng pháp sư lại gây ST phép.\nPháp sư đường giữa có thể dọn lính nhanh và tiến hành hỗ trợ cho các đường khác",
      "positions": [
        {
          "x": 35.0,
          "y": 64.0
        }
      ],
      "path": [
        {
          "x": 12.0,
          "y": 88.0
        },
        {
          "x": 88.0,
          "y": 12.0
        }
      ]
    },
    {
      "code": "tro-thu",
      "name": "Trợ thủ",
      "glyph": "SUPPORT",
      "heroCodes": [],
      "body": "Đại đa số, trợ thủ hoặc đỡ đòn sẽ đi đường này và có ít nhu cầu về vàng hơn đồng thời có khả năng bảo vệ đồng đội mạnh mẽ hơn.\nSau khi mua trang bị trợ thủ, đồng đội khác sẽ không bị ảnh hưởng đến lượng vàng nhận được khi farm lính và quái.\nTrong giai đoạn đầu, đi cùng rừng hoặc xạ thủ sẽ giúp tăng hiệu suất tấn công hoặc bảo hộ.",
      "positions": [
        {
          "x": 50.0,
          "y": 86.0
        }
      ],
      "path": []
    },
    {
      "code": "duong-rong",
      "name": "Đường Rồng",
      "glyph": "LANE",
      "heroCodes": [],
      "body": "Đại đa số, xạ thủ sẽ đi đường này, địa hình đường Rồng an toàn hơn và phù hợp để farm.\nTrong giai đoạn đầu khi hạ lính đánh xa đường Rồng, tướng sẽ được nhận thêm vàng.\nKhi đã có 2 đến 3 trang bị cấp 3, xạ thủ có thể di chuyển để hỗ trợ các đường khác hoặc tham gia giao tranh tổng",
      "positions": [
        {
          "x": 60.0,
          "y": 97.0
        }
      ],
      "path": [
        {
          "x": 12.0,
          "y": 96.5
        },
        {
          "x": 97.0,
          "y": 97.0
        },
        {
          "x": 96.5,
          "y": 12.0
        }
      ]
    }
  ],
  "tempo": [
    {
      "seconds": 0,
      "phase": "Đầu trận",
      "callouts": [
        {
          "label": "Bạn sẽ xuất hiện ở đây",
          "objectCode": "te-dan",
          "spotKey": "xanh",
          "x": 3.5,
          "y": 96.5
        },
        {
          "label": "Kích hoạt phòng thủ trụ",
          "objectCode": "tru-ngoai",
          "spotKey": "do-giua",
          "x": 60.9,
          "y": 41.7
        },
        {
          "label": "Phá hủy nhà chính địch",
          "objectCode": "nha-chinh",
          "spotKey": "do",
          "x": 91.5,
          "y": 8.6
        }
      ],
      "steps": [
        "Tế đàn: Nơi tướng xuất hiện và hồi sinh",
        "Điều kiện chiến thắng: Phá hủy nhà chính địch\nPhá hủy trụ trong trên đường bất kỳ phe địch là có thể tấn công nhà chính",
        "Trước 4 phút trụ ngoài sẽ được tăng 60% miễn thương"
      ]
    },
    {
      "seconds": 120,
      "phase": null,
      "callouts": [
        {
          "label": "Caesar xuất hiện",
          "objectCode": "caesar",
          "spotKey": null,
          "x": 32.9,
          "y": 28.1
        },
        {
          "label": "Rồng tiến hóa",
          "objectCode": "rong",
          "spotKey": null,
          "x": 67.1,
          "y": 71.9
        }
      ],
      "steps": [
        "Xuất hiện lần đầu: Phút thứ 2. Làm mới 3 phút\nTướng kết liễu Rồng sẽ giúp phe mình nhận được bùa Rồng Quang lôi",
        "Xuất hiện lần đầu: Phút thứ 2. Làm mới 3 phút\nTướng kết liễu Caesar sẽ giúp phe mình gọi ra 1 đợt Caesar tiên phong thay cho lính tấn công trên cả 3 đường"
      ]
    },
    {
      "seconds": 240,
      "phase": "Giữa trận",
      "callouts": [
        {
          "label": "Kết thúc bảo hộ rừng",
          "objectCode": null,
          "spotKey": null,
          "x": 20.5,
          "y": 27.6
        },
        {
          "label": "Xóa phòng thủ trụ",
          "objectCode": "tru-ngoai",
          "spotKey": "do-giua",
          "x": 60.9,
          "y": 41.7
        },
        {
          "label": "Nỏ công thành xuất kích",
          "objectCode": "no-cong-thanh",
          "spotKey": null,
          "x": 15.5,
          "y": 81.6
        }
      ],
      "steps": [
        "Phút thứ 4, xóa hiệu ứng phòng tuyến bảo hộ, hãy cùng đồng đội phá hủy trụ địch.",
        "Phút thứ 4, Nỏ công thành xuất chiến. Nỏ công thành có lực sát thương nhất định lên trụ",
        "Trước 4 phút mà tiến vào rừng của phe địch thì sẽ bị giảm 10% sát thương.\nHiệu ứng xóa sau 4 phút"
      ]
    },
    {
      "seconds": 480,
      "phase": "Cuối trận",
      "callouts": [
        {
          "label": "Caesar tiến hóa",
          "objectCode": "caesar-hac-am",
          "spotKey": null,
          "x": 32.9,
          "y": 28.1
        },
        {
          "label": "Pháo công thành xuất kích",
          "objectCode": "phao-cong-thanh",
          "spotKey": null,
          "x": 15.5,
          "y": 81.6
        },
        {
          "label": "Rồng tiến hóa",
          "objectCode": "rong-anh-sang",
          "spotKey": null,
          "x": 67.1,
          "y": 71.9
        }
      ],
      "steps": [
        "Xuất hiện lần đầu: Phút thứ 8. Làm mới 3 phút\nTướng kết liễu Rồng ánh sáng sẽ giúp phe mình nhận được bùa Rồng Thánh lôi",
        "Xuất hiện lần đầu: Phút thứ 8. Làm mới 3 phút\nTướng kết liễu Caesar hắc ám sẽ giúp phe mình gọi ra 2 đợt Caesar tiên phong thay cho lính tấn công trên cả 3 đường đồng thời sở hữu kỹ năng chủ động gọi ra Caesar hắc ám đẩy đường",
        "Phút thứ 8, Pháo công thành xuất chiến, sát thương của Pháo công thành lên trụ lớn hơn Nỏ công thành"
      ]
    },
    {
      "seconds": 900,
      "phase": "Quyết chiến",
      "callouts": [
        {
          "label": "Caesar bạo chúa xuất hiện",
          "objectCode": "caesar-bao-chua",
          "spotKey": "caesar",
          "x": 32.9,
          "y": 28.1
        }
      ],
      "steps": [
        "Xuất hiện lần đầu: Phút thứ 15, làm mới: 3 phút. Tướng kết liễu Caesar hắc ám sẽ giúp phe mình gọi ra 2 đợt Caesar tiên phong thay cho lính tấn công trên cả 3 đường.\n- Ngoài ra hạ Caesar bạo chúa còn giúp các tướng đồng minh nhận được bùa lôi lực Caesar."
      ]
    }
  ],
  "sources": [
    {
      "label": "Bách khoa chiến trường trong game (ảnh chụp và video của chủ trang)",
      "url": null,
      "observedOn": "2026-11-27"
    }
  ]
}$json$::jsonb,
    'Initial map from the battlefield encyclopedia', now(), now(), 'urn:wikiaov:migration', 'V081__seed_5v5_map_guide',
    now(), 'urn:wikiaov:migration', 'V081__seed_5v5_map_guide'
FROM gamemode.game_mode mode
WHERE mode.code = '5v5'
  AND NOT EXISTS (SELECT 1 FROM gamemode.map_guide_revision existing WHERE existing.mode_id = mode.id);
