# NeteaseCloudMusicApi Enhanced 接口文档

> 项目地址: https://github.com/neteasecloudmusicapienhanced/api-enhanced
> 文档站: https://neteasecloudmusicapienhanced.js.org/
> 默认端口: 3000

## 通用说明

- 所有接口支持 GET/POST
- POST 请求 url 必须加时间戳使每次不同，避免缓存
- 接口缓存 2 分钟
- 分页字段含 `more: true` 表示有下一页
- 传 `realIP=国内IP` 解决 460 错误
- 传 `randomCNIP=true` 自动随机中国 IP
- 传 `cookie=MUSIC_U=xxx` 携带登录态
- 传 `proxy=xxx` 指定代理
- 传 `noCookie=true` 不携带 cookies

---

## 搜索

### 搜索 (推荐使用 cloudsearch)
```
/search 或 /cloudsearch
```
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `keywords` | string | 是 | 关键词，多个以空格隔开 |
| `type` | number | 否 | 1:单曲 10:专辑 100:歌手 1000:歌单 1002:用户 1004:MV 1006:歌词 1009:电台 1014:视频 1018:综合 2000:声音 |
| `limit` | number | 否 | 返回数量，默认 30 |
| `offset` | number | 否 | 偏移量，默认 0 |

示例: `/cloudsearch?keywords=海阔天空&type=1&limit=10`

### 搜索建议
```
/search/suggest
```
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `keywords` | string | 是 | 关键词 |
| `type` | string | 否 | 传 `mobile` 返回移动端数据 |

### 热搜
```
/search/hot            # 简略
/search/hot/detail     # 详细
```

### 搜索多重匹配
```
/search/multimatch?keywords=海阔天空
```

---

## 歌曲

### 获取歌曲详情
```
/song/detail
```
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `ids` | string | 是 | 音乐 id，多个用逗号分隔 |

示例: `/song/detail?ids=347230` `/song/detail?ids=347230,347231`

### 获取音乐 URL (旧版)
```
/song/url
```
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 音乐 id，多个用逗号分隔 |
| `br` | number | 否 | 码率，默认 999000(最大)，320k 传 320000 |

示例: `/song/url?id=1969519579` `/song/url?id=1969519579,33894312`

### 获取音乐 URL (新版)
```
/song/url/v1
```
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 音乐 id，多个用逗号分隔 |
| `level` | string | 是 | standard(标准) / higher(较高) / exhigh(极高) / lossless(无损) / hires(Hi-Res) / jyeffect(高清环绕声) / sky(沉浸环绕声) / dolby(杜比全景声) / jymaster(超清母带) |
| `unblock` | bool | 否 | 是否使用歌曲解锁 |

示例: `/song/url/v1?id=1969519579&level=exhigh`

### 302 重定向到音乐 URL
```
/song/url/v1/302
```
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | number | 是 | 音乐 id（仅单个） |
| `level` | string | 是 | 同上 |

### 获取灰色歌曲链接
```
/song/url/match
```
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | number | 是 | 音乐 id |
| `source` | string | 否 | 解灰音源 |

### 检查音乐是否可用
```
/check/music
```
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | number | 是 | 歌曲 id |
| `br` | number | 否 | 码率 |

返回: `{ success: true, message: 'ok' }` 或 `{ success: false, message: '亲爱的,暂无版权' }`

---

## 歌词

### 获取歌词
```
/lyric
```
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | number | 是 | 音乐 id |

### 获取逐字歌词
```
/lyric/new
```
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | number | 是 | 音乐 id |

返回 `yrc` 字段即逐字歌词（部分歌曲可能没有）

---

## 歌单

### 获取歌单详情
```
/playlist/detail
```
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | number | 是 | 歌单 id |
| `s` | number | 否 | 最近收藏者数量，默认 8 |

> 未登录只能获取不完整歌单，登录后完整。trackIds 完整，tracks 不完整。

### 获取歌单所有歌曲
```
/playlist/track/all
```
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | number | 是 | 歌单 id |
| `limit` | number | 否 | 默认歌单歌曲总数 |
| `offset` | number | 否 | 偏移量，默认 0 |

