// 导入必要的模块
import crypto from 'crypto';
import { Client, crypto as acmeCrypto } from 'acme-client';

// 生成阿里云 API 签名
function generateSignature(params, secret) {
  const sortedParams = Object.keys(params).sort().map(key => {
    return `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`;
  }).join('&');

  const stringToSign = `GET&${encodeURIComponent('/')}&${encodeURIComponent(sortedParams)}`;
  const hmac = crypto.createHmac('sha1', secret + '&');
  return hmac.update(stringToSign).digest('base64');
}

// 处理阿里云 CDN API 请求
async function updateAliyunCDNCert(certData, env) {
  const timestamp = new Date().toISOString();
  const nonce = Math.random().toString(36).substring(2);

  const params = {
    Action: 'SetCdnDomainSSLCertificate',
    Format: 'JSON',
    Version: '2018-05-10',
    AccessKeyId: env.ALIYUN_ACCESS_KEY_ID,
    SignatureMethod: 'HMAC-SHA1',
    Timestamp: timestamp,
    SignatureVersion: '1.0',
    SignatureNonce: nonce,
    SSLProtocol: 'on',
    certType: 'upload',
    certName: env.ALIYUN_CERT_NAME || 'auto-renewed-cert',
    certRegion: env.ALIYUN_REGION || 'cn-hangzhou',
    SSLPub: certData.certificate,
    SSLPri: certData.privateKey,
    domainName: env.ALIYUN_DOMAIN_NAME,
  };

  // 生成签名
  params.Signature = generateSignature(params, env.ALIYUN_ACCESS_KEY_SECRET);

  const response = await fetch(env.ALIYUN_ENDPOINT || 'https://cdn.console.aliyun.com/data/api.json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });

  return response.json();
}

// 从 Let's Encrypt 获取新证书
async function getNewCertificate(env) {
  const client = new Client({
    directoryUrl: env.LE_DIRECTORY_URL,
    accountKey: await acmeCrypto.createPrivateKey(),
  });

  // 创建订单
  const order = await client.createOrder({
    identifiers: [
      { type: 'dns', value: env.ALIYUN_DOMAIN_NAME }
    ]
  });

  // 获取授权
  const authorizations = await client.getAuthorizations(order);

  // 完成挑战
  for (const auth of authorizations) {
    const challenge = auth.challenges.find(c => c.type === 'dns-01');
    if (!challenge) continue;

    await client.getChallengeKeyAuthorization(challenge);

    await client.verifyChallenge(auth, challenge);
    await client.completeChallenge(challenge);
  }

  // 等待挑战完成
  await client.waitForValidStatus(order);

  // 生成证书
  const [key] = await acmeCrypto.createCsr({
    commonName: env.ALIYUN_DOMAIN_NAME,
  });

  // 完成订单
  const cert = await client.getCertificate(order);

  return {
    certificate: cert,
    privateKey: key.toString(),
  };
}

// 更新证书的主函数
async function updateCertificate(env) {
  try {
    // 获取新证书
    const certData = await getNewCertificate(env);

    // 更新阿里云 CDN 证书
    const result = await updateAliyunCDNCert(certData, env);

    console.log('证书更新成功:', result);
    return { success: true, result };
  } catch (error) {
    console.error('证书更新失败:', error);
    return { success: false, error: error.message };
  }
}

// 主处理函数
export default {
  async scheduled(event, env, ctx) {
    await updateCertificate(env);
  },

  async fetch(request, env, ctx) {
    // 检查请求方法
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // 检查认证头
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 验证 token
    const token = authHeader.substring(7); // 去掉 'Bearer ' 前缀
    if (token !== env.ALIYUN_ACCESS_KEY_SECRET) {
      return new Response('Invalid token', { status: 401 });
    }

    // 执行证书更新
    const result = await updateCertificate(env);

    // 返回结果
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
