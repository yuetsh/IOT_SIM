# 机房（debian114）

机房那台**不跑后端**：只有一个 Caddy（容器 `iot-web`），放打包好的网页，`/api`、`/ws`、`/resources` 反代到
`https://iot.xuyue.cc`。账号、作品、作业、提交只有服务器上那一份 SQLite，两边完全一致；学生程序的编译、运行也在服务器上。

- 学生访问 `http://10.13.114.114:86`（只在局域网，没有 frp）。
- 学生机出不了外网，是机房那台替它们连服务器。那条线断了，机房的 IOT 就用不了。
- 后端只认 Bearer 令牌，不检查 Origin，所以换个地址访问不用改服务器配置。登录限流按 IP：机房学生在服务器看来都是学校的出口 IP（和直接访问 iot.xuyue.cc 一样），上限 300 次 / 10 分钟。

平时 push 到 origin 的 main，`.gitea/workflows/deploy.yml` 在服务器部署成功后顺带更新机房（最后一步）。

手动部署（机房那台在 `/root/IOT`，`ssh fschool` 经服务器跳板进去）。网页要和服务器上的后端是同一个提交：

```bash
(cd web && bun run build)
ssh fschool mkdir -p /root/IOT/build
rsync -az --delete --no-owner --no-group web/dist/ fschool:/root/IOT/build/
rsync -ac --no-owner --no-group school/Caddyfile school/compose.yaml fschool:/root/IOT/
ssh fschool 'cd /root/IOT && docker compose up -d && docker compose restart'
```

只改了后端的话机房不用动。
