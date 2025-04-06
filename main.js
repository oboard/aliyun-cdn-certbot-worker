// 导入必要的模块
import { Cron } from 'croner';
import crypto from 'crypto';
import acme from 'acme-client';

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
  const client = new acme.Client({
    directoryUrl: env.LE_DIRECTORY_URL,
    accountKey: await acme.crypto.createPrivateKey(),
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

    const keyAuthorization = await client.getChallengeKeyAuthorization(challenge);
    const dnsRecord = acme.crypto.getDns01Record(env.ALIYUN_DOMAIN_NAME, keyAuthorization);

    // TODO: 在这里实现 DNS 记录更新逻辑
    // 需要调用阿里云 DNS API 添加 TXT 记录
    // _acme-challenge.your.domain.com TXT dnsRecord

    await client.verifyChallenge(auth, challenge);
    await client.completeChallenge(challenge);
  }

  // 等待挑战完成
  await client.waitForValidStatus(order);

  // 生成证书
  const [key, csr] = await acme.crypto.createCsr({
    commonName: env.ALIYUN_DOMAIN_NAME,
  });

  // 完成订单
  const cert = await client.getCertificate(order);

  return {
    certificate: cert,
    privateKey: key.toString(),
  };
}

// 主处理函数
export default {
  async scheduled(event, env, ctx) {
    try {
      // 获取新证书
      const certData = await getNewCertificate(env);
      
      // 更新阿里云 CDN 证书
      const result = await updateAliyunCDNCert(certData, env);
      
      console.log('证书更新成功:', result);
    } catch (error) {
      console.error('证书更新失败:', error);
    }
  },
};
