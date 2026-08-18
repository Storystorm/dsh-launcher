# 黑鲸遥控 · 中继服务

零依赖 Node.js 服务,连接「黑鲸启动器」(电脑端)与「黑鲸遥控」微信小程序。

## 职责

- 微信小程序 wx.login 的 code2session 换 openid(微信登录)
- 启动器配对码绑定(6 位码,10 分钟有效,绑定即微信登录)
- 遥控命令转发:小程序 → 本服务 → 启动器 → 本机 DSH,结果原路回传

## 运行

开发期(无需微信 AppID,登录走 dev 模式,code 直接当 openid):

```bash
node relay-server.js          # 默认 0.0.0.0:8790
```

生产(需已注册小程序的 AppID/Secret,建议放在 https 域名后):

```bash
WX_APPID=wx... WX_SECRET=... PORT=8790 node relay-server.js
```

## 环境变量

| 变量 | 说明 | 默认 |
|---|---|---|
| PORT | 监听端口 | 8790 |
| HOST | 绑定地址 | 0.0.0.0 |
| WX_APPID | 小程序 AppID | 空(开发模式) |
| WX_SECRET | 小程序 Secret | 空 |
| RELAY_DATA | 数据文件路径 | ./relay-data.json |

## 对接

- 启动器:遥控台 → 远程遥控 → 填本服务地址 → 生成配对码
- 小程序:黑鲸遥控 → 登录 → 扫码/输码绑定 → 遥控台
- 真机/线上:小程序「我的 → 服务器地址」改为本服务的 https 域名(并在小程序后台配置 request 合法域名)