示例: `/playlist/track/all?id=24381616&limit=10&offset=1`

### 网友精选碟
```
/top/playlist
```
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `cat` | string | 否 | 分类，如"华语"、"古风"、"欧美"、"流行"，默认"全部" |
| `order` | string | 否 | `hot`(最热) / `new`(最新)，默认 hot |
| `limit` | number | 否 | 默认 50 |
| `offset` | number | 否 | 偏移量 |

### 精品歌单
```
/top/playlist/highquality
```
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `cat` | string | 否 | 分类，默认"全部" |
| `limit` | number | 否 | 默认 50 |
| `before` | number | 否 | 分页参数，取上一页最后歌单的 `updateTime` |

### 用户歌单
```
/user/playlist
```
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `uid` | number | 是 | 用户 id |
| `limit` | number | 否 | 默认 30 |
| `offset` | number | 否 | 偏移量 |

### 歌单分类
```
/playlist/catlist     # 歌单分类
/playlist/hot          # 热门歌单分类
/playlist/highquality/tags  # 精品歌单标签
```

### 新建歌单
```
/playlist/create
```
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 歌单名 |
| `privacy` | string | 否 | 传 `10` 设为隐私歌单 |
| `type` | string | 否 | `NORMAL` / `VIDEO` / `SHARED` |

### 歌单增删歌曲
```
/playlist/tracks
```
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `op` | string | 是 | `add` 或 `del` |
| `pid` | number | 是 | 歌单 id |
| `tracks` | string | 是 | 歌曲 id，多个用逗号分隔 |

### 收藏/取消收藏歌单
```
/playlist/subscribe
```
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `t` | number | 是 | 1:收藏 2:取消收藏 |
| `id` | number | 是 | 歌单 id |

> 需带上 `timestamp` 参数，否则请求不合法

---

## 推荐

### 每日推荐歌曲 (需登录)
```
/recommend/songs
```
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `afresh` | bool | 否 | 是否刷新日推，默认 false |

### 每日推荐歌单 (需登录)
```
/recommend/resource
```

### 私人 FM (需登录)
```
/personal_fm
```

### 心动模式/智能播放 (需登录)
```
/playmode/intelligence/list
```
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | number | 是 | 歌曲 id |
| `pid` | number | 是 | 歌单 id |
| `sid` | number | 否 | 开始播放的歌曲 id |

### 新歌速递
```
/top/song
```
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | number | 是 | 0:全部 7:华语 96:欧美 8:日本 16:韩国 |

---

## 专辑

| 接口 | 说明 | 关键参数 |
|------|------|---------|
| `/album` | 专辑内容 | `id` |
| `/album/detail/dynamic` | 专辑动态信息 | `id` |
| `/album/sub` | 收藏/取消收藏 | `id`, `t`(1收藏) |
| `/album/sublist` | 已收藏专辑列表 | `limit`, `offset` |
| `/album/new` | 全部新碟 | `area`, `limit`, `offset` |
| `/album/newest` | 最新专辑 | 无 |
| `/top/album` | 新碟上架 | `area`(ALL/ZH/EA/KR/JP), `type`(new/hot), `year`, `month` |

---

## 歌手

| 接口 | 说明 | 关键参数 |
|------|------|---------|
| `/artists` | 歌手信息+热门歌曲 | `id` |
| `/artist/songs` | 歌手全部歌曲 | `id`, `order`(hot/time), `limit`, `offset` |
| `/artist/top/song` | 歌手热门50首 | `id` |
| `/artist/album` | 歌手专辑 | `id`, `limit`, `offset` |
| `/artist/mv` | 歌手 MV | `id` |
| `/artist/desc` | 歌手描述 | `id` |
| `/artist/detail` | 歌手详情 | `id` |
| `/artist/list` | 歌手分类列表 | `type`(1男/2女/3乐队), `area`(7华语/96欧美/8日本/16韩国), `initial`(首字母) |
| `/artist/sub` | 收藏/取消收藏 | `id`, `t`(1收藏) |
| `/artist/sublist` | 收藏的歌手列表 | `limit`, `offset` |

