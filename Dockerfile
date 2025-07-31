# 基于官方Node.js镜像
FROM node:22

# 设置工作目录
WORKDIR /app

# 复制package.json和pnpm-lock.yaml（如有）
COPY package.json ./
COPY pnpm-lock.yaml ./

# 安装pnpm
RUN npm install -g pnpm

# 安装依赖
RUN pnpm install --prod

# 复制项目文件
COPY . .

# 设置环境变量
ENV NODE_ENV=production
ENV DOCKER_ENV=true

# 创建日志目录
RUN mkdir -p /app/logs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# 启动应用
CMD ["node", "src/app.js"] 