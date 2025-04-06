# 阿里云 CDN SSL 证书自动续期工具

一个使用 Let's Encrypt 自动为阿里云 CDN 续期 SSL 证书的工具。

## 功能特点

- 自动为阿里云 CDN 域名续期 SSL 证书
- 使用 Let's Encrypt 获取免费 SSL 证书
- 可配置定时任务
- 支持生产环境和测试环境
- 使用环境变量安全存储凭证

## 工作流程

1. **证书申请流程**：
   - 创建 Let's Encrypt 账户
   - 创建证书订单
   - 获取域名授权
   - 处理 DNS-01 挑战
   - 生成证书签名请求（CSR）
   - 完成订单并获取证书

2. **DNS 记录管理**：
   - 自动在 Cloudflare 添加 DNS 记录
   - 等待 DNS 记录传播
   - 验证 DNS 记录
   - 完成验证后自动清理 DNS 记录

3. **证书更新流程**：
   - 将新证书上传到阿里云 CDN
   - 使用唯一证书名称避免冲突
   - 启用 SSL 证书
   - 验证证书更新状态

## 前置条件

- Cloudflare 账号
- 阿里云账号，需要：
  - 已开通 CDN 服务
  - 具有适当权限的 Access Key
  - 已在 CDN 中配置域名
- 域名 DNS 由 Cloudflare 管理
- 已安装 Node.js 和 npm

## 配置说明

1. 克隆本仓库
2. 安装依赖：
```bash
npm install
```

3. 复制 `.env.example` 到 `.env` 并填写配置：

```bash
# 阿里云配置
ALIYUN_ACCESS_KEY_ID=你的访问密钥ID
ALIYUN_ACCESS_KEY_SECRET=你的访问密钥密码
ALIYUN_DOMAIN_NAME=你的域名.com
ALIYUN_CERT_NAME=自动续期证书

# Cloudflare 配置
CF_EMAIL=你的Cloudflare邮箱
CF_API_KEY=你的Cloudflare API密钥
CF_ZONE_ID=你的域名区域ID

# Let's Encrypt 配置
LE_EMAIL=你的邮箱@example.com
LE_DIRECTORY_URL=https://acme-v02.api.letsencrypt.org/directory  # 生产环境
# LE_DIRECTORY_URL=https://acme-staging-v02.api.letsencrypt.org/directory  # 测试环境
```

## 使用方法

1. 测试环境运行：
```bash
npm run test
```

2. 生产环境运行：
```bash
npm start
```

## 测试说明

在部署到生产环境之前，建议先使用 Let's Encrypt 的测试环境进行测试：

1. 将 `LE_DIRECTORY_URL` 设置为测试环境 URL
2. 运行测试
3. 确认正常工作后，再切换到生产环境 URL

## 安全注意事项

- 所有敏感凭证都通过环境变量存储
- 使用 Let's Encrypt 的 DNS-01 挑战进行域名验证
- 证书会在到期前自动续期
- Access Key 应仅具有必要的最小权限

## 故障排除

- 检查日志中的错误信息
- 确认 DNS 记录配置正确
- 确保阿里云 Access Key 具有正确的权限
- 先在测试环境中进行测试
- 如果遇到依赖问题，尝试：
  ```bash
  npm install
  ```

## 许可证

MIT

## 贡献

欢迎提交 Pull Request 来改进本项目！ 