---

## 相似推荐

| 接口 | 说明 | 关键参数 |
|------|------|---------|
| `/simi/song` | 相似歌曲 | `id`(歌曲) |
| `/simi/playlist` | 相似歌单 | `id`(歌曲) |
| `/simi/artist` | 相似歌手 | `id`(歌手) |
| `/simi/mv` | 相似 MV | `mvid` |
| `/simi/user` | 最近听过这首歌的用户 | `id`(歌曲) |

---

## 用户

| 接口 | 说明 | 关键参数 |
|------|------|---------|
| `/user/detail` | 用户详情 | `uid` |
| `/user/account` | 账号信息 | 无 |
| `/user/record` | 播放记录 | `uid`, `type`(0全部/1周) |
| `/user/playlist` | 用户歌单 | `uid`, `limit`, `offset` |
| `/user/event` | 用户动态 | `uid`, `limit`, `lasttime` |
| `/user/follows` | 关注列表 | `uid` |
| `/user/followeds` | 粉丝列表 | `uid` |
| `/user/subcount` | 歌单/收藏/MV/DJ数量 | 无 |
| `/user/level` | 用户等级 | 无 |

---

## 喜欢

| 接口 | 说明 | 关键参数 |
|------|------|---------|
| `/like` | 喜欢/取消喜欢 | `id`, `like`(true/false) |
| `/likelist` | 喜欢音乐ID列表 | `uid` |

---

## 听歌打卡
```
/scrobble
```
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | number | 是 | 歌曲 id |
| `sourceid` | number | 是 | 歌单或专辑 id |
| `time` | number | 否 | 播放时间(秒) |

---

## 首页

| 接口 | 说明 | 关键参数 |
|------|------|---------|
| `/homepage/block/page` | 首页发现 | `refresh`, `cursor` |
| `/homepage/dragon/ball` | 圆形图标入口列表 | 无 |
| `/banner` | 轮播图 | `type`(0 pc / 1 android / 2 iphone / 3 ipad) |

---

## 登录

| 接口 | 说明 | 关键参数 |
|------|------|---------|
| `/login/cellphone` | 手机登录 | `phone`, `password`/`md5_password`/`captcha` |
| `/login` | 邮箱登录 | `email`, `password`/`md5_password` |
| `/login/qr/key` | 二维码 key | 无 |
| `/login/qr/create` | 生成二维码 | `key`, `qrimg` |
| `/login/qr/check` | 检测扫码状态 | `key` |
| `/register/anonimous` | 游客登录 | 无 |
| `/login/refresh` | 刷新登录 | 无 |
| `/login/status` | 登录状态 | 无 |
| `/logout` | 退出登录 | 无 |

---

## 评论

| 接口 | 说明 | 关键参数 |
|------|------|---------|
| `/comment/music` | 歌曲评论 | `id`, `limit`, `offset`, `before` |
| `/comment/album` | 专辑评论 | `id` |
| `/comment/playlist` | 歌单评论 | `id` |
| `/comment/mv` | MV 评论 | `id` |
| `/comment/hot` | 热门评论 | `id`, `type` |
| `/comment/new` | 新版评论 | `id`, `type`, `pageNo`, `pageSize`, `sortType` |
| `/comment/like` | 点赞评论 | `id`, `cid`, `t`, `type` |
| `/comment` | 发送/删除评论 | `t`, `type`, `id`, `content` |

---

## 当前适配器已使用接口

来自 [src/adapters/netsate.ts](src/adapters/netsate.ts):

| 函数 | 接口 | 说明 |
|------|------|------|
| `searchSongs()` | `/search` | 搜索歌曲 |
| `getSongDetail()` | `/song/detail` | 歌曲详情 |
| `getSongUrl()` | `/song/url` | 获取播放链接 |
| `getLyric()` | `/lyric` | 获取歌词 |
| `getRecommendations()` | `/recommend/songs` | 每日推荐 |
