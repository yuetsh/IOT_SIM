# 物联网编程仿真平台：一个镜像里包含 Bun 服务端、打包好的网页、.NET 运行时和 bubblewrap 沙箱。
# 构建：docker compose build；部署说明见 deploy/README.md

# ---- C# 运行时（编译服务 + 仿真库） ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS runtime-build
WORKDIR /src
COPY runtime/ runtime/
RUN dotnet build runtime/Runtime.slnx -c Release

# ---- 网页和服务端 ----
FROM oven/bun:1.4.4 AS web-build
WORKDIR /src
COPY package.json bun.lock ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
RUN bun install --frozen-lockfile
COPY shared/ shared/
COPY server/ server/
COPY web/ web/
RUN cd web && bun run build
# 服务端打包成单个文件，运行镜像里不需要 node_modules
RUN bun build server/src/index.ts --target=bun --outfile=server.js

# ---- 运行镜像 ----
FROM mcr.microsoft.com/dotnet/runtime:10.0
RUN apt-get update \
    && apt-get install -y --no-install-recommends bubblewrap tzdata \
    && rm -rf /var/lib/apt/lists/*
COPY --from=oven/bun:1.4.4 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY --from=runtime-build /src/runtime/Sim.Runner/bin/Release/net10.0/ runtime/
COPY --from=web-build /src/web/dist/ web/dist/
COPY --from=web-build /src/server.js ./
COPY samples/ samples/
ENV APP_ROOT=/app \
    RUNNER_DLL=runtime/Sim.Runner.dll \
    RUNS_DIR=/tmp/runs \
    SIM_SANDBOX=bwrap \
    TZ=Asia/Shanghai \
    PORT=3000 \
    DOTNET_CLI_TELEMETRY_OPTOUT=1
# 数据目录（数据卷挂在这里）属于运行平台的用户，新建的数据卷会继承这个属主
RUN mkdir -p /data && chown "$APP_UID" /data
# 镜像自带的非 root 用户
USER $APP_UID
EXPOSE 3000
CMD ["bun", "server.js"]